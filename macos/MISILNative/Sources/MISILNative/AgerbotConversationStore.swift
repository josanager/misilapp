import Foundation

@MainActor
final class AgerbotConversationStore: ObservableObject {
    @Published private(set) var messages: [AgerbotLocalMessage] = []
    @Published private(set) var state: AgerbotConversationState = .idle

    private let client: AgerbotRuntimeClient
    private let processManager: AgerbotProcessManager
    private let settingsStore: AgerbotSettingsStore
    private let installationManager: AgerbotInstallationManager
    private let activationGate: AgerbotActivationGate
    private let fileURL: URL
    private var generationTask: Task<Void, Never>?

    init(
        client: AgerbotRuntimeClient,
        processManager: AgerbotProcessManager,
        settingsStore: AgerbotSettingsStore,
        installationManager: AgerbotInstallationManager,
        activationGate: AgerbotActivationGate,
        fileURL: URL? = nil
    ) {
        self.client = client
        self.processManager = processManager
        self.settingsStore = settingsStore
        self.installationManager = installationManager
        self.activationGate = activationGate
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first!.appendingPathComponent("MISIL", isDirectory: true)
        self.fileURL = fileURL ?? directory.appendingPathComponent("agerbot-conversation.json")
        load()
    }

    var isGenerating: Bool {
        switch state {
        case .starting, .thinking, .cancelling: true
        default: false
        }
    }

    func send(_ content: String) {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, generationTask == nil else { return }

        let history = messages.suffix(16).map {
            AgerbotHistoryItem(role: $0.role.rawValue, content: $0.content)
        }
        append(AgerbotLocalMessage(id: UUID(), role: .user, content: trimmed, createdAt: Date()))
        state = processManager.state.isReady ? .thinking : .starting

        generationTask = Task { [weak self] in
            guard let self else { return }
            await self.performSend(message: trimmed, history: history)
        }
    }

    func cancelGeneration() {
        guard generationTask != nil else { return }
        state = .cancelling
        generationTask?.cancel()
        Task { [client] in _ = try? await client.cancel() }
    }

    func retryRuntime() {
        guard generationTask == nil else { return }
        state = .starting
        Task { [weak self] in
            guard let self else { return }
            self.installationManager.refresh(using: self.settingsStore.settings)
            await self.processManager.start(
                settings: self.settingsStore.settings,
                installationStatus: self.installationManager.status
            )
            self.state = self.processManager.state.isReady
                ? .idle
                : .unavailable(self.runtimeStateMessage)
        }
    }

    private func performSend(message: String, history: [AgerbotHistoryItem]) async {
        defer { generationTask = nil }
        if !processManager.state.isReady {
            installationManager.refresh(using: settingsStore.settings)
            await processManager.start(
                settings: settingsStore.settings,
                installationStatus: installationManager.status
            )
        }
        guard processManager.state.isReady else {
            state = .unavailable(runtimeStateMessage)
            return
        }
        if Task.isCancelled {
            state = .idle
            return
        }
        state = .thinking
        await activationGate.beginGeneration()
        do {
            let response = try await client.chat(AgerbotChatRequest(
                conversationId: agerbotReservedConversationID,
                message: message,
                history: history,
                generation: settingsStore.settings.generation
            ))
            append(AgerbotLocalMessage(
                id: UUID(),
                role: .assistant,
                content: response.message.content,
                createdAt: Date()
            ))
            state = .idle
        } catch is CancellationError {
            _ = try? await client.cancel()
            state = .idle
        } catch {
            state = .failed(error.localizedDescription)
        }
        await activationGate.endGeneration()
    }

    private var runtimeStateMessage: String {
        switch processManager.state {
        case .notInstalled:
            "Agerbot no está instalado o no se ha elegido su carpeta local."
        case .portConflict:
            "El puerto local 4318 está ocupado por otro servicio."
        case let .unavailable(message), let .failed(message):
            message
        default:
            "El runtime de Agerbot no está disponible."
        }
    }

    private func append(_ message: AgerbotLocalMessage) {
        messages.append(message)
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let decoded = try? decoder.decode([AgerbotLocalMessage].self, from: data) else { return }
        messages = decoded.sorted { $0.createdAt < $1.createdAt }
    }

    private func save() {
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700]
            )
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(messages)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtection])
        } catch {
            state = .failed("MISIL no pudo guardar la conversación local de Agerbot.")
        }
    }
}
