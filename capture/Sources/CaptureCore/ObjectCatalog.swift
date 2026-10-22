import Foundation

/// data/objects.json, read only for what the capture tool needs: ids, names and merged-set aliases.
public struct ObjectCatalog {
    public struct Entry: Decodable, Equatable {
        public let id: String
        public let name: String
        public let aliases: [String]?
    }

    private struct File: Decodable { let objects: [Entry] }

    public enum Resolution: Equatable {
        case object(Entry)
        /// The id belongs to a merged set. Shoot the set under its main id.
        case alias(of: Entry)
        case unknown
    }

    public let entries: [Entry]

    public init(entries: [Entry]) { self.entries = entries }

    public init(contentsOf url: URL) throws {
        self.entries = try JSONDecoder().decode(File.self, from: Data(contentsOf: url)).objects
    }

    public func resolve(_ id: String) -> Resolution {
        if let e = entries.first(where: { $0.id == id }) { return .object(e) }
        if let e = entries.first(where: { ($0.aliases ?? []).contains(id) }) { return .alias(of: e) }
        return .unknown
    }
}
