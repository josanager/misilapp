import Foundation

@MainActor
final class AppState: ObservableObject {
    @Published private(set) var configuration: AppConfiguration?
    @Published private(set) var storageSnapshot = StorageSnapshot(
        quotaBytes: 0,
        usedBytes: 0,
        diskAvailableBytes: 0
    )
    @Published private(set) var setupProgress = SetupProgress.idle
    @Published private(set) var networkSnapshot = NetworkCapacitySnapshot.empty
    @Published private(set) var networkStatus: NetworkConnectionStatus = .connecting
    @Published private(set) var lastNetworkUpdate: Date?
    @Published private(set) var networkError: String?
    @Published private(set) var isLoading = true
    @Published private(set) var isPreparing = false
    @Published var route: AppRoute = .chats
    @Published var presentationError: String?
    @Published var showsContributionSetup = false

    private let storage: StorageCoordinator
    private let network: NetworkPresenceService
    private var networkTask: Task<Void, Never>?

    init(
        storage: StorageCoordinator = StorageCoordinator(),
        network: NetworkPresenceService = NetworkPresenceService()
    ) {
        self.storage = storage
        self.network = network
    }

    var hasCompletedOnboarding: Bool {
        configuration?.onboardingCompleted == true
    }

    var sharesStorage: Bool {
        configuration?.sharesStorage == true
    }

    func load() async {
        configuration = await storage.loadConfiguration()
        storageSnapshot = await storageSnapshotForCurrentConfiguration()
        isLoading = false
        await restartNetworkSync()
    }

    func availableDiskBytes() async -> UInt64 {
        await storage.diskAvailableBytes()
    }

    func finishOnboarding(sharesStorage: Bool, quotaGiB: Int = 0) async -> Bool {
        isPreparing = true
        presentationError = nil
        do {
            let configuration = try await storage.prepare(
                sharesStorage: sharesStorage,
                quotaGiB: quotaGiB
            ) { progress in
                await MainActor.run {
                    self.setupProgress = progress
                }
                try? await Task.sleep(for: .milliseconds(180))
            }
            self.configuration = configuration
            storageSnapshot = await storage.snapshot(for: configuration)
            await restartNetworkSync()
            try? await Task.sleep(for: .milliseconds(350))
            isPreparing = false
            showsContributionSetup = false
            route = sharesStorage ? .dashboard : .chats
            return true
        } catch {
            isPreparing = false
            presentationError = error.localizedDescription
            return false
        }
    }

    func refreshStorage() async {
        storageSnapshot = await storageSnapshotForCurrentConfiguration()
    }

    func requestDashboard() {
        route = .dashboard
    }

    func resetOnboardingForTesting() async {
        await stopNetworkSync(sendOffline: true)
        await storage.resetConfiguration()
        configuration = nil
        storageSnapshot = StorageSnapshot(
            quotaBytes: 0,
            usedBytes: 0,
            diskAvailableBytes: await storage.diskAvailableBytes()
        )
        setupProgress = .idle
        route = .chats
    }

    func shutdown() async {
        await stopNetworkSync(sendOffline: true)
    }

    private func restartNetworkSync() async {
        await stopNetworkSync(sendOffline: false)
        networkTask = Task { [weak self] in
            guard let self else { return }
            await self.runNetworkLoop()
        }
    }

    private func stopNetworkSync(sendOffline: Bool) async {
        let task = networkTask
        networkTask = nil
        task?.cancel()
        await task?.value
        if sendOffline, sharesStorage {
            try? await network.goOffline()
        }
    }

    private func runNetworkLoop() async {
        var delaySeconds = 5
        while !Task.isCancelled {
            do {
                let localSnapshot = await storageSnapshotForCurrentConfiguration()
                storageSnapshot = localSnapshot
                if lastNetworkUpdate == nil { networkStatus = .connecting }

                let snapshot: NetworkCapacitySnapshot
                if sharesStorage {
                    snapshot = try await network.heartbeat(
                        storage: localSnapshot,
                        storageHealthy: await storage.isStorageHealthy(configuration: configuration)
                    )
                } else {
                    snapshot = try await network.capacity()
                }

                networkSnapshot = snapshot
                networkStatus = .online
                lastNetworkUpdate = Date()
                networkError = nil
                delaySeconds = min(30, max(5, snapshot.heartbeatIntervalSeconds))
            } catch is CancellationError {
                break
            } catch {
                networkStatus = .offline
                networkError = error.localizedDescription
                delaySeconds = 5
            }

            do {
                try await Task.sleep(for: .seconds(delaySeconds))
            } catch {
                break
            }
        }
    }

    private func storageSnapshotForCurrentConfiguration() async -> StorageSnapshot {
        guard let configuration else {
            return StorageSnapshot(
                quotaBytes: 0,
                usedBytes: 0,
                diskAvailableBytes: await storage.diskAvailableBytes()
            )
        }
        return await storage.snapshot(for: configuration)
    }
}
