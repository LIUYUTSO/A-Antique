import Foundation

/// The one place that decides where a photo goes. The Meshy pipeline reads shoot/<id>/views/*.jpg
/// sorted by name, so these names are the contract between the two tools.
public struct OutputLayout {
    public let root: URL
    public let objectId: String

    public init(root: URL, objectId: String) {
        self.root = root
        self.objectId = objectId
    }

    public var objectDir: URL { root.appendingPathComponent(objectId, isDirectory: true) }
    public var viewsDir: URL { objectDir.appendingPathComponent("views", isDirectory: true) }
    public var extraDir: URL { objectDir.appendingPathComponent("extra", isDirectory: true) }
    public var manifest: URL { objectDir.appendingPathComponent("capture.json") }

    /// File for a planned shot: views/<n>-<key>.jpg, still.jpg.
    public func file(for shot: Shot, in plan: ShotPlan) -> URL? {
        switch shot.destination {
        case .views:
            guard let n = plan.viewNumber(of: shot) else { return nil }
            return viewsDir.appendingPathComponent("\(n)-\(shot.key).jpg")
        case .still:
            return objectDir.appendingPathComponent("still.jpg")
        case .extra:
            return nil // extras are numbered as they are taken, see extraFile(existing:)
        }
    }

    /// extra/001.jpg, extra/002.jpg ... one past the highest number already there.
    public func extraFile(existing names: [String]) -> URL {
        let highest = names.compactMap { name -> Int? in
            guard name.hasSuffix(".jpg"), let n = Int(name.dropLast(4)) else { return nil }
            return n
        }.max() ?? 0
        return extraDir.appendingPathComponent(String(format: "%03d.jpg", highest + 1))
    }

    /// Path relative to the object folder, for the manifest.
    public func relative(_ url: URL) -> String {
        let base = objectDir.standardizedFileURL.path
        let path = url.standardizedFileURL.path
        return path.hasPrefix(base + "/") ? String(path.dropFirst(base.count + 1)) : path
    }
}
