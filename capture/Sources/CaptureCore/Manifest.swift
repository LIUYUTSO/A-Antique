import Foundation

/// shoot/<id>/capture.json. Records what was shot with which camera and whether exposure was locked,
/// so a bad set can be traced back to its cause.
public struct CaptureManifest: Codable, Equatable {
    public struct Camera: Codable, Equatable {
        public var name: String
        public var uniqueID: String
        public var model: String
        public init(name: String, uniqueID: String, model: String) {
            self.name = name
            self.uniqueID = uniqueID
            self.model = model
        }
    }

    public struct Locks: Codable, Equatable {
        public var focus: Bool
        public var exposure: Bool
        public var whiteBalance: Bool
        public init(focus: Bool = false, exposure: Bool = false, whiteBalance: Bool = false) {
            self.focus = focus
            self.exposure = exposure
            self.whiteBalance = whiteBalance
        }
    }

    public struct Record: Codable, Equatable {
        public var key: String
        public var destination: Destination
        public var file: String
        public var width: Int
        public var height: Int
        public var capturedAt: Date
        /// Whether focus, exposure and white balance were locked when this frame was taken.
        public var locks: Locks
        public init(key: String, destination: Destination, file: String, width: Int, height: Int, capturedAt: Date, locks: Locks) {
            self.key = key
            self.destination = destination
            self.file = file
            self.width = width
            self.height = height
            self.capturedAt = capturedAt
            self.locks = locks
        }
    }

    public var objectId: String
    public var camera: Camera
    public var records: [Record]

    public init(objectId: String, camera: Camera, records: [Record] = []) {
        self.objectId = objectId
        self.camera = camera
        self.records = records
    }

    /// A retake replaces the earlier record for the same file instead of adding a second one.
    public mutating func upsert(_ record: Record) {
        if let i = records.firstIndex(where: { $0.file == record.file }) {
            records[i] = record
        } else {
            records.append(record)
        }
    }

    public static func load(from url: URL) -> CaptureManifest? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return try? d.decode(CaptureManifest.self, from: data)
    }

    public func write(to url: URL) throws {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        e.dateEncodingStrategy = .iso8601
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try e.encode(self).write(to: url, options: .atomic)
    }
}
