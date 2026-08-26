import Foundation

@MainActor
final class AgerbotInstallationManager: ObservableObject {
    @Published private(set) var status: AgerbotInstallationStatus = .notInstalled
    @Published private(set) var availableModels: [AgerbotModelCandidate] = []
    @Published private(set) var selectedModel: AgerbotModelCandidate?
    @Published private(set) var isDiscovering = false
    @Published private(set) var discoveryMessage: String?

    private let discoveryService: AgerbotModelDiscoveryService
    let managedRoot: URL

    init(
        discoveryService: AgerbotModelDiscoveryService = AgerbotModelDiscoveryService(),
        managedRoot: URL? = nil
    ) {
        self.discoveryService = discoveryService
        self.managedRoot = managedRoot ?? FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first!
            .appendingPathComponent("MISIL", isDirectory: true)
            .appendingPathComponent("Agerbot", isDirectory: true)
    }

    func discover(using settings: AgerbotSettings) async -> AgerbotModelCandidate? {
        isDiscovering = true
        defer { isDiscovering = false }
        let developmentProject: URL?
        if settings.projectPath.isEmpty {
            developmentProject = AgerbotDevelopmentLocator.projectURL()
        } else {
            developmentProject = URL(fileURLWithPath: settings.projectPath, isDirectory: true)
        }
        let candidates = await discoveryService.discover(
            managedRoot: managedRoot,
            developmentProject: developmentProject
        )
        availableModels = candidates

        let selected: AgerbotModelCandidate?
        if !settings.automaticModelUpdates,
           let current = candidates.first(where: { $0.checkpointURL.path == settings.checkpointPath }) {
            selected = current
        } else {
            selected = await discoveryService.select(
                from: candidates,
                pinnedVersion: settings.pinnedModelVersion,
                automaticUpdates: settings.automaticModelUpdates,
                allowPrerelease: settings.allowPrereleaseModels
            )
        }
        selectedModel = selected
        if let selected {
            status = .developmentReady(modelVersion: selected.manifest.model.version)
            discoveryMessage = "Seleccionado Agerbot \(selected.manifest.model.version) · \(selected.manifest.model.tokenizer)"
        } else {
            status = .notInstalled
            discoveryMessage = "No se encontró un modelo estable compatible y verificado."
        }
        return selected
    }

    func refresh(using settings: AgerbotSettings) {
        let project = URL(fileURLWithPath: settings.projectPath, isDirectory: true)
        let checkpoint = URL(fileURLWithPath: settings.checkpointPath)
        guard !settings.projectPath.isEmpty,
              FileManager.default.fileExists(atPath: project.path) else {
            status = .notInstalled
            return
        }
        guard FileManager.default.fileExists(atPath: project.appendingPathComponent("pyproject.toml").path),
              FileManager.default.fileExists(atPath: project.appendingPathComponent("src/agerbot/server.py").path) else {
            status = .invalid("La carpeta elegida no contiene un runtime Agerbot compatible.")
            return
        }
        guard checkpoint.pathExtension == "pt",
              FileManager.default.fileExists(atPath: checkpoint.path) else {
            status = .invalid("No se encontró el checkpoint configurado.")
            return
        }
        let manifestURL = checkpoint.deletingLastPathComponent().appendingPathComponent("manifest.json")
        guard let data = try? Data(contentsOf: manifestURL),
              let manifest = try? JSONDecoder().decode(CheckpointManifest.self, from: data),
              manifest.checkpoint.filename == checkpoint.lastPathComponent,
              let attributes = try? FileManager.default.attributesOfItem(atPath: checkpoint.path),
              let size = attributes[.size] as? NSNumber,
              size.uint64Value == manifest.checkpoint.sizeBytes else {
            status = .invalid("El checkpoint no tiene un manifiesto válido. Agerbot verificará también su SHA-256.")
            return
        }
        status = .developmentReady(modelVersion: manifest.model.version)
    }

    private struct CheckpointManifest: Decodable {
        struct Model: Decodable { let version: String }
        struct Checkpoint: Decodable {
            let filename: String
            let sizeBytes: UInt64
        }
        let model: Model
        let checkpoint: Checkpoint
    }
}
