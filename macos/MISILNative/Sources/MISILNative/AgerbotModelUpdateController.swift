import Foundation

@MainActor
final class AgerbotModelUpdateController: ObservableObject {
    @Published private(set) var phase: AgerbotModelUpdatePhase = .idle("Sin comprobar")
    @Published private(set) var availableVersion: String?
    @Published private(set) var availableSizeBytes: UInt64?
    @Published private(set) var shaVerified = false

    private let releaseService: AgerbotReleaseService
    private let downloadService: AgerbotModelDownloadService
    private let stager: AgerbotArtifactStager
    private let validator: AgerbotCandidateValidator
    private let settingsStore: AgerbotSettingsStore
    private let installationManager: AgerbotInstallationManager
    private let currentStore: AgerbotCurrentModelStore
    private let failedStore: AgerbotFailedVersionStore
    private let activationEngine: AgerbotAtomicActivationEngine
    private let runtimeActivator: AgerbotManagedRuntimeActivator
    private var remoteCandidate: AgerbotRemoteModelCandidate?
    private var operationTask: Task<Void, Never>?

    init(
        releaseService: AgerbotReleaseService = AgerbotReleaseService(),
        downloadService: AgerbotModelDownloadService,
        stager: AgerbotArtifactStager = AgerbotArtifactStager(),
        validator: AgerbotCandidateValidator,
        settingsStore: AgerbotSettingsStore,
        installationManager: AgerbotInstallationManager,
        currentStore: AgerbotCurrentModelStore,
        failedStore: AgerbotFailedVersionStore,
        activationEngine: AgerbotAtomicActivationEngine,
        runtimeActivator: AgerbotManagedRuntimeActivator
    ) {
        self.releaseService = releaseService
        self.downloadService = downloadService
        self.stager = stager
        self.validator = validator
        self.settingsStore = settingsStore
        self.installationManager = installationManager
        self.currentStore = currentStore
        self.failedStore = failedStore
        self.activationEngine = activationEngine
        self.runtimeActivator = runtimeActivator
    }

    var progress: Double { downloadService.progress }
    var isDownloading: Bool { downloadService.isDownloading }

    func scheduleAutomaticCheck() {
        guard settingsStore.settings.automaticModelUpdates else { return }
        startCheck(force: false)
    }

    func startCheck(force: Bool = true) {
        guard operationTask == nil else { return }
        operationTask = Task { [weak self] in
            guard let self else { return }
            await self.checkForUpdates(force: force)
            self.operationTask = nil
        }
    }

    func cancelDownload() {
        downloadService.cancel()
        operationTask?.cancel()
        operationTask = nil
        phase = .cancelled
    }

    func installAvailableUpdate() {
        guard let candidate = remoteCandidate, operationTask == nil else { return }
        operationTask = Task { [weak self] in
            guard let self else { return }
            await self.downloadVerifyAndActivate(candidate)
            self.operationTask = nil
        }
    }

    func rollbackToPrevious() {
        guard let previousVersion = settingsStore.settings.previousModelVersion,
              operationTask == nil else { return }
        operationTask = Task { [weak self] in
            guard let self else { return }
            self.phase = .rollingBack(previousVersion)
            if let candidate = self.installationManager.availableModels.first(where: {
                $0.manifest.model.version == previousVersion
            }) {
                let current = await self.currentRecordFromSettings()
                let target = AgerbotCurrentModelRecord(
                    activeVersion: previousVersion,
                    previousVersion: current?.activeVersion,
                    activatedAt: Date(),
                    checkpointPath: candidate.checkpointURL.path,
                    manifestPath: candidate.manifestURL.path
                )
                let success = await self.activationEngine.activate(
                    candidate: target,
                    previous: current,
                    runtime: self.runtimeActivator
                )
                self.phase = success ? .installed(previousVersion) : .failed("No se pudo volver al modelo anterior.")
            } else {
                self.phase = .failed("La versión anterior ya no está disponible localmente.")
            }
            self.operationTask = nil
        }
    }

    private func checkForUpdates(force: Bool) async {
        if !force, let last = settingsStore.settings.lastUpdateCheckAt,
           Date().timeIntervalSince(last) < 6 * 60 * 60 {
            phase = .idle("Comprobación reciente")
            return
        }
        phase = .checking
        settingsStore.settings.lastUpdateCheckAt = Date()
        do {
            let candidate = try await releaseService.latestCompatible(
                installedVersion: settingsStore.settings.activeModelVersion,
                allowPrerelease: settingsStore.settings.allowPrereleaseModels
            )
            let version = candidate.manifest.release.version
            if await failedStore.contains(version) {
                phase = .failed("Agerbot \(version) falló anteriormente y no se reinstalará automáticamente.")
                return
            }
            remoteCandidate = candidate
            availableVersion = version
            availableSizeBytes = candidate.manifest.artifact.sizeBytes
            phase = .available(version: version, sizeBytes: candidate.manifest.artifact.sizeBytes)
            if settingsStore.settings.automaticModelUpdates {
                await downloadVerifyAndActivate(candidate)
            }
        } catch AgerbotReleaseError.noPublishedRelease {
            phase = .idle("No hay una release pública de Agerbot")
        } catch AgerbotReleaseError.notNewer {
            phase = .idle("Agerbot está actualizado")
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    private func downloadVerifyAndActivate(_ candidate: AgerbotRemoteModelCandidate) async {
        let version = candidate.manifest.release.version
        let downloads = installationManager.managedRoot.appendingPathComponent("downloads", isDirectory: true)
        let staging = downloads.appendingPathComponent("staging", isDirectory: true)
        phase = .downloading(version: version, progress: 0)
        let progressTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                self.phase = .downloading(version: version, progress: self.downloadService.progress)
                try? await Task.sleep(for: .milliseconds(150))
            }
        }
        do {
            let downloaded = try await downloadService.download(
                asset: candidate.checkpointAsset,
                to: downloads
            )
            progressTask.cancel()
            phase = .verifying("Comprobando tamaño y SHA-256")
            let stagedModel = try await stager.verifyAndStage(
                downloadedFile: downloaded,
                candidate: candidate,
                stagingRoot: staging
            )
            shaVerified = true
            let installed = try await prepareInstallation(candidate: candidate, stagedModel: stagedModel)
            phase = .verifying("Cargando el modelo candidato en un proceso aislado")
            let valid = await validator.validate(
                checkpointURL: installed.checkpointURL,
                expectedVersion: version,
                projectPath: settingsStore.settings.projectPath
            )
            guard valid else {
                try? await failedStore.markFailed(version: version, reason: "Falló la validación de carga, salud o generación.")
                phase = .failed("El modelo candidato no superó la prueba de runtime.")
                return
            }
            phase = .waitingForConversation
            let previous = await currentRecordFromSettings()
            let record = AgerbotCurrentModelRecord(
                activeVersion: version,
                previousVersion: previous?.activeVersion,
                activatedAt: Date(),
                checkpointPath: installed.checkpointURL.path,
                manifestPath: installed.manifestURL.path
            )
            phase = .activating(version)
            let success = await activationEngine.activate(
                candidate: record,
                previous: previous,
                runtime: runtimeActivator
            )
            if success {
                phase = .installed(version)
                _ = await installationManager.discover(using: settingsStore.settings)
            } else {
                phase = .rollingBack(previous?.activeVersion ?? "modelo anterior")
                phase = .failed("La activación falló; MISIL restauró el modelo anterior.")
            }
        } catch is CancellationError {
            progressTask.cancel()
            phase = .cancelled
        } catch {
            progressTask.cancel()
            phase = .failed(error.localizedDescription)
        }
    }

    private func prepareInstallation(
        candidate: AgerbotRemoteModelCandidate,
        stagedModel: URL
    ) async throws -> AgerbotModelCandidate {
        let version = candidate.manifest.release.version
        let modelsRoot = installationManager.managedRoot.appendingPathComponent("models", isDirectory: true)
        let finalDirectory = modelsRoot.appendingPathComponent(version, isDirectory: true)
        let checkpointURL = finalDirectory.appendingPathComponent("model.pt")
        let manifestURL = finalDirectory.appendingPathComponent("manifest.json")
        if !FileManager.default.fileExists(atPath: checkpointURL.path) {
            try FileManager.default.createDirectory(at: modelsRoot, withIntermediateDirectories: true)
            let temporary = modelsRoot.appendingPathComponent(".candidate-\(UUID().uuidString)", isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
                try FileManager.default.copyItem(at: stagedModel, to: temporary.appendingPathComponent("model.pt"))
                let localManifest = AgerbotModelManifest(
                    schemaVersion: 2,
                    channel: candidate.manifest.channel,
                    model: .init(
                        name: candidate.manifest.model.name,
                        version: version,
                        trainingName: candidate.manifest.model.trainingName,
                        architecture: candidate.manifest.model.architecture,
                        tokenizer: candidate.manifest.model.tokenizer,
                        parameters: candidate.manifest.model.parameters,
                        contextLength: candidate.manifest.model.contextLength
                    ),
                    runtime: .init(
                        minimumVersion: candidate.manifest.runtime.minimumVersion,
                        maximumVersion: candidate.manifest.runtime.maximumVersion
                    ),
                    checkpoint: .init(
                        filename: "model.pt",
                        sizeBytes: candidate.manifest.artifact.sizeBytes,
                        sha256: candidate.manifest.artifact.sha256
                    ),
                    compatibility: .init(
                        devices: candidate.manifest.compatibility.devices,
                        platforms: candidate.manifest.compatibility.platforms
                    ),
                    publishedAt: candidate.manifest.release.publishedAt
                )
                let encoder = JSONEncoder()
                encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
                try encoder.encode(localManifest).write(
                    to: temporary.appendingPathComponent("manifest.json"),
                    options: .atomic
                )
                let evaluationDownload = try await downloadService.download(
                    asset: candidate.evaluationAsset,
                    to: installationManager.managedRoot.appendingPathComponent("downloads", isDirectory: true)
                )
                try FileManager.default.copyItem(
                    at: evaluationDownload,
                    to: temporary.appendingPathComponent("evaluation.json")
                )
                try FileManager.default.moveItem(at: temporary, to: finalDirectory)
            } catch {
                try? FileManager.default.removeItem(at: temporary)
                throw error
            }
        }
        return AgerbotModelCandidate(
            manifest: AgerbotModelManifest(
                schemaVersion: 2,
                channel: candidate.manifest.channel,
                model: .init(
                    name: candidate.manifest.model.name,
                    version: version,
                    trainingName: candidate.manifest.model.trainingName,
                    architecture: candidate.manifest.model.architecture,
                    tokenizer: candidate.manifest.model.tokenizer,
                    parameters: candidate.manifest.model.parameters,
                    contextLength: candidate.manifest.model.contextLength
                ),
                runtime: .init(
                    minimumVersion: candidate.manifest.runtime.minimumVersion,
                    maximumVersion: candidate.manifest.runtime.maximumVersion
                ),
                checkpoint: .init(
                    filename: "model.pt",
                    sizeBytes: candidate.manifest.artifact.sizeBytes,
                    sha256: candidate.manifest.artifact.sha256
                ),
                compatibility: .init(
                    devices: candidate.manifest.compatibility.devices,
                    platforms: candidate.manifest.compatibility.platforms
                ),
                publishedAt: candidate.manifest.release.publishedAt
            ),
            manifestURL: manifestURL,
            checkpointURL: checkpointURL,
            source: .managed
        )
    }

    private func currentRecordFromSettings() async -> AgerbotCurrentModelRecord? {
        if let stored = await currentStore.load() { return stored }
        guard let version = settingsStore.settings.activeModelVersion,
              !settingsStore.settings.checkpointPath.isEmpty else { return nil }
        let checkpoint = URL(fileURLWithPath: settingsStore.settings.checkpointPath)
        return AgerbotCurrentModelRecord(
            activeVersion: version,
            previousVersion: settingsStore.settings.previousModelVersion,
            activatedAt: Date(),
            checkpointPath: checkpoint.path,
            manifestPath: checkpoint.deletingLastPathComponent().appendingPathComponent("manifest.json").path
        )
    }
}
