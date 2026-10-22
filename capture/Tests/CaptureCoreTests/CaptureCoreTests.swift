import XCTest
@testable import CaptureCore

final class ShotPlanTests: XCTestCase {
    func testStandardPlanHasFourViewsAndOneStill() {
        let p = ShotPlan.standard
        XCTAssertEqual(p.shots.filter { $0.destination == .views }.count, 4)
        XCTAssertEqual(p.shots.filter { $0.destination == .still }.count, 1)
        XCTAssertEqual(p.shots.first?.key, "front", "Meshy reads the first view as the primary one")
    }

    func testMoreThanFourViewsIsRejected() {
        let shots = (1...5).map { Shot(key: "v\($0)", label: "V", hint: "", destination: .views) }
        XCTAssertThrowsError(try ShotPlan(shots: shots)) { XCTAssertEqual($0 as? PlanError, .tooManyViews(5)) }
    }

    func testDuplicateAndBadKeysAreRejected() {
        let a = Shot(key: "front", label: "", hint: "", destination: .views)
        XCTAssertThrowsError(try ShotPlan(shots: [a, a])) { XCTAssertEqual($0 as? PlanError, .duplicateKey("front")) }
        let bad = Shot(key: "Front View", label: "", hint: "", destination: .views)
        XCTAssertThrowsError(try ShotPlan(shots: [bad])) { XCTAssertEqual($0 as? PlanError, .badKey("Front View")) }
        XCTAssertThrowsError(try ShotPlan(shots: [])) { XCTAssertEqual($0 as? PlanError, .empty) }
    }

    func testExtrasAreNotLimited() throws {
        var shots = ShotPlan.standard.shots
        for i in 1...6 { shots.append(Shot(key: "detail-\(i)", label: "", hint: "", destination: .extra)) }
        XCTAssertNoThrow(try ShotPlan(shots: shots))
    }

    func testPlanRoundTripsThroughJSON() throws {
        let data = try JSONEncoder().encode(ShotPlan.standard)
        XCTAssertEqual(try JSONDecoder().decode(ShotPlan.self, from: data), ShotPlan.standard)
    }

    func testDecodingAnInvalidPlanFails() {
        let json = #"[{"key":"a","label":"","hint":"","destination":"views"},{"key":"a","label":"","hint":"","destination":"views"}]"#
        XCTAssertThrowsError(try JSONDecoder().decode(ShotPlan.self, from: Data(json.utf8)))
    }
}

final class OutputLayoutTests: XCTestCase {
    let layout = OutputLayout(root: URL(fileURLWithPath: "/tmp/shoot"), objectId: "012")

    func testViewFilesAreNumberedInPlanOrder() {
        let plan = ShotPlan.standard
        let names = plan.shots.compactMap { layout.file(for: $0, in: plan)?.lastPathComponent }
        XCTAssertEqual(names, ["1-front.jpg", "2-left.jpg", "3-back.jpg", "4-top.jpg", "still.jpg"])
    }

    func testViewNamesSortTheWayThePipelineReadsThem() {
        let plan = ShotPlan.standard
        let names = plan.shots.filter { $0.destination == .views }.compactMap { layout.file(for: $0, in: plan)?.lastPathComponent }
        XCTAssertEqual(names, names.sorted { $0.compare($1, options: .numeric) == .orderedAscending })
    }

    func testStillLivesNextToViewsNotInside() {
        let plan = ShotPlan.standard
        let still = plan.shots.first { $0.destination == .still }!
        XCTAssertEqual(layout.file(for: still, in: plan)?.path, "/tmp/shoot/012/still.jpg")
        XCTAssertEqual(layout.viewsDir.path, "/tmp/shoot/012/views")
    }

    func testExtraNumbersContinuePastTheHighest() {
        XCTAssertEqual(layout.extraFile(existing: []).lastPathComponent, "001.jpg")
        XCTAssertEqual(layout.extraFile(existing: ["001.jpg", "002.jpg", "notes.txt"]).lastPathComponent, "003.jpg")
        XCTAssertEqual(layout.extraFile(existing: ["007.jpg", "002.jpg"]).lastPathComponent, "008.jpg")
    }

    func testRelativePath() {
        XCTAssertEqual(layout.relative(layout.viewsDir.appendingPathComponent("1-front.jpg")), "views/1-front.jpg")
    }
}

final class ObjectCatalogTests: XCTestCase {
    let catalog = ObjectCatalog(entries: [
        .init(id: "003", name: "Salt and pepper shaker set", aliases: ["004"]),
        .init(id: "012", name: "Kodak box", aliases: nil),
    ])

    func testResolveFindsObjectsAliasesAndUnknowns() {
        XCTAssertEqual(catalog.resolve("012"), .object(catalog.entries[1]))
        XCTAssertEqual(catalog.resolve("004"), .alias(of: catalog.entries[0]))
        XCTAssertEqual(catalog.resolve("999"), .unknown)
    }

    func testLoadsTheRealFileShape() throws {
        let json = #"{"version":1,"note":"x","objects":[{"id":"001","name":"Wheel","group":"P","method":"flat","kind":"disc","sizeMm":null,"printed":""},{"id":"003","name":"Set","aliases":["004"],"group":"T","method":"meshy"}]}"#
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("objects-\(UUID().uuidString).json")
        try Data(json.utf8).write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }
        let c = try ObjectCatalog(contentsOf: url)
        XCTAssertEqual(c.entries.map(\.id), ["001", "003"])
        XCTAssertEqual(c.resolve("004"), .alias(of: c.entries[1]))
    }
}

final class SessionStateTests: XCTestCase {
    func testAdvancesThroughThePlanAndFinishes() {
        var s = SessionState(plan: .standard)
        XCTAssertEqual(s.current.key, "front")
        for _ in 0..<5 { s.markCurrentDone() }
        XCTAssertTrue(s.isComplete)
    }

    func testResumesAtTheFirstOpenShot() {
        let s = SessionState(plan: .standard, alreadyDone: ["front", "left"])
        XCTAssertEqual(s.current.key, "back")
    }

    func testMovingBackAndForthStaysInRange() {
        var s = SessionState(plan: .standard)
        s.previous()
        XCTAssertEqual(s.index, 0)
        for _ in 0..<10 { s.next() }
        XCTAssertEqual(s.index, ShotPlan.standard.shots.count - 1)
    }

    func testRetakingDoesNotSkipAhead() {
        var s = SessionState(plan: .standard)
        s.markCurrentDone()          // front done, now on left
        s.previous()                 // go back to front
        s.markCurrentDone()          // retake front: next open shot is left
        XCTAssertEqual(s.current.key, "left")
    }
}

final class RetakeInPlaceTests: XCTestCase {
    func testInPlaceMarksDoneWithoutMoving() {
        var s = SessionState(plan: .standard)
        s.markCurrentDoneInPlace()
        XCTAssertEqual(s.current.key, "front")
        XCTAssertTrue(s.done.contains("front"))
    }
}

final class ManifestTests: XCTestCase {
    func testRetakeReplacesTheRecord() {
        var m = CaptureManifest(objectId: "012", camera: .init(name: "iPhone", uniqueID: "u", model: "m"))
        let t = Date(timeIntervalSince1970: 1_700_000_000)
        m.upsert(.init(key: "front", destination: .views, file: "views/1-front.jpg", width: 4032, height: 3024, capturedAt: t, locks: .init()))
        m.upsert(.init(key: "front", destination: .views, file: "views/1-front.jpg", width: 4032, height: 3024, capturedAt: t.addingTimeInterval(60), locks: .init(focus: true, exposure: true, whiteBalance: true)))
        XCTAssertEqual(m.records.count, 1)
        XCTAssertTrue(m.records[0].locks.exposure)
    }

    func testWritesAndReadsBack() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("m-\(UUID().uuidString)/capture.json")
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        var m = CaptureManifest(objectId: "012", camera: .init(name: "iPhone", uniqueID: "u", model: "m"))
        m.upsert(.init(key: "still", destination: .still, file: "still.jpg", width: 100, height: 80, capturedAt: Date(timeIntervalSince1970: 1_700_000_000), locks: .init()))
        try m.write(to: url)
        XCTAssertEqual(CaptureManifest.load(from: url), m)
    }
}
