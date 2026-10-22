// swift-tools-version:5.9
import PackageDescription

// CaptureCore is plain Foundation (shot plan, file naming, manifest, session state) and is
// unit-tested on any platform. `shoot` is the macOS app that drives an iPhone as a fixed camera.
let package = Package(
    name: "capture",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "shoot", targets: ["shoot"]),
        .library(name: "CaptureCore", targets: ["CaptureCore"]),
    ],
    targets: [
        .target(name: "CaptureCore"),
        .executableTarget(name: "shoot", dependencies: ["CaptureCore"]),
        .testTarget(name: "CaptureCoreTests", dependencies: ["CaptureCore"]),
    ]
)
