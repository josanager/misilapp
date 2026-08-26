import Darwin
import Foundation

@MainActor
final class AgerbotProcessManager: ObservableObject {
    static let shared = AgerbotProcessManager()

    @Published private(set) var state: AgerbotRuntimeState = .stopped
    @Published private(set) var lastDiagnostic: String?

    private let client = AgerbotRuntimeClient()
    private var managedProcess: Process?
    private var diagnosticPipe: Pipe?
    private var startTask: Task<Void, Never>?

    private init() { }

    func start(
        settings: AgerbotSettings,
        installationStatus: AgerbotInstallationStatus
    ) async {
        if state.isReady { return }
        if let startTask {
            await startTask.value
            return
        }
        let task = Task { @MainActor [weak self] in
            guard let self else { return }
            await self.performStart(settings: settings, installationStatus: installationStatus)
        }
        startTask = task
        await task.value
        startTask = nil
    }

    func stop() async {
        startTask?.cancel()
        startTask = nil
        guard let process = managedProcess else {
            state = .stopped
            return
        }
        state = .stopping
        process.terminate()
        for _ in 0 ..< 30 where process.isRunning {
            try? await Task.sleep(for: .milliseconds(100))
        }
        if process.isRunning {
            kill(process.processIdentifier, SIGKILL)
        }
        diagnosticPipe?.fileHandleForReading.readabilityHandler = nil
        diagnosticPipe = nil
        managedProcess = nil
        state = .stopped
    }

    func stopForApplicationTermination() {
        startTask?.cancel()
        startTask = nil
        guard let process = managedProcess, process.isRunning else { return }
        process.terminate()
    }

    private func performStart(
        settings: AgerbotSettings,
        installationStatus: AgerbotInstallationStatus
    ) async {
        lastDiagnostic = nil
        if let health = try? await client.health(), health.model.loaded == true {
            state = .ready(health)
            return
        }
        if await client.hasHTTPServiceOnRuntimePort() {
            state = .portConflict
            return
        }
        guard case .developmentReady = installationStatus else {
            switch installationStatus {
            case .notInstalled:
                state = .notInstalled
            case let .invalid(message):
                state = .unavailable(message)
            case .developmentReady:
                break
            }
            return
        }

        state = .starting(progress: 0.12, detail: "Preparando el proceso local")
        guard let launch = resolveLaunch(projectPath: settings.projectPath) else {
            state = .unavailable("No se encontró Python o uv para iniciar Agerbot.")
            return
        }

        let process = Process()
        process.executableURL = launch.executable
        process.arguments = launch.arguments
        process.currentDirectoryURL = URL(fileURLWithPath: settings.projectPath, isDirectory: true)
        var environment = ProcessInfo.processInfo.environment
        environment["AGERBOT_CHECKPOINT"] = settings.checkpointPath
        environment["AGERBOT_HOST"] = "127.0.0.1"
        environment["AGERBOT_PORT"] = "4318"
        environment["AGERBOT_DEVICE"] = "auto"
        environment["PYTHONUNBUFFERED"] = "1"
        process.environment = environment
        process.standardOutput = FileHandle.nullDevice

        let pipe = Pipe()
        process.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            Task { @MainActor [weak self] in self?.appendDiagnostic(text) }
        }
        process.terminationHandler = { [weak self, weak process] _ in
            Task { @MainActor [weak self, weak process] in
                guard let self, let process, self.managedProcess === process else { return }
                self.diagnosticPipe?.fileHandleForReading.readabilityHandler = nil
                self.diagnosticPipe = nil
                self.managedProcess = nil
                if case .stopping = self.state {
                    self.state = .stopped
                } else if !self.state.isReady {
                    self.state = .failed(self.lastDiagnostic ?? "El proceso de Agerbot terminó durante el arranque.")
                } else {
                    self.state = .failed("Agerbot se cerró inesperadamente. Puedes reiniciarlo desde MISIL.")
                }
            }
        }

        do {
            try process.run()
            managedProcess = process
            diagnosticPipe = pipe
        } catch {
            pipe.fileHandleForReading.readabilityHandler = nil
            state = .failed("MISIL no pudo iniciar el proceso de Agerbot.")
            return
        }

        state = .loading(progress: 0.28, detail: "Verificando y cargando el checkpoint")
        for attempt in 1 ... 80 {
            if Task.isCancelled {
                await stop()
                return
            }
            if !process.isRunning {
                state = .failed(lastDiagnostic ?? "Agerbot terminó antes de quedar disponible.")
                return
            }
            if let health = try? await client.health(), health.model.loaded == true {
                state = .ready(health)
                return
            }
            let progress = min(0.92, 0.28 + Double(attempt) / 120)
            state = .loading(progress: progress, detail: "Cargando Agerbot en memoria")
            try? await Task.sleep(for: .milliseconds(250))
        }
        let timeoutMessage = "Agerbot no quedó listo dentro del tiempo permitido."
        await stop()
        state = .failed(timeoutMessage)
    }

    private func resolveLaunch(projectPath: String) -> (executable: URL, arguments: [String])? {
        let project = URL(fileURLWithPath: projectPath, isDirectory: true)
        let virtualPython = project.appendingPathComponent(".venv/bin/python")
        if FileManager.default.isExecutableFile(atPath: virtualPython.path) {
            return (virtualPython, ["-m", "agerbot.server"])
        }
        for uvPath in ["/opt/homebrew/bin/uv", "/usr/local/bin/uv"]
            where FileManager.default.isExecutableFile(atPath: uvPath) {
            return (URL(fileURLWithPath: uvPath), ["run", "agerbot-serve"])
        }
        return nil
    }

    private func appendDiagnostic(_ text: String) {
        let compact = text
            .split(whereSeparator: { $0.isNewline })
            .map(String.init)
            .filter { !$0.isEmpty }
            .suffix(4)
            .joined(separator: " · ")
        guard !compact.isEmpty else { return }
        lastDiagnostic = String(compact.suffix(1_500))
    }
}
