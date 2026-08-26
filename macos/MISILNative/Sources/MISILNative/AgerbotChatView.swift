import SwiftUI

struct AgerbotContactRow: View {
    @ObservedObject var store: AgerbotConversationStore
    @ObservedObject var processManager: AgerbotProcessManager
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 11) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(MISILTheme.active)
                .frame(width: 36, height: 36)
                .overlay {
                    Image(systemName: "cpu")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(MISILTheme.accent)
                }
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text("Agerbot").font(.system(size: 13, weight: .semibold))
                    Text("LOCAL")
                        .font(.system(size: 7, weight: .bold))
                        .foregroundStyle(MISILTheme.accent)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(MISILTheme.accent.opacity(0.12))
                        .clipShape(Capsule())
                }
                Text(previewText)
                    .font(.system(size: 11))
                    .foregroundStyle(MISILTheme.textMuted)
                    .lineLimit(1)
            }
            Spacer()
            Circle().fill(statusColor).frame(width: 7, height: 7)
        }
        .padding(12)
        .background(isSelected ? MISILTheme.active.opacity(0.55) : Color.clear)
        .contentShape(Rectangle())
    }

    private var previewText: String {
        if store.isGenerating { return "Pensando…" }
        if let last = store.messages.last { return last.content }
        return "Modelo pequeño en este equipo"
    }

    private var statusColor: Color {
        if processManager.state.isReady { return .green }
        switch processManager.state {
        case .starting, .loading: return MISILTheme.accent
        case .failed, .portConflict, .unavailable: return MISILTheme.danger
        default: return MISILTheme.textMuted
        }
    }
}

struct AgerbotChatView: View {
    @ObservedObject var store: AgerbotConversationStore
    @ObservedObject var processManager: AgerbotProcessManager
    @ObservedObject var updateController: AgerbotModelUpdateController
    @State private var draft = ""

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 7) {
                        Text("Agerbot").font(.system(size: 16, weight: .bold))
                        Circle().fill(runtimeColor).frame(width: 7, height: 7)
                    }
                    Text(headerSubtitle)
                        .font(.system(size: 10))
                        .foregroundStyle(MISILTheme.textMuted)
                }
                Spacer()
                if store.isGenerating {
                    Button("Cancelar") { store.cancelGeneration() }
                        .buttonStyle(.bordered)
                        .tint(MISILTheme.accent)
                        .controlSize(.small)
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 54)
            .overlay(alignment: .bottom) { Rectangle().fill(MISILTheme.border).frame(height: 1) }

            messageList
            composer
        }
        .background(MISILTheme.background)
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    if store.messages.isEmpty {
                        emptyState
                    }
                    ForEach(store.messages) { message in
                        messageBubble(message)
                            .id(message.id)
                    }
                    if store.isGenerating {
                        thinkingBubble.id("agerbot-thinking")
                    }
                }
                .padding(20)
            }
            .onChange(of: store.messages) { _, messages in
                if let id = messages.last?.id {
                    withAnimation(.easeOut(duration: 0.16)) { proxy.scrollTo(id) }
                }
            }
            .onChange(of: store.isGenerating) { _, generating in
                if generating {
                    withAnimation(.easeOut(duration: 0.16)) { proxy.scrollTo("agerbot-thinking") }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(MISILTheme.surface)
                .frame(width: 66, height: 66)
                .overlay {
                    Image(systemName: "cpu")
                        .font(.system(size: 27, weight: .medium))
                        .foregroundStyle(MISILTheme.accent)
                }
            Text("Habla con Agerbot")
                .font(.system(size: 16, weight: .semibold))
            Text("Es un modelo experimental muy pequeño. Puede equivocarse o generar texto incoherente. Esta conversación se guarda solo en este Mac.")
                .font(.system(size: 12))
                .foregroundStyle(MISILTheme.textMuted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 390)
            if !processManager.state.isReady {
                Button("Iniciar Agerbot") { store.retryRuntime() }
                    .buttonStyle(.borderedProminent)
                    .tint(MISILTheme.accent)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 88)
    }

    private func messageBubble(_ message: AgerbotLocalMessage) -> some View {
        let outgoing = message.role == .user
        return VStack(alignment: outgoing ? .trailing : .leading, spacing: 5) {
            Text(outgoing ? "Tú" : "Agerbot")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(outgoing ? MISILTheme.textSecondary : MISILTheme.accent)
            Text(message.content)
                .font(.system(size: 14))
                .textSelection(.enabled)
            Text(message.createdAt.formatted(date: .omitted, time: .shortened))
                .font(.system(size: 9, design: .monospaced))
                .foregroundStyle(MISILTheme.textMuted)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 10)
        .background(outgoing ? MISILTheme.active : MISILTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .frame(maxWidth: 460, alignment: outgoing ? .trailing : .leading)
        .frame(maxWidth: .infinity, alignment: outgoing ? .trailing : .leading)
    }

    private var thinkingBubble: some View {
        HStack(spacing: 9) {
            ProgressView().controlSize(.small).tint(MISILTheme.accent)
            Text(thinkingText)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(MISILTheme.textSecondary)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 11)
        .background(MISILTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let errorText {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                    Text(errorText)
                    Spacer()
                    Button("Reintentar") { store.retryRuntime() }
                        .buttonStyle(.plain)
                        .foregroundStyle(MISILTheme.accent)
                }
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(MISILTheme.danger)
            }
            HStack(spacing: 10) {
                TextField("Escribe a Agerbot", text: $draft, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .lineLimit(1 ... 4)
                    .background(MISILTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .onSubmit(send)
                    .disabled(store.isGenerating)
                Button(action: send) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(MISILTheme.accent)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(store.isGenerating || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            Text("Agerbot es experimental. No compartas información sensible.")
                .font(.system(size: 9))
                .foregroundStyle(MISILTheme.textMuted)
        }
        .padding(14)
        .overlay(alignment: .top) { Rectangle().fill(MISILTheme.border).frame(height: 1) }
    }

    private var runtimeColor: Color {
        processManager.state.isReady ? .green : MISILTheme.textMuted
    }

    private var headerSubtitle: String {
        switch updateController.phase {
        case .downloading, .verifying:
            "Actualizando en segundo plano · el chat sigue usando el modelo activo"
        case .waitingForConversation:
            "Actualización lista · se activará después de esta respuesta"
        default:
            "Modelo local · No usa MISIL Hub"
        }
    }

    private var thinkingText: String {
        switch store.state {
        case .starting: "Iniciando el runtime local…"
        case .cancelling: "Cancelando generación…"
        default: "Agerbot está pensando…"
        }
    }

    private var errorText: String? {
        switch store.state {
        case let .unavailable(message), let .failed(message): message
        default: nil
        }
    }

    private func send() {
        let content = draft
        draft = ""
        store.send(content)
    }
}
