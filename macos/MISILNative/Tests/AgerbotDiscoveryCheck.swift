import CryptoKit
import Foundation

@main
struct AgerbotDiscoveryCheck {
    static func main() async throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("misil-agerbot-discovery-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let project = root.appendingPathComponent("Agerbot", isDirectory: true)
        let managed = root.appendingPathComponent("managed", isDirectory: true)
        try FileManager.default.createDirectory(
            at: project.appendingPathComponent("checkpoints", isDirectory: true),
            withIntermediateDirectories: true
        )

        let v1 = try makeModel(version: "0.1.0", under: project, payload: Data("v1".utf8))
        let v2 = try makeModel(version: "0.2.0", under: project, payload: Data("v2-newest".utf8))
        let service = AgerbotModelDiscoveryService(
            platform: "macos-arm64",
            devices: ["cpu", "mps"]
        )
        var candidates = await service.discover(managedRoot: managed, developmentProject: project)
        precondition(candidates.count == 2)
        precondition(candidates.first?.manifest.model.version == "0.2.0")
        let automatic = await service.select(
            from: candidates,
            pinnedVersion: nil,
            automaticUpdates: true,
            allowPrerelease: false
        )
        precondition(automatic?.checkpointURL.standardizedFileURL.path == v2.standardizedFileURL.path)
        let pinned = await service.select(
            from: candidates,
            pinnedVersion: "0.1.0",
            automaticUpdates: false,
            allowPrerelease: false
        )
        precondition(pinned?.checkpointURL.standardizedFileURL.path == v1.standardizedFileURL.path)

        let v2Manifest = v2.deletingLastPathComponent().appendingPathComponent("manifest.json")
        var broken = try JSONSerialization.jsonObject(with: Data(contentsOf: v2Manifest)) as! [String: Any]
        var checkpoint = broken["checkpoint"] as! [String: Any]
        checkpoint["sha256"] = String(repeating: "0", count: 64)
        broken["checkpoint"] = checkpoint
        try JSONSerialization.data(withJSONObject: broken).write(to: v2Manifest, options: .atomic)
        candidates = await service.discover(managedRoot: managed, developmentProject: project)
        precondition(candidates.count == 1)
        precondition(candidates.first?.manifest.model.version == "0.1.0")

        let oldSettingsURL = root.appendingPathComponent("agerbot-settings.json")
        try Data(#"{"projectPath":"/development/Agerbot","checkpointPath":"/development/Agerbot/checkpoints/gastronomia-peruana-v1/best.pt","startWithMISIL":true,"generation":{"maxNewTokens":120,"temperature":0.8,"topK":40}}"#.utf8)
            .write(to: oldSettingsURL)
        let store = await MainActor.run { AgerbotSettingsStore(fileURL: oldSettingsURL) }
        let decodedAutomaticUpdates = await MainActor.run { store.settings.automaticModelUpdates }
        precondition(decodedAutomaticUpdates)

        let restoredV2 = try makeModel(version: "0.2.0", under: project, payload: Data("v2-newest".utf8))
        let migratedCandidates = await service.discover(managedRoot: managed, developmentProject: project)
        let selectedV2 = migratedCandidates.first {
            $0.checkpointURL.standardizedFileURL.path == restoredV2.standardizedFileURL.path
        }!
        await MainActor.run { store.applyDiscoveredModel(selectedV2) }
        let migrated = await MainActor.run { store.settings }
        precondition(migrated.activeModelVersion == "0.2.0")
        precondition(migrated.previousModelVersion == "0.1.0")
        precondition(migrated.checkpointPath == selectedV2.checkpointURL.path)

        precondition(AgerbotSemanticVersion("0.2.0")! > AgerbotSemanticVersion("0.1.9")!)
        precondition(AgerbotSemanticVersion("0.2.0-beta.1")! < AgerbotSemanticVersion("0.2.0")!)
        print("AgerbotDiscovery: 12 comprobaciones superadas")
    }

    private static func makeModel(version: String, under project: URL, payload: Data) throws -> URL {
        let directory = project.appendingPathComponent("checkpoints/model-\(version)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let checkpointURL = directory.appendingPathComponent("best.pt")
        try payload.write(to: checkpointURL, options: .atomic)
        let digest = SHA256.hash(data: payload).map { String(format: "%02x", $0) }.joined()
        let manifest: [String: Any] = [
            "schemaVersion": 2,
            "channel": "stable",
            "model": [
                "name": "Agerbot",
                "version": version,
                "trainingName": "test-\(version)",
                "architecture": "agerbot-transformer",
                "tokenizer": version == "0.1.0" ? "byte-v1" : "char-v1",
                "parameters": 10,
                "contextLength": 16,
            ],
            "runtime": ["minimumVersion": "0.1.0", "maximumVersion": NSNull()],
            "checkpoint": [
                "filename": "best.pt",
                "sizeBytes": payload.count,
                "sha256": digest,
            ],
            "compatibility": [
                "devices": ["cpu", "mps"],
                "platforms": ["macos-arm64"],
            ],
            "publishedAt": "2026-08-25T00:00:00Z",
        ]
        try JSONSerialization.data(withJSONObject: manifest)
            .write(to: directory.appendingPathComponent("manifest.json"), options: .atomic)
        return checkpointURL
    }
}
