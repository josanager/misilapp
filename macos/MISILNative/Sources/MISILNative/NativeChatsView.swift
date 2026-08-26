import AppKit
import Foundation
import SwiftUI

struct NativeMessage: Codable, Identifiable, Equatable {
    let id: UUID
    let content: String
    let createdAt: Date
    let senderID: UUID?
    let senderName: String?
    let peerUsername: String
    let isOutgoing: Bool
}

@MainActor
final class NativeConversationStore: ObservableObject {
    @Published private(set) var messages: [NativeMessage] = []
    @Published private(set) var connectionStatus: MessagingConnectionStatus = .connecting
    @Published private(set) var activeRecipient: String?
    @Published private(set) var messagingError: String?

    let identity: MessagingIdentity
    private let client: InternetMessagingClient
    private let fileURL: URL
    private var connectionTask: Task<Void, Never>?

    init() {
        identity = MessagingIdentityStore.loadOrCreate()
        client = InternetMessagingClient(identity: identity)
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first!.appendingPathComponent("MISIL", isDirectory: true)
        fileURL = directory.appendingPathComponent("internet-messages.json")
        load()
        connectionTask = Task { [weak self] in await self?.runConnectionLoop() }
    }

    var personalLink: String { identity.personalLink }

    func selectRecipient(_ value: String) -> Bool {
        var candidate = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let url = URL(string: candidate), url.scheme == "misil", url.host == "contacto" {
            candidate = url.pathComponents.dropFirst().first ?? ""
        }
        candidate = String(candidate.drop(while: { $0 == "@" }))
        guard candidate.range(of: "^[a-z0-9][a-z0-9_-]{2,31}$", options: .regularExpression) != nil else {
            messagingError = "Pega un enlace MISIL válido o escribe un nombre de usuario."
            return false
        }
        activeRecipient = candidate
        messagingError = nil
        return true
    }

    func send(_ content: String) async {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard let activeRecipient else {
            messagingError = "Primero conecta un contacto mediante su enlace personal."
            return
        }
        let message = NativeMessage(
            id: UUID(),
            content: trimmed,
            createdAt: Date(),
            senderID: UUID(uuidString: identity.deviceId),
            senderName: identity.displayName,
            peerUsername: activeRecipient,
            isOutgoing: true
        )
        do {
            try await client.send(recipient: activeRecipient, content: trimmed, id: message.id, createdAt: message.createdAt)
            append(message)
            messagingError = nil
        } catch {
            messagingError = error.localizedDescription
        }
    }

    private func runConnectionLoop() async {
        while !Task.isCancelled {
            connectionStatus = .connecting
            do {
                try await client.connect()
                connectionStatus = .online
                messagingError = nil
                while !Task.isCancelled {
                    let incoming = try await client.receive()
                    incoming.forEach(appendIncoming)
                }
            } catch is CancellationError {
                break
            } catch {
                connectionStatus = .offline
                messagingError = error.localizedDescription
            }
            await client.disconnect()
            if Task.isCancelled { break }
            try? await Task.sleep(for: .seconds(3))
        }
    }

    private func appendIncoming(_ hubMessage: HubMessage) {
        guard let id = UUID(uuidString: hubMessage.id), messages.contains(where: { $0.id == id }) == false else { return }
        let date = ISO8601DateFormatter().date(from: hubMessage.createdAt) ?? Date()
        if activeRecipient == nil { activeRecipient = hubMessage.senderUsername }
        append(NativeMessage(
            id: id,
            content: hubMessage.content,
            createdAt: date,
            senderID: nil,
            senderName: hubMessage.senderDisplayName,
            peerUsername: hubMessage.senderUsername,
            isOutgoing: false
        ))
    }

    private func append(_ message: NativeMessage) {
        guard messages.contains(where: { $0.id == message.id }) == false else { return }
        messages.append(message)
        messages.sort { $0.createdAt < $1.createdAt }
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let decoded = try? decoder.decode([NativeMessage].self, from: data) else { return }
        messages = decoded.sorted { $0.createdAt < $1.createdAt }
        activeRecipient = messages.last?.peerUsername
    }

    private func save() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(messages) else { return }
        try? data.write(to: fileURL, options: [.atomic, .completeFileProtection])
    }
}

struct NativeChatsView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var conversation = NativeConversationStore()
    @State private var draft = ""
    @State private var contactInput = ""
    @State private var copied = false
    @State private var selection = NativeChatSelection.agerbot

    var body: some View {
        HSplitView {
            VStack(spacing: 0) {
                DetailHeader(title: "Chats", subtitle: "Personas y modelos locales")

                Button { selection = .agerbot } label: {
                    AgerbotContactRow(
                        store: appState.agerbotConversationStore,
                        processManager: appState.agerbotProcessManager,
                        isSelected: selection == .agerbot
                    )
                }
                .buttonStyle(.plain)

                Button { selection = .human } label: {
                    HStack(spacing: 11) {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(MISILTheme.accent).frame(width: 36, height: 36)
                            .overlay { Text("MI").font(.system(size: 12, weight: .bold)).foregroundStyle(.white) }
                        VStack(alignment: .leading, spacing: 3) {
                            Text(conversation.activeRecipient.map { "@\($0)" } ?? "Nuevo contacto")
                                .font(.system(size: 13, weight: .semibold))
                            Text(conversation.messages.last?.content ?? "Chat por Internet")
                                .font(.system(size: 11)).foregroundStyle(MISILTheme.textMuted).lineLimit(1)
                        }
                        Spacer()
                    }
                    .padding(12)
                    .background(selection == .human ? MISILTheme.active.opacity(0.55) : Color.clear)
                }
                .buttonStyle(.plain)
                Spacer()
                identityPanel
            }
            .frame(minWidth: 245, idealWidth: 280, maxWidth: 330)
            .background(MISILTheme.sidebar)

            Group {
                switch selection {
                case .agerbot:
                    AgerbotChatView(
                        store: appState.agerbotConversationStore,
                        processManager: appState.agerbotProcessManager,
                        updateController: appState.agerbotUpdateController
                    )
                case .human:
                    VStack(spacing: 0) {
                        DetailHeader(
                            title: "Mensajes",
                            subtitle: conversation.activeRecipient.map { "Conversación con @\($0)" } ?? "Pega el enlace personal de otro equipo"
                        )
                        messageList
                        inputBar
                    }
                }
            }
            .background(MISILTheme.background)
        }
    }

    private var identityPanel: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 7) {
                Circle().fill(statusColor).frame(width: 8, height: 8)
                Text(statusText).font(.system(size: 9, weight: .bold)).foregroundStyle(MISILTheme.textSecondary)
                Spacer()
                Button(copied ? "Copiado" : "Copiar enlace") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(conversation.personalLink, forType: .string)
                    copied = true
                }.buttonStyle(.bordered).controlSize(.small).tint(MISILTheme.accent)
            }
            Text("TU IDENTIDAD").font(.system(size: 9, weight: .bold)).foregroundStyle(MISILTheme.textMuted)
            Text(conversation.personalLink).font(.system(size: 9, design: .monospaced)).foregroundStyle(MISILTheme.textSecondary).lineLimit(1).truncationMode(.middle)
            TextField("Enlace personal o usuario", text: $contactInput)
                .textFieldStyle(.plain).font(.system(size: 11)).padding(.horizontal, 10).frame(height: 34)
                .background(MISILTheme.surface).clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            Button("Conectar contacto") {
                if conversation.selectRecipient(contactInput) { contactInput = "" }
            }
            .buttonStyle(.bordered).tint(MISILTheme.accent).frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(14)
        .overlay(alignment: .top) { Rectangle().fill(MISILTheme.border).frame(height: 1) }
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .trailing, spacing: 9) {
                    if conversation.messages.isEmpty {
                        VStack(spacing: 10) {
                            Image(systemName: "point.3.connected.trianglepath.dotted").font(.system(size: 28)).foregroundStyle(MISILTheme.accent)
                            Text("Conecta tu primer equipo").font(.system(size: 14, weight: .medium))
                            Text("Pega su enlace MISIL para enviar mensajes por Internet.").font(.system(size: 12)).foregroundStyle(MISILTheme.textMuted)
                        }.frame(maxWidth: .infinity).padding(.top, 120)
                    }
                    ForEach(conversation.messages) { message in
                        VStack(alignment: message.isOutgoing ? .trailing : .leading, spacing: 4) {
                            Text(message.senderName ?? message.peerUsername).font(.system(size: 10, weight: .semibold)).foregroundStyle(MISILTheme.accent)
                            Text(message.content).font(.system(size: 14)).textSelection(.enabled)
                            Text(message.createdAt.formatted(date: .omitted, time: .shortened)).font(.system(size: 9, design: .monospaced)).foregroundStyle(MISILTheme.textMuted)
                        }
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .background(message.isOutgoing ? MISILTheme.active : MISILTheme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .frame(maxWidth: 440, alignment: message.isOutgoing ? .trailing : .leading)
                        .frame(maxWidth: .infinity, alignment: message.isOutgoing ? .trailing : .leading)
                        .id(message.id)
                    }
                }.padding(20)
            }
            .onChange(of: conversation.messages) { _, messages in
                if let id = messages.last?.id { withAnimation(.easeOut(duration: 0.15)) { proxy.scrollTo(id) } }
            }
        }
    }

    private var inputBar: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 10) {
                TextField("Escribe un mensaje", text: $draft)
                    .textFieldStyle(.plain).font(.system(size: 14)).padding(.horizontal, 12).frame(height: 38)
                    .background(MISILTheme.surface).clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous)).onSubmit(send)
                Button(action: send) {
                    Image(systemName: "arrow.up").font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 36, height: 36).background(MISILTheme.accent).clipShape(Circle())
                }.buttonStyle(.plain).disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            if let error = conversation.messagingError { Text(error).font(.system(size: 11)).foregroundStyle(MISILTheme.danger) }
        }
        .padding(14).overlay(alignment: .top) { Rectangle().fill(MISILTheme.border).frame(height: 1) }
    }

    private var statusColor: Color {
        switch conversation.connectionStatus {
        case .online: Color.green
        case .connecting: MISILTheme.accent
        case .offline: MISILTheme.textMuted
        }
    }

    private var statusText: String {
        switch conversation.connectionStatus {
        case .online: "INTERNET CONECTADO"
        case .connecting: "CONECTANDO"
        case .offline: "SIN CONEXIÓN"
        }
    }

    private func send() {
        let content = draft
        draft = ""
        Task { await conversation.send(content) }
    }
}

private enum NativeChatSelection {
    case agerbot
    case human
}

struct DetailHeader: View {
    let title: String
    let subtitle: String?
    init(title: String, subtitle: String? = nil) { self.title = title; self.subtitle = subtitle }
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 16, weight: .bold))
                if let subtitle { Text(subtitle).font(.system(size: 10)).foregroundStyle(MISILTheme.textMuted) }
            }
            Spacer()
        }
        .padding(.horizontal, 16).frame(height: 54)
        .overlay(alignment: .bottom) { Rectangle().fill(MISILTheme.border).frame(height: 1) }
    }
}
