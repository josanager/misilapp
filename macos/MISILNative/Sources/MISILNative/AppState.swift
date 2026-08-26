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

    let agerbotSettingsStore: AgerbotSettingsStore
    let agerbotInstallationManager: AgerbotInstallationManager
    let agerbotProcessManager: AgerbotProcessManager
    let agerbotConversationStore: AgerbotConversationStore
    let agerbotCapabilityViewModel: AgerbotCapabilityViewModel
    let agerbotUpdateController: AgerbotModelUpdateController

    private let storage: StorageCoordinator

    init(storage: StorageCoordinator = StorageCoordinator()) {
        self.storage = storage
        let settingsStore = AgerbotSettingsStore()
        let installationManager = AgerbotInstallationManager()
        let processManager = AgerbotProcessManager.shared
        let runtimeClient = AgerbotRuntimeClient()
        let activationGate = AgerbotActivationGate()
        let currentStore = AgerbotCurrentModelStore(
            fileURL: installationManager.managedRoot.appendingPathComponent("current-model.json")
        )
        let failedStore = AgerbotFailedVersionStore(
            fileURL: installationManager.managedRoot.appendingPathComponent("update-state.json")
        )
        let runtimeActivator = AgerbotManagedRuntimeActivator(
            processManager: processManager,
            settingsStore: settingsStore,
            installationManager: installationManager
        )
        let activationEngine = AgerbotAtomicActivationEngine(
            gate: activationGate,
            currentStore: currentStore,
            failedStore: failedStore
        )
        agerbotSettingsStore = settingsStore
        agerbotInstallationManager = installationManager
        agerbotProcessManager = processManager
        agerbotConversationStore = AgerbotConversationStore(
            client: runtimeClient,
            processManager: processManager,
            settingsStore: settingsStore,
            installationManager: installationManager,
            activationGate: activationGate
        )
        agerbotCapabilityViewModel = AgerbotCapabilityViewModel(client: runtimeClient)
        agerbotUpdateController = AgerbotModelUpdateController(
            downloadService: AgerbotModelDownloadService(),
            validator: AgerbotCandidateValidator(),
            settingsStore: settingsStore,
            installationManager: installationManager,
            currentStore: currentStore,
            failedStore: failedStore,
            activationEngine: activationEngine,
            runtimeActivator: runtimeActivator
        )
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
        if let selected = await agerbotInstallationManager.discover(using: agerbotSettingsStore.settings) {
            agerbotSettingsStore.applyDiscoveredModel(selected)
            let previous = agerbotInstallationManager.availableModels
                .first { $0.version < selected.version }?.manifest.model.version
            agerbotSettingsStore.setPreviousVersionIfMissing(previous)
        }
        agerbotInstallationManager.refresh(using: agerbotSettingsStore.settings)
        agerbotCapabilityViewModel.startMonitoring()
        if agerbotSettingsStore.settings.startWithMISIL {
            Task { [weak self] in
                guard let self else { return }
                await self.agerbotProcessManager.start(
                    settings: self.agerbotSettingsStore.settings,
                    installationStatus: self.agerbotInstallationManager.status
                )
                self.agerbotUpdateController.scheduleAutomaticCheck()
            }
        } else {
            agerbotUpdateController.scheduleAutomaticCheck()
        }
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
