import Foundation

@MainActor
final class MockRuntimeActivator: AgerbotRuntimeActivating {
    var failingVersions: Set<String>
    private(set) var activations: [String] = []

    init(failingVersions: Set<String> = []) { self.failingVersions = failingVersions }

    func activate(_ record: AgerbotCurrentModelRecord) async -> Bool {
        activations.append(record.activeVersion)
        return !failingVersions.contains(record.activeVersion)
    }
}

@main
struct AgerbotActivationCheck {
    static func main() async throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("misil-activation-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let currentStore = AgerbotCurrentModelStore(fileURL: root.appendingPathComponent("current-model.json"))
        let failedStore = AgerbotFailedVersionStore(fileURL: root.appendingPathComponent("update-state.json"))
        let gate = AgerbotActivationGate()
        let engine = await MainActor.run {
            AgerbotAtomicActivationEngine(gate: gate, currentStore: currentStore, failedStore: failedStore)
        }
        let v1 = record("0.1.0", root: root, previous: nil)
        let v2 = record("0.2.0", root: root, previous: "0.1.0")

        await gate.beginGeneration()
        let successfulRuntime = await MainActor.run { MockRuntimeActivator() }
        let pendingActivation = Task { @MainActor in
            await engine.activate(candidate: v2, previous: v1, runtime: successfulRuntime)
        }
        try await Task.sleep(for: .milliseconds(120))
        let storedWhileBusy = await currentStore.load()
        precondition(storedWhileBusy == nil)
        let callsWhileBusy = await MainActor.run { successfulRuntime.activations }
        precondition(callsWhileBusy.isEmpty)
        await gate.endGeneration()
        let firstActivationSucceeded = await pendingActivation.value
        precondition(firstActivationSucceeded)
        let firstStoredVersion = await currentStore.load()?.activeVersion
        precondition(firstStoredVersion == "0.2.0")

        let v3 = record("0.3.0", root: root, previous: "0.2.0")
        let failingRuntime = await MainActor.run {
            MockRuntimeActivator(failingVersions: ["0.3.0"])
        }
        let activated = await engine.activate(candidate: v3, previous: v2, runtime: failingRuntime)
        precondition(!activated)
        let versionAfterRollback = await currentStore.load()?.activeVersion
        let failedVersionPersisted = await failedStore.contains("0.3.0")
        precondition(versionAfterRollback == "0.2.0")
        precondition(failedVersionPersisted)
        let rollbackCalls = await MainActor.run { failingRuntime.activations }
        precondition(rollbackCalls == ["0.3.0", "0.2.0"])
        precondition(FileManager.default.fileExists(atPath: v2.checkpointPath))
        precondition(FileManager.default.fileExists(atPath: v3.checkpointPath))
        print("AgerbotActivation: 10 comprobaciones superadas")
    }

    static func record(
        _ version: String,
        root: URL,
        previous: String?
    ) -> AgerbotCurrentModelRecord {
        let checkpoint = root.appendingPathComponent("\(version).pt")
        let manifest = root.appendingPathComponent("\(version).json")
        FileManager.default.createFile(atPath: checkpoint.path, contents: Data(version.utf8))
        FileManager.default.createFile(atPath: manifest.path, contents: Data("{}".utf8))
        return AgerbotCurrentModelRecord(
            activeVersion: version,
            previousVersion: previous,
            activatedAt: Date(),
            checkpointPath: checkpoint.path,
            manifestPath: manifest.path
        )
    }
}
