import Foundation

/// Where a shot lands under shoot/<id>/.
public enum Destination: String, Codable, Equatable {
    /// Sent to Meshy. At most four, and file names sort in plan order (the first is the front view).
    case views
    /// The top-down still the website shows. One file, still.jpg.
    case still
    /// Free-form detail photos (inside print, labels, hinges). Never sent to Meshy.
    case extra
}

public struct Shot: Codable, Equatable {
    public let key: String
    public let label: String
    public let hint: String
    public let destination: Destination

    public init(key: String, label: String, hint: String, destination: Destination) {
        self.key = key
        self.label = label
        self.hint = hint
        self.destination = destination
    }
}

public enum PlanError: Error, Equatable, CustomStringConvertible {
    case tooManyViews(Int)
    case duplicateKey(String)
    case badKey(String)
    case duplicateStill
    case empty

    public var description: String {
        switch self {
        case .tooManyViews(let n): return "Meshy takes at most 4 views, the plan has \(n)"
        case .duplicateKey(let k): return "shot key \"\(k)\" is used twice"
        case .badKey(let k): return "shot key \"\(k)\" must be lowercase letters, digits and dashes"
        case .duplicateStill: return "only one shot can be the still"
        case .empty: return "the plan has no shots"
        }
    }
}

public struct ShotPlan: Codable, Equatable {
    public let shots: [Shot]

    public static let maxViews = 4

    /// Front first (Meshy treats the first image as the primary view), then left, back, top-down.
    /// The still is a separate, tighter top-down frame for the website.
    public static let standard = try! ShotPlan(shots: [
        Shot(key: "front", label: "Front", hint: "Face the camera straight on. Fill about half the frame.", destination: .views),
        Shot(key: "left", label: "Left", hint: "Turn the object so its left side faces the camera.", destination: .views),
        Shot(key: "back", label: "Back", hint: "Turn it around to show the back.", destination: .views),
        Shot(key: "top", label: "Top", hint: "Lay or tilt it so the top faces the camera.", destination: .views),
        Shot(key: "still", label: "Still", hint: "Top-down, centred, about half the plate width. This is the website photo.", destination: .still),
    ])

    public init(shots: [Shot]) throws {
        try Self.validate(shots)
        self.shots = shots
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        try self.init(shots: try c.decode([Shot].self))
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(shots)
    }

    static func validate(_ shots: [Shot]) throws {
        if shots.isEmpty { throw PlanError.empty }
        var seen = Set<String>()
        for s in shots {
            guard s.key.range(of: "^[a-z0-9]+(-[a-z0-9]+)*$", options: .regularExpression) != nil else { throw PlanError.badKey(s.key) }
            if !seen.insert(s.key).inserted { throw PlanError.duplicateKey(s.key) }
        }
        let views = shots.filter { $0.destination == .views }.count
        if views > maxViews { throw PlanError.tooManyViews(views) }
        if shots.filter({ $0.destination == .still }).count > 1 { throw PlanError.duplicateStill }
    }

    public static func load(from url: URL) throws -> ShotPlan {
        try JSONDecoder().decode(ShotPlan.self, from: Data(contentsOf: url))
    }

    /// 1-based position of a shot among the views, which becomes the number in its file name.
    public func viewNumber(of shot: Shot) -> Int? {
        guard shot.destination == .views else { return nil }
        return shots.filter { $0.destination == .views }.firstIndex(of: shot).map { $0 + 1 }
    }
}
