import Foundation
import CaptureCore

struct RunConfig {
    let objectId: String
    let objectName: String
    let layout: OutputLayout
    let plan: ShotPlan
    /// Seconds to wait after the key press, so a hand can leave the frame.
    let delay: Int
    let cameraName: String?
    /// Shots that already have a file on disk, so a second run picks up where the first stopped.
    let alreadyDone: Set<String>
}

struct Options {
    var objectId: String?
    var out = "shoot"
    var catalog = "data/objects.json"
    var plan: String?
    var delay = 0
    var camera: String?
    var listCameras = false
}

func fail(_ message: String, code: Int32 = 2) -> Never {
    FileHandle.standardError.write(Data(("shoot: " + message + "\n").utf8))
    exit(code)
}

let usage = """
Usage: shoot <object-id> [--out shoot] [--catalog data/objects.json] [--plan plan.json] [--delay 3] [--camera "iPhone"]
       shoot --list-cameras

Run it from the repository root. Photos go to <out>/<id>/views, still.jpg and extra/.
"""

func parseOptions(_ args: [String]) -> Options {
    var o = Options()
    var i = 0
    func value(_ flag: String) -> String {
        i += 1
        guard i < args.count else { fail("\(flag) needs a value\n\(usage)") }
        return args[i]
    }
    while i < args.count {
        let a = args[i]
        switch a {
        case "--out": o.out = value(a)
        case "--catalog": o.catalog = value(a)
        case "--plan": o.plan = value(a)
        case "--camera": o.camera = value(a)
        case "--delay":
            guard let n = Int(value(a)), n >= 0, n <= 30 else { fail("--delay is a whole number of seconds, 0 to 30") }
            o.delay = n
        case "--list-cameras": o.listCameras = true
        case "-h", "--help": print(usage); exit(0)
        default:
            if a.hasPrefix("--") { fail("unknown flag \(a)\n\(usage)") }
            if o.objectId != nil { fail("only one object id at a time\n\(usage)") }
            o.objectId = a
        }
        i += 1
    }
    return o
}

func makeConfig(_ o: Options) -> RunConfig {
    guard let id = o.objectId else { fail("pass an object id, e.g. shoot 012\n\(usage)") }
    let catalog: ObjectCatalog
    do { catalog = try ObjectCatalog(contentsOf: URL(fileURLWithPath: o.catalog)) }
    catch { fail("cannot read \(o.catalog) (run from the repository root): \(error)") }

    let entry: ObjectCatalog.Entry
    switch catalog.resolve(id) {
    case .object(let e): entry = e
    case .alias(let main): fail("\(id) is part of the set \(main.id) (\(main.name)). Shoot it as \(main.id).")
    case .unknown: fail("\(id) is not in \(o.catalog)")
    }

    let plan: ShotPlan
    if let path = o.plan {
        do { plan = try ShotPlan.load(from: URL(fileURLWithPath: path)) }
        catch { fail("bad plan \(path): \(error)") }
    } else {
        plan = .standard
    }

    let layout = OutputLayout(root: URL(fileURLWithPath: o.out, isDirectory: true), objectId: entry.id)
    var done = Set<String>()
    for shot in plan.shots {
        if let url = layout.file(for: shot, in: plan), FileManager.default.fileExists(atPath: url.path) { done.insert(shot.key) }
    }
    return RunConfig(objectId: entry.id, objectName: entry.name, layout: layout, plan: plan,
                     delay: o.delay, cameraName: o.camera, alreadyDone: done)
}
