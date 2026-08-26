import Foundation

actor AgerbotActivationGate {
    private var activeGenerations = 0
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func beginGeneration() { activeGenerations += 1 }

    func endGeneration() {
        activeGenerations = max(0, activeGenerations - 1)
        guard activeGenerations == 0 else { return }
        let pending = waiters
        waiters.removeAll()
        pending.forEach { $0.resume() }
    }

    func waitUntilIdle() async {
        guard activeGenerations > 0 else { return }
        await withCheckedContinuation { continuation in waiters.append(continuation) }
    }

    func isBusy() -> Bool { activeGenerations > 0 }
}

actor AgerbotCurrentModelStore {
    private let fileURL: URL

    init(fileURL: URL) { self.fileURL = fileURL }

    func load() -> AgerbotCurrentModelRecord? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(AgerbotCurrentModelRecord.self, from: data)
    }

    func write(_ record: AgerbotCurrentModelRecord) throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(record)
        try data.write(to: fileURL, options: [.atomic, .completeFileProtection])
    }
}

actor AgerbotFailedVersionStore {
    private let fileURL: URL

    init(fileURL: URL) { self.fileURL = fileURL }

    func contains(_ version: String) -> Bool {
        load().failedVersions[version] != nil
    }

    func reason(for version: String) -> String? { load().failedVersions[version] }

    func markFailed(version: String, reason: String) throws {
        var state = load()
        state.failedVersions[version] = reason
        state.updatedAt = Date()
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(state).write(to: fileURL, options: [.atomic, .completeFileProtection])
    }

    private func load() -> AgerbotPersistedUpdateState {
        guard let data = try? Data(contentsOf: fileURL) else { return .empty }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode(AgerbotPersistedUpdateState.self, from: data)) ?? .empty
    }
}

@MainActor
protocol AgerbotRuntimeActivating: AnyObject {
    func activate(_ record: AgerbotCurrentModelRecord) async -> Bool
}

@MainActor
final class AgerbotAtomicActivationEngine {
    private let gate: AgerbotActivationGate
    private let currentStore: AgerbotCurrentModelStore
    private let failedStore: AgerbotFailedVersionStore

    init(
        gate: AgerbotActivationGate,
        currentStore: AgerbotCurrentModelStore,
        failedStore: AgerbotFailedVersionStore
    ) {
        self.gate = gate
        self.currentStore = currentStore
        self.failedStore = failedStore
    }

    func activate(
        candidate: AgerbotCurrentModelRecord,
        previous: AgerbotCurrentModelRecord?,
        runtime: AgerbotRuntimeActivating
    ) async -> Bool {
        await gate.waitUntilIdle()
        do {
            try await currentStore.write(candidate)
        } catch {
            return false
        }
        if await runtime.activate(candidate) { return true }

        try? await failedStore.markFailed(
            version: candidate.activeVersion,
            reason: "El runtime no confirmó la versión después de activarla."
        )
        guard let previous else { return false }
        do {
            try await currentStore.write(previous)
        } catch {
            return false
        }
        _ = await runtime.activate(previous)
        return false
    }
}
