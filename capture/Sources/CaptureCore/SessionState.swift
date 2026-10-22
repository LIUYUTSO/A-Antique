import Foundation

/// Which planned shot is up next. Pure state, no camera and no disk, so it is tested on its own.
public struct SessionState: Equatable {
    public let plan: ShotPlan
    public private(set) var index: Int
    public private(set) var done: Set<String>

    public init(plan: ShotPlan, alreadyDone: Set<String> = []) {
        self.plan = plan
        self.done = alreadyDone
        // Start at the first shot that is not done yet, or the first shot when everything is.
        self.index = plan.shots.firstIndex(where: { !alreadyDone.contains($0.key) }) ?? 0
    }

    public var current: Shot { plan.shots[index] }
    public var isComplete: Bool { plan.shots.allSatisfy { done.contains($0.key) } }

    public var position: String { "\(index + 1)/\(plan.shots.count)" }

    /// Mark the current shot taken and move to the next one that is still open, if any.
    public mutating func markCurrentDone() {
        done.insert(current.key)
        if let next = plan.shots.indices.first(where: { $0 > index && !done.contains(plan.shots[$0].key) }) {
            index = next
        }
    }

    /// Mark the current shot taken but stay on it (a retake).
    public mutating func markCurrentDoneInPlace() { done.insert(current.key) }

    public mutating func next() { if index < plan.shots.count - 1 { index += 1 } }
    public mutating func previous() { if index > 0 { index -= 1 } }
}
