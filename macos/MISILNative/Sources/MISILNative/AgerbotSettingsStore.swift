import Foundation

@MainActor
final class AgerbotSettingsStore: ObservableObject {
    @Published var settings: AgerbotSettings {
        didSet { save() }
    }

    private let fileURL: URL

    init(fileURL: URL? = nil) {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first!.appendingPathComponent("MISIL", isDirectory: true)
        self.fileURL = fileURL ?? directory.appendingPathComponent("agerbot-settings.json")
        if let data = try? Data(contentsOf: self.fileURL),
           let decoded = try? JSONDecoder().decode(AgerbotSettings.self, from: data) {
            settings = decoded
        } else {
            let developmentProject = AgerbotDevelopmentLocator.projectURL()
            settings = AgerbotSettings(
                projectPath: developmentProject?.path ?? "",
                checkpointPath: "",
                startWithMISIL: developmentProject != nil
            )
        }
    }

    func updateProjectPath(_ path: String) {
        settings.projectPath = path
    }

    func updateCheckpointPath(_ path: String) {
        settings.checkpointPath = path
    }

    func applyDiscoveredModel(_ candidate: AgerbotModelCandidate) {
        let newVersion = candidate.manifest.model.version
        let oldVersion = settings.activeModelVersion
        if oldVersion != nil, oldVersion != newVersion {
            settings.previousModelVersion = oldVersion
        } else if oldVersion == nil,
                  !settings.checkpointPath.isEmpty,
                  settings.checkpointPath != candidate.checkpointURL.path {
            settings.previousModelVersion = "0.1.0"
        }
        settings.activeModelVersion = newVersion
        settings.checkpointPath = candidate.checkpointURL.path
        if candidate.source == .development {
            settings.projectPath = candidate.manifestURL
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent().path
        }
    }

    func pin(version: String?) {
        settings.pinnedModelVersion = version
        settings.automaticModelUpdates = version == nil
    }

    func setPreviousVersionIfMissing(_ version: String?) {
        guard settings.previousModelVersion == nil,
              let version,
              version != settings.activeModelVersion else { return }
        settings.previousModelVersion = version
    }

    private func save() {
        let directory = fileURL.deletingLastPathComponent()
        do {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700]
            )
            let data = try JSONEncoder().encode(settings)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtection])
        } catch {
            // Los ajustes no contienen conversaciones ni secretos. La interfaz
            // vuelve a mostrar los valores actuales aunque falle la persistencia.
        }
    }
}
