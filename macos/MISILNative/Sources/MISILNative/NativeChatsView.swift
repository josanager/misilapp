import Foundation
import SwiftUI

struct NativeMessage: Codable, Identifiable, Equatable {
    let id: UUID
    let content: String
    let createdAt: Date
    let senderID: UUID?
    let senderName: String?
}

@MainActor
final class NativeConversationStore: ObservableObject {
    @Published private(set) var messages: [NativeMessage] = []
    @Published private(set) var relayIdentity: NativeRelayIdentity?
    @Published private(set) var isSyncing = false
    @Published var relayError: String?
    private let fileURL: URL
    private let relay = RelayService()

    init() {
        let base = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first!.appendingPathComponent("MISIL", isDirectory: true)
        self.fileURL = base.appendingPathComponent("native-messages.json")
        try? FileManager.default.createDirectory(
            at: base,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        load()
        relayIdentity = try? KeychainService.loadRelayIdentity()
        if relayIdentity != nil { Task { await sync() } }
    }

    var isRelayConnected: Bool { relayIdentity != nil }
    var accessCode: String { relayIdentity?.accessCode ?? "" }

    func send(_ content: String) async {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if let relayIdentity {
            do {
                let sent = try await relay.send(trimmed, identity: relayIdentity)
                append(sent)
                relayError = nil
            } catch {
                relayError = error.localizedDescription
            }
        } else {
            messages.append(NativeMessage(id: UUID(), content: trimmed, createdAt: Date(), senderID: nil, senderName: nil))
            save()
        }
    }

    func createRelay(displayName: String, baseURL: String) async -> Bool {
        isSyncing = true
        defer { isSyncing = false }
        do {
            let identity = try await relay.createRoom(displayName: displayName, baseURL: baseURL)
            try KeychainService.saveRelayIdentity(identity)
            relayIdentity = identity
            messages = []
            save()
            relayError = nil
            return true
        } catch {
            relayError = error.localizedDescription
            return false
        }
    }

    func joinRelay(code: String, displayName: String, baseURL: String) async -> Bool {
        isSyncing = true
        defer { isSyncing = false }
        do {
            let identity = try await relay.joinRoom(code: code, displayName: displayName, baseURL: baseURL)
            try KeychainService.saveRelayIdentity(identity)
            relayIdentity = identity
            await sync()
            relayError = nil
            return true
        } catch {
            relayError = error.localizedDescription
            return false
        }
    }

    func sync() async {
        guard let relayIdentity else { return }
        isSyncing = true
        defer { isSyncing = false }
        do {
            messages = try await relay.messages(identity: relayIdentity).map {
                NativeMessage(id: $0.id, content: $0.content, createdAt: $0.createdAt, senderID: $0.senderID, senderName: $0.senderName)
            }
            save()
            relayError = nil
        } catch {
            relayError = error.localizedDescription
        }
    }

    func disconnectRelay() {
        try? KeychainService.deleteRelayIdentity()
        relayIdentity = nil
        messages = []
        save()
    }

    private func append(_ relayMessage: NativeRelayMessage) {
        guard messages.contains(where: { $0.id == relayMessage.id }) == false else { return }
        messages.append(NativeMessage(
            id: relayMessage.id,
            content: relayMessage.content,
            createdAt: relayMessage.createdAt,
            senderID: relayMessage.senderID,
            senderName: relayMessage.senderName
        ))
        messages.sort { $0.createdAt < $1.createdAt }
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let decoded = try? JSONDecoder().decode([NativeMessage].self, from: data)
        else { return }
        messages = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(messages) else { return }
        try? data.write(to: fileURL, options: [.atomic, .completeFileProtection])
    }
}

struct NativeChatsView: View {
    @StateObject private var conversation = NativeConversationStore()
    @State private var draft = ""
    @State private var showsRelaySetup = false

    var body: some View {
        HSplitView {
            VStack(spacing: 0) {
                DetailHeader(title: "Chats", subtitle: "Espacios de este Mac")
                Button { } label: {
                    HStack(spacing: 11) {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(MISILTheme.accent)
                            .frame(width: 36, height: 36)
                            .overlay {
                                Text("MI")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Mi espacio local")
                                .font(.system(size: 13, weight: .semibold))
                            Text(conversation.messages.last?.content ?? "Sin mensajes")
                                .font(.system(size: 11))
                                .foregroundStyle(MISILTheme.textMuted)
                                .lineLimit(1)
                        }
                        Spacer()
                    }
                    .padding(12)
                    .background(MISILTheme.active.opacity(0.55))
                }
                .buttonStyle(.plain)
                Spacer()
                Button {
                    showsRelaySetup = true
                } label: {
                    Label(conversation.isRelayConnected ? "MISIL Web conectado" : "Conectar MISIL Web", systemImage: conversation.isRelayConnected ? "checkmark.shield" : "network")
                        .font(.system(size: 12, weight: .medium))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                }
                .buttonStyle(.plain)
                .background(MISILTheme.surface)
                .overlay(alignment: .top) { Rectangle().fill(MISILTheme.border).frame(height: 1) }
            }
            .frame(minWidth: 230, idealWidth: 260, maxWidth: 300)
            .background(MISILTheme.sidebar)

            VStack(spacing: 0) {
                DetailHeader(title: "Mi espacio local", subtitle: conversation.isRelayConnected ? "General · sincronizado con MISIL Web" : "General · sólo en este Mac")

                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .trailing, spacing: 9) {
                            if conversation.messages.isEmpty {
                                VStack(spacing: 10) {
                                    Image(systemName: "bubble.left")
                                        .font(.system(size: 28))
                                        .foregroundStyle(MISILTheme.textMuted)
                                    Text("Todavía no hay mensajes")
                                        .font(.system(size: 14, weight: .medium))
                                    Text("Esta conversación de prueba se guarda localmente en tu Mac.")
                                        .font(.system(size: 12))
                                        .foregroundStyle(MISILTheme.textMuted)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.top, 120)
                            }

                            ForEach(conversation.messages) { message in
                                let isOwn = message.senderID == nil || message.senderID?.uuidString.lowercased() == conversation.relayIdentity?.deviceID
                                VStack(alignment: isOwn ? .trailing : .leading, spacing: 4) {
                                    if isOwn == false, let senderName = message.senderName {
                                        Text(senderName)
                                            .font(.system(size: 10, weight: .semibold))
                                            .foregroundStyle(MISILTheme.accent)
                                    }
                                    Text(message.content)
                                        .font(.system(size: 14))
                                        .textSelection(.enabled)
                                    Text(message.createdAt.formatted(date: .omitted, time: .shortened))
                                        .font(.system(size: 9, design: .monospaced))
                                        .foregroundStyle(MISILTheme.textMuted)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 9)
                                .background(isOwn ? MISILTheme.active : MISILTheme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .frame(maxWidth: 440, alignment: isOwn ? .trailing : .leading)
                                .frame(maxWidth: .infinity, alignment: isOwn ? .trailing : .leading)
                                .id(message.id)
                            }
                        }
                        .padding(20)
                    }
                    .onChange(of: conversation.messages) { _, messages in
                        if let id = messages.last?.id {
                            withAnimation(.easeOut(duration: 0.15)) { proxy.scrollTo(id) }
                        }
                    }
                }

                HStack(spacing: 10) {
                    TextField("Escribe un mensaje", text: $draft)
                        .textFieldStyle(.plain)
                        .font(.system(size: 14))
                        .padding(.horizontal, 12)
                        .frame(height: 38)
                        .background(MISILTheme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                        .onSubmit(send)
                    Button(action: send) {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 36, height: 36)
                            .background(MISILTheme.accent)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding(14)
                .overlay(alignment: .top) {
                    Rectangle().fill(MISILTheme.border).frame(height: 1)
                }
                if let relayError = conversation.relayError {
                    Text(relayError)
                        .font(.system(size: 11))
                        .foregroundStyle(MISILTheme.danger)
                        .padding(.horizontal, 14)
                        .padding(.bottom, 8)
                }
            }
            .background(MISILTheme.background)
        }
        .sheet(isPresented: $showsRelaySetup) {
            RelaySetupView(conversation: conversation, isPresented: $showsRelaySetup)
        }
        .task {
            while Task.isCancelled == false {
                if conversation.isRelayConnected { await conversation.sync() }
                try? await Task.sleep(for: .seconds(3))
            }
        }
    }

    private func send() {
        let content = draft
        draft = ""
        Task { await conversation.send(content) }
    }
}

private struct RelaySetupView: View {
    @ObservedObject var conversation: NativeConversationStore
    @Binding var isPresented: Bool
    @State private var mode = 0
    @State private var displayName = "Mi Mac"
    @State private var code = ""
    @State private var copied = false
    @State private var baseURL = "https://misil-web.pages.dev"

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("MISIL Web")
                        .font(.system(size: 20, weight: .bold))
                    Text("Sincroniza únicamente mensajes de texto mediante sobres cifrados temporales.")
                        .font(.system(size: 12))
                        .foregroundStyle(MISILTheme.textMuted)
                }
                Spacer()
                Button("Cerrar") { isPresented = false }
            }

            if conversation.isRelayConnected {
                Text("Código privado del espacio")
                    .font(.system(size: 12, weight: .semibold))
                Text(conversation.accessCode)
                    .font(.system(size: 10, design: .monospaced))
                    .textSelection(.enabled)
                    .padding(12)
                    .background(MISILTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                HStack {
                    Button(copied ? "Copiado" : "Copiar código") {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(conversation.accessCode, forType: .string)
                        copied = true
                    }
                    Button("Desconectar", role: .destructive) {
                        conversation.disconnectRelay()
                        isPresented = false
                    }
                }
            } else {
                Picker("Modo", selection: $mode) {
                    Text("Crear espacio").tag(0)
                    Text("Usar código").tag(1)
                }
                .pickerStyle(.segmented)

                TextField("Nombre visible", text: $displayName)
                    .textFieldStyle(.roundedBorder)
                TextField("Dirección del relay", text: $baseURL)
                    .textFieldStyle(.roundedBorder)
                if mode == 1 {
                    TextEditor(text: $code)
                        .font(.system(size: 11, design: .monospaced))
                        .frame(height: 90)
                        .padding(6)
                        .background(MISILTheme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                Button(conversation.isSyncing ? "Conectando…" : mode == 0 ? "Crear espacio cifrado" : "Conectar") {
                    Task {
                        let success = mode == 0
                            ? await conversation.createRelay(displayName: displayName, baseURL: baseURL)
                            : await conversation.joinRelay(code: code, displayName: displayName, baseURL: baseURL)
                        if success && mode == 1 { isPresented = false }
                    }
                }
                .disabled(conversation.isSyncing || displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            if let error = conversation.relayError {
                Text(error).font(.system(size: 11)).foregroundStyle(MISILTheme.danger)
            }
        }
        .padding(24)
        .frame(width: 520)
        .background(MISILTheme.background)
    }
}

struct DetailHeader: View {
    let title: String
    let subtitle: String?

    init(title: String, subtitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 16, weight: .bold))
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 10))
                        .foregroundStyle(MISILTheme.textMuted)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .frame(height: 54)
        .overlay(alignment: .bottom) {
            Rectangle().fill(MISILTheme.border).frame(height: 1)
        }
    }
}
