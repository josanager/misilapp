import Foundation

@MainActor
final class AgerbotManagedRuntimeActivator: AgerbotRuntimeActivating {
    private let processManager: AgerbotProcessManager
    private let settingsStore: AgerbotSettingsStore
    private let installationManager: AgerbotInstallationManager

    init(
        processManager: AgerbotProcessManager,
        settingsStore: AgerbotSettingsStore,
        installationManager: AgerbotInstallationManager
    ) {
        self.processManager = processManager
        self.settingsStore = settingsStore
        self.installationManager = installationManager
    }

    func activate(_ record: AgerbotCurrentModelRecord) async -> Bool {
        await processManager.stop()
        settingsStore.settings.checkpointPath = record.checkpointPath
        settingsStore.settings.activeModelVersion = record.activeVersion
        settingsStore.settings.previousModelVersion = record.previousVersion
        installationManager.refresh(using: settingsStore.settings)
        await processManager.start(
            settings: settingsStore.settings,
            installationStatus: installationManager.status
        )
        guard case let .ready(health) = processManager.state else { return false }
        return health.model.version == record.activeVersion
    }
}
