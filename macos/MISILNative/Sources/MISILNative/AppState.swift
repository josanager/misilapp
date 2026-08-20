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
    @Published private(set) var isLoading = true
    @Published private(set) var isPreparing = false
    @Published var route: AppRoute = .chats
    @Published var presentationError: String?
    @Published var showsContributionSetup = false

    private let storage: StorageCoordinator

    init(storage: StorageCoordinator = StorageCoordinator()) {
        self.storage = storage
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
