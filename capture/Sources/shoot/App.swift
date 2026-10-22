#if canImport(AVFoundation) && canImport(AppKit)
import AppKit
import AVFoundation
import ImageIO
import CaptureCore

// MARK: - Camera

struct CameraError: Error, CustomStringConvertible {
    let description: String
    init(_ message: String) { description = message }
}

/// iPhone first (Continuity Camera), then any external camera, then the built-in one.
func availableCameras() -> [AVCaptureDevice] {
    let types: [AVCaptureDevice.DeviceType] = [.continuityCamera, .external, .builtInWideAngleCamera]
    let found = AVCaptureDevice.DiscoverySession(deviceTypes: types, mediaType: .video, position: .unspecified).devices
    func rank(_ d: AVCaptureDevice) -> Int { types.firstIndex(of: d.deviceType) ?? types.count }
    return found.sorted { rank($0) < rank($1) }
}

func listCameras() -> Never {
    let cameras = availableCameras()
    if cameras.isEmpty { print("No cameras found.") }
    for c in cameras { print("\(c.localizedName)\t\(c.modelID)\t\(c.deviceType.rawValue)") }
    exit(0)
}

final class Camera: NSObject, AVCapturePhotoCaptureDelegate {
    let device: AVCaptureDevice
    let session = AVCaptureSession()
    private let output = AVCapturePhotoOutput()
    private var pending: CheckedContinuation<Data, Error>?
    private(set) var locks = CaptureManifest.Locks()

    init(device: AVCaptureDevice) throws {
        self.device = device
        super.init()
        session.beginConfiguration()
        session.sessionPreset = .photo
        let input = try AVCaptureDeviceInput(device: device)
        guard session.canAddInput(input) else { throw CameraError("Cannot use \(device.localizedName) as an input.") }
        session.addInput(input)
        guard session.canAddOutput(output) else { throw CameraError("Cannot add a photo output.") }
        session.addOutput(output)
        session.commitConfiguration()
        // Largest still the camera offers.
        if let best = device.activeFormat.supportedMaxPhotoDimensions.max(by: { Int($0.width) * Int($0.height) < Int($1.width) * Int($1.height) }) {
            output.maxPhotoDimensions = best
        }
    }

    func start() {
        DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
    }

    /// Fix focus, exposure and white balance so every angle is shot under the same settings.
    /// Whatever the camera cannot lock stays automatic, and `locks` says which.
    func setLocked(_ lock: Bool) throws {
        try device.lockForConfiguration()
        defer { device.unlockForConfiguration() }
        var result = CaptureManifest.Locks()
        let focus: AVCaptureDevice.FocusMode = lock ? .locked : .continuousAutoFocus
        if device.isFocusModeSupported(focus) { device.focusMode = focus; result.focus = lock }
        let exposure: AVCaptureDevice.ExposureMode = lock ? .locked : .continuousAutoExposure
        if device.isExposureModeSupported(exposure) { device.exposureMode = exposure; result.exposure = lock }
        let balance: AVCaptureDevice.WhiteBalanceMode = lock ? .locked : .continuousAutoWhiteBalance
        if device.isWhiteBalanceModeSupported(balance) { device.whiteBalanceMode = balance; result.whiteBalance = lock }
        locks = result
    }

    func capturePhoto() async throws -> Data {
        guard output.availablePhotoCodecTypes.contains(.jpeg) else { throw CameraError("This camera cannot produce JPEG stills.") }
        let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
        if output.maxPhotoDimensions.width > 0 { settings.maxPhotoDimensions = output.maxPhotoDimensions }
        return try await withCheckedThrowingContinuation { continuation in
            self.pending = continuation
            self.output.capturePhoto(with: settings, delegate: self)
        }
    }

    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        defer { pending = nil }
        if let error { pending?.resume(throwing: error); return }
        guard let data = photo.fileDataRepresentation() else { pending?.resume(throwing: CameraError("The camera returned no image data.")); return }
        pending?.resume(returning: data)
    }
}

func pixelSize(of data: Data) -> (width: Int, height: Int) {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let w = props[kCGImagePropertyPixelWidth] as? Int,
          let h = props[kCGImagePropertyPixelHeight] as? Int else { return (0, 0) }
    return (w, h)
}

// MARK: - Window

final class PreviewView: NSView {
    var previewLayer: AVCaptureVideoPreviewLayer?
    let guide = CAShapeLayer()
    var onKey: ((NSEvent) -> Void)?

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
        guide.fillColor = nil
        guide.strokeColor = NSColor.white.withAlphaComponent(0.7).cgColor
        guide.lineDashPattern = [6, 6]
        guide.lineWidth = 1
    }
    required init?(coder: NSCoder) { fatalError("not used") }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) { onKey?(event) }

    override func layout() {
        super.layout()
        previewLayer?.frame = bounds
        // The centre half of the frame: the object should fill about this much.
        let rect = previewLayer?.layerRectConverted(fromMetadataOutputRect: CGRect(x: 0.25, y: 0.25, width: 0.5, height: 0.5))
            ?? bounds.insetBy(dx: bounds.width / 4, dy: bounds.height / 4)
        guide.path = CGPath(rect: rect, transform: nil)
        guide.frame = bounds
    }
}

final class ShootApp: NSObject, NSApplicationDelegate {
    private let config: RunConfig
    private var camera: Camera!
    private var state: SessionState
    private var manifest: CaptureManifest!
    private var window: NSWindow!
    private var preview: PreviewView!
    private let status = NSTextField(labelWithString: "")
    private var lastMessage = ""
    private var busy = false

    init(config: RunConfig) {
        self.config = config
        self.state = SessionState(plan: config.plan, alreadyDone: config.alreadyDone)
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: launch()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async { granted ? self.launch() : self.denied() }
            }
        default: denied()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    private func denied() {
        fail("camera access is off. Allow it for your terminal in System Settings > Privacy & Security > Camera, then run again.", code: 3)
    }

    private func launch() {
        let cameras = availableCameras()
        let chosen: AVCaptureDevice?
        if let name = config.cameraName { chosen = cameras.first { $0.localizedName.localizedCaseInsensitiveContains(name) } }
        else { chosen = cameras.first }
        guard let device = chosen else {
            fail("no camera found. For an iPhone: Wi-Fi and Bluetooth on, same Apple ID, iPhone near the Mac. Try `shoot --list-cameras`.", code: 3)
        }
        do { camera = try Camera(device: device) } catch { fail("\(error)", code: 3) }

        manifest = CaptureManifest.load(from: config.layout.manifest)
            ?? CaptureManifest(objectId: config.objectId, camera: .init(name: device.localizedName, uniqueID: device.uniqueID, model: device.modelID))
        manifest.camera = .init(name: device.localizedName, uniqueID: device.uniqueID, model: device.modelID)

        buildWindow()
        camera.start()
        refresh()
    }

    private func buildWindow() {
        let frame = NSRect(x: 0, y: 0, width: 1100, height: 760)
        window = NSWindow(contentRect: frame, styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "shoot \(config.objectId) — \(camera.device.localizedName)"
        window.center()

        let content = NSView(frame: frame)
        preview = PreviewView(frame: NSRect(x: 0, y: 96, width: frame.width, height: frame.height - 96))
        preview.autoresizingMask = [.width, .height]
        let layer = AVCaptureVideoPreviewLayer(session: camera.session)
        layer.videoGravity = .resizeAspect
        // A mirrored preview would flip printed text, which is confusing when framing.
        if let connection = layer.connection, connection.isVideoMirroringSupported {
            connection.automaticallyAdjustsVideoMirroring = false
            connection.isVideoMirrored = false
        }
        preview.layer?.addSublayer(layer)
        preview.layer?.addSublayer(preview.guide)
        preview.previewLayer = layer
        preview.onKey = { [weak self] event in self?.handle(event) }

        status.frame = NSRect(x: 14, y: 6, width: frame.width - 28, height: 84)
        status.autoresizingMask = [.width]
        status.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        status.maximumNumberOfLines = 0
        status.lineBreakMode = .byWordWrapping

        content.addSubview(preview)
        content.addSubview(status)
        window.contentView = content
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(preview)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: Keys

    private func handle(_ event: NSEvent) {
        guard !busy else { return }
        switch event.keyCode {
        case 123: state.previous(); refresh(); return        // left arrow
        case 124: state.next(); refresh(); return            // right arrow
        case 53: NSApp.terminate(nil); return                // escape
        default: break
        }
        switch event.charactersIgnoringModifiers?.lowercased() {
        case " ": Task { await shoot(advance: true) }
        case "r": Task { await shoot(advance: false) }
        case "d": Task { await shootExtra() }
        case "l": toggleLock()
        case "g": preview.guide.isHidden.toggle()
        case "q": NSApp.terminate(nil)
        default: break
        }
    }

    private func toggleLock() {
        let lock = !(camera.locks.exposure || camera.locks.focus || camera.locks.whiteBalance)
        do { try camera.setLocked(lock); lastMessage = lock ? "Locked what the camera allows." : "Back to automatic." }
        catch { lastMessage = "Could not change the lock: \(error)" }
        refresh()
    }

    // MARK: Capture

    @MainActor private func shoot(advance: Bool) async {
        let shot = state.current
        let url = config.layout.file(for: shot, in: config.plan) ?? config.layout.extraFile(existing: existingExtras())
        guard await take(to: url, key: shot.key, destination: shot.destination) else { return }
        if advance { state.markCurrentDone() } else { state.markCurrentDoneInPlace() }
    }

    @MainActor private func shootExtra() async {
        let url = config.layout.extraFile(existing: existingExtras())
        _ = await take(to: url, key: url.deletingPathExtension().lastPathComponent, destination: .extra)
    }

    private func existingExtras() -> [String] {
        (try? FileManager.default.contentsOfDirectory(atPath: config.layout.extraDir.path)) ?? []
    }

    /// Returns true when the photo was written.
    @MainActor private func take(to url: URL, key: String, destination: Destination) async -> Bool {
        busy = true
        defer { busy = false; refresh() }
        for second in stride(from: config.delay, to: 0, by: -1) {
            lastMessage = "Shooting in \(second)…"
            refresh()
            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }
        do {
            let data = try await camera.capturePhoto()
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: url, options: .atomic)
            let size = pixelSize(of: data)
            manifest.upsert(.init(key: key, destination: destination, file: config.layout.relative(url),
                                  width: size.width, height: size.height, capturedAt: Date(), locks: camera.locks))
            try manifest.write(to: config.layout.manifest)
            lastMessage = "Saved \(config.layout.relative(url)) (\(size.width)×\(size.height))"
            return true
        } catch {
            lastMessage = "Failed: \(error)"
            return false
        }
    }

    // MARK: Status

    private func refresh() {
        let shot = state.current
        let steps = config.plan.shots.map { (state.done.contains($0.key) ? "✓" : "·") + $0.key }.joined(separator: "  ")
        let locks = camera.locks
        let lockText = "focus \(locks.focus ? "locked" : "auto"), exposure \(locks.exposure ? "locked" : "auto"), white balance \(locks.whiteBalance ? "locked" : "auto")"
        status.stringValue = """
        \(config.objectId) \(config.objectName)   [\(state.position)] \(shot.label.uppercased())\(state.isComplete ? "   — all shots taken" : "")
        \(shot.hint)
        \(steps)
        SPACE shoot and next · R retake · ← → step · D detail photo · L lock (\(lockText)) · G guide · Q quit
        \(lastMessage)
        """
    }
}

var keepAlive: ShootApp?

func runCaptureApp(_ config: RunConfig) -> Never {
    let app = NSApplication.shared
    let delegate = ShootApp(config: config)
    keepAlive = delegate
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
    exit(0)
}
#endif
