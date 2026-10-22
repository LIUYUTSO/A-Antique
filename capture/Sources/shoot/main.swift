import Foundation
import CaptureCore

let options = parseOptions(Array(CommandLine.arguments.dropFirst()))

#if canImport(AVFoundation) && canImport(AppKit)
if options.listCameras { listCameras() }
runCaptureApp(makeConfig(options))
#else
// CaptureCore and its tests build everywhere; the camera app needs macOS.
// Still validate the object id and plan, so a bad invocation is caught the same way everywhere.
if options.objectId != nil { _ = makeConfig(options) }
fail("shoot needs macOS 14 or later (AVFoundation and AppKit).", code: 1)
#endif
