import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var confirmsReset = false
    @State private var messagingUsername: String
    @State private var hubURL: String
    @State private var hubSaveStatus = "Usa wss:// cuando el Hub esté publicado en Internet."

    init() {
        let identity = MessagingIdentityStore.loadOrCreate()
        _messagingUsername = State(initialValue: identity.username)
        _hubURL = State(initialValue: identity.hubURL)
    }

    var body: some View {
        VStack(spacing: 0) {
            DetailHeader(title: "Ajustes", subtitle: "Configuración de este Mac")

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Almacenamiento")
                            .font(.system(size: 18, weight: .bold))
                        MISILSection {
                            MISILRow {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Aportación del nodo")
                                        .font(.system(size: 13, weight: .semibold))
                                    Text(appState.sharesStorage ? appState.storageSnapshot.quotaBytes.misilFileSize : "No estás compartiendo espacio")
                                        .font(.system(size: 11))
                                        .foregroundStyle(MISILTheme.textMuted)
                                }
                            } trailing: {
                                Button(appState.sharesStorage ? "Cambiar" : "Configurar") {
                                    appState.showsContributionSetup = true
                                }
                                .buttonStyle(.bordered)
                                .tint(MISILTheme.accent)
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Conexión por Internet")
                            .font(.system(size: 18, weight: .bold))
                        MISILSection {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("NOMBRE ÚNICO DE ESTE EQUIPO")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(MISILTheme.textMuted)
                                TextField("usuario-misil", text: $messagingUsername)
                                    .textFieldStyle(.plain)
                                    .padding(.horizontal, 10)
                                    .frame(height: 36)
                                    .background(MISILTheme.surface)
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                Text("DIRECCIÓN DEL MISIL HUB")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(MISILTheme.textMuted)
                                TextField("wss://hub.ejemplo.com/v1/connect", text: $hubURL)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 11, design: .monospaced))
                                    .padding(.horizontal, 10)
                                    .frame(height: 36)
                                    .background(MISILTheme.surface)
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                HStack {
                                    Text(hubSaveStatus)
                                        .font(.system(size: 10))
                                        .foregroundStyle(MISILTheme.textMuted)
                                    Spacer()
                                    Button("Guardar y reiniciar", action: saveHubSettings)
                                        .buttonStyle(.bordered)
                                        .tint(MISILTheme.accent)
                                }
                            }
                            .padding(.vertical, 3)
                        }
                    }

                    AgerbotSettingsSection(
                        settingsStore: appState.agerbotSettingsStore,
                        installationManager: appState.agerbotInstallationManager,
                        processManager: appState.agerbotProcessManager,
                        capabilityViewModel: appState.agerbotCapabilityViewModel,
                        updateController: appState.agerbotUpdateController
                    )

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Privacidad")
                            .font(.system(size: 18, weight: .bold))
                        MISILSection {
                            SettingInfoRow(
                                icon: "person.crop.circle",
                                title: "Perfil local",
                                detail: "La identidad se registra únicamente en tu MISIL Hub."
                            )
                            Divider().overlay(MISILTheme.border)
                            SettingInfoRow(
                                icon: "key",
                                title: "Clave del nodo",
                                detail: "Protegida en el Llavero de macOS."
                            )
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Pruebas")
                            .font(.system(size: 18, weight: .bold))
                        MISILSection {
                            MISILRow {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Repetir configuración inicial")
                                        .font(.system(size: 13, weight: .semibold))
                                    Text("Borra la preferencia, pero conserva los archivos del nodo.")
                                        .font(.system(size: 11))
                                        .foregroundStyle(MISILTheme.textMuted)
                                }
                            } trailing: {
                                Button("Restablecer") { confirmsReset = true }
                                    .buttonStyle(.bordered)
                                    .tint(MISILTheme.accent)
                            }
                        }
                    }

                    Text("MISIL Desktop Alpha 0.3.0 · macOS")
                        .font(.system(size: 11))
                        .foregroundStyle(MISILTheme.textMuted)
                }
                .padding(28)
                .frame(maxWidth: 700, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
        .confirmationDialog(
            "¿Repetir el onboarding?",
            isPresented: $confirmsReset
        ) {
            Button("Restablecer configuración", role: .destructive) {
                Task { await appState.resetOnboardingForTesting() }
            }
            Button("Cancelar", role: .cancel) { }
        } message: {
            Text("Los mensajes y archivos locales no se eliminarán.")
        }
    }

    private func saveHubSettings() {
        let username = messagingUsername.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard username.range(of: "^[a-z0-9][a-z0-9_-]{2,31}$", options: .regularExpression) != nil else {
            hubSaveStatus = "El usuario debe tener entre 3 y 32 caracteres."
            return
        }
        let trimmedURL = hubURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmedURL), url.scheme == "ws" || url.scheme == "wss" else {
            hubSaveStatus = "La dirección debe comenzar por ws:// o wss://."
            return
        }
        let current = MessagingIdentityStore.loadOrCreate()
        MessagingIdentityStore.save(MessagingIdentity(
            deviceId: current.deviceId,
            deviceKey: current.deviceKey,
            username: username,
            displayName: current.displayName,
            hubURL: trimmedURL
        ))
        messagingUsername = username
        hubSaveStatus = "Guardado. Reinicia MISIL para conectar con este Hub."
    }
}

private struct AgerbotSettingsSection: View {
    @ObservedObject var settingsStore: AgerbotSettingsStore
    @ObservedObject var installationManager: AgerbotInstallationManager
    @ObservedObject var processManager: AgerbotProcessManager
    @ObservedObject var capabilityViewModel: AgerbotCapabilityViewModel
    @ObservedObject var updateController: AgerbotModelUpdateController
    @State private var installationNotice: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Agerbot")
                    .font(.system(size: 18, weight: .bold))
                Spacer()
                statusBadge
            }
            MISILSection {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(MISILTheme.active)
                            .frame(width: 42, height: 42)
                            .overlay {
                                Image(systemName: "cpu")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundStyle(MISILTheme.accent)
                            }
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Modelo local opcional")
                                .font(.system(size: 13, weight: .semibold))
                            Text("La conversación no usa MISIL Hub y permanece en este Mac.")
                                .font(.system(size: 11))
                                .foregroundStyle(MISILTheme.textMuted)
                        }
                    }

                    Divider().overlay(MISILTheme.border)

                    pathRow(label: "PROYECTO AGERBOT", value: settingsStore.settings.projectPath) {
                        chooseProject()
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("MODELO SELECCIONADO AUTOMÁTICAMENTE")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(MISILTheme.textMuted)
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(settingsStore.settings.activeModelVersion.map { "Agerbot \($0)" } ?? "Sin modelo compatible")
                                    .font(.system(size: 12, weight: .semibold))
                                Text(settingsStore.settings.checkpointPath.isEmpty ? "MISIL busca manifiestos estables verificados." : settingsStore.settings.checkpointPath)
                                    .font(.system(size: 9, design: .monospaced))
                                    .foregroundStyle(MISILTheme.textMuted)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                            }
                            Spacer()
                            if let latest = installationManager.availableModels.first?.manifest.model.version {
                                Text("Último: \(latest)")
                                    .font(.system(size: 9, weight: .semibold))
                                    .foregroundStyle(MISILTheme.textSecondary)
                            }
                        }
                        .padding(.horizontal, 11)
                        .padding(.vertical, 9)
                        .background(MISILTheme.background.opacity(0.68))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }

                    DisclosureGroup("Opciones avanzadas") {
                        HStack {
                            Text("Fijar manualmente un checkpoint desactiva las actualizaciones automáticas.")
                                .font(.system(size: 10))
                                .foregroundStyle(MISILTheme.textMuted)
                            Spacer()
                            Button("Elegir checkpoint…", action: chooseCheckpoint)
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                        }
                        .padding(.top, 8)
                    }
                    .font(.system(size: 11, weight: .medium))

                    Toggle("Iniciar Agerbot al abrir MISIL", isOn: Binding(
                        get: { settingsStore.settings.startWithMISIL },
                        set: { settingsStore.settings.startWithMISIL = $0 }
                    ))
                    .toggleStyle(.switch)
                    .tint(MISILTheme.accent)
                    .font(.system(size: 12, weight: .medium))

                    if case let .starting(progress, detail) = processManager.state {
                        runtimeProgress(progress: progress, detail: detail)
                    } else if case let .loading(progress, detail) = processManager.state {
                        runtimeProgress(progress: progress, detail: detail)
                    }

                    if let capabilities = capabilityViewModel.capabilities {
                        HStack(spacing: 16) {
                            metric("DISPOSITIVO", capabilities.inference.recommendedDevice.uppercased())
                            metric("CPU", "\(capabilities.cpu.logicalCores) hilos")
                            metric("MEMORIA", capabilities.memory.totalBytes.misilFileSize)
                        }
                    }

                    Divider().overlay(MISILTheme.border)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Actualizaciones del modelo")
                            .font(.system(size: 13, weight: .semibold))
                        updateRow("Versión activa", settingsStore.settings.activeModelVersion ?? "Ninguna")
                        updateRow("Versión disponible", updateController.availableVersion ?? "Ninguna")
                        updateRow("Canal", settingsStore.settings.modelChannel)
                        updateRow("Estado", updateStatusText)
                        updateRow("Última comprobación", lastCheckText)
                        if let size = updateController.availableSizeBytes {
                            updateRow("Tamaño", size.misilFileSize)
                        }
                        updateRow("SHA-256", updateController.shaVerified ? "Verificado" : "Pendiente")
                        updateRow("Modelo anterior", settingsStore.settings.previousModelVersion ?? "No disponible")

                        if case let .downloading(_, progress) = updateController.phase {
                            ProgressView(value: progress).tint(MISILTheme.accent)
                        }

                        Toggle("Actualizar modelos automáticamente", isOn: Binding(
                            get: { settingsStore.settings.automaticModelUpdates },
                            set: { settingsStore.settings.automaticModelUpdates = $0 }
                        ))
                        .toggleStyle(.switch)
                        .tint(MISILTheme.accent)
                        .font(.system(size: 12, weight: .medium))

                        HStack(spacing: 8) {
                            Button("Buscar ahora") { updateController.startCheck() }
                                .buttonStyle(.bordered)
                            if case .available = updateController.phase {
                                Button("Instalar") { updateController.installAvailableUpdate() }
                                    .buttonStyle(.borderedProminent)
                                    .tint(MISILTheme.accent)
                            }
                            if updateController.isDownloading {
                                Button("Cancelar") { updateController.cancelDownload() }
                                    .buttonStyle(.bordered)
                            }
                            if case .failed = updateController.phase {
                                Button("Reintentar") { updateController.startCheck() }
                                    .buttonStyle(.bordered)
                            }
                            Spacer()
                            Button("Volver a versión anterior") { updateController.rollbackToPrevious() }
                                .buttonStyle(.bordered)
                                .disabled(settingsStore.settings.previousModelVersion == nil)
                        }
                    }

                    if let diagnostic = processManager.lastDiagnostic,
                       case .failed = processManager.state {
                        Text(diagnostic)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(MISILTheme.danger)
                            .textSelection(.enabled)
                    }
                    if let installationNotice {
                        Text(installationNotice)
                            .font(.system(size: 10))
                            .foregroundStyle(MISILTheme.textMuted)
                    }

                    HStack {
                        Button("Instalar Agerbot…") {
                            installationNotice = "El instalador descargable pertenece a la Fase 2. En esta beta usa una instalación local elegida explícitamente."
                        }
                        .buttonStyle(.bordered)
                        .tint(MISILTheme.accent)

                        Button("Elegir instalación local…", action: chooseProject)
                            .buttonStyle(.bordered)

                        Spacer()

                        if processManager.state.isReady {
                            Button("Detener") { Task { await processManager.stop() } }
                                .buttonStyle(.bordered)
                        } else {
                            Button("Iniciar") { startRuntime() }
                                .buttonStyle(.borderedProminent)
                                .tint(MISILTheme.accent)
                        }
                    }
                }
                .padding(16)
            }
        }
        .onAppear {
            Task {
                if let selected = await installationManager.discover(using: settingsStore.settings) {
                    settingsStore.applyDiscoveredModel(selected)
                    let previous = installationManager.availableModels
                        .first { $0.version < selected.version }?.manifest.model.version
                    settingsStore.setPreviousVersionIfMissing(previous)
                }
                installationManager.refresh(using: settingsStore.settings)
                await capabilityViewModel.refresh()
            }
        }
    }

    private var statusBadge: some View {
        HStack(spacing: 6) {
            Circle().fill(statusColor).frame(width: 7, height: 7)
            Text(statusText)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(MISILTheme.textSecondary)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(MISILTheme.surface)
        .clipShape(Capsule())
    }

    private func pathRow(label: String, value: String, action: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(MISILTheme.textMuted)
            HStack(spacing: 10) {
                Text(value.isEmpty ? "Sin seleccionar" : value)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(value.isEmpty ? MISILTheme.textMuted : MISILTheme.textSecondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
                Button("Elegir…", action: action)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }
            .padding(.horizontal, 11)
            .frame(height: 38)
            .background(MISILTheme.background.opacity(0.68))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }

    private func runtimeProgress(progress: Double, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ProgressView(value: progress).tint(MISILTheme.accent)
            Text(detail).font(.system(size: 10)).foregroundStyle(MISILTheme.textMuted)
        }
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label).font(.system(size: 8, weight: .bold)).foregroundStyle(MISILTheme.textMuted)
            Text(value).font(.system(size: 11, weight: .semibold)).foregroundStyle(MISILTheme.textSecondary)
        }
    }

    private func updateRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.system(size: 11)).foregroundStyle(MISILTheme.textMuted)
            Spacer()
            Text(value).font(.system(size: 11, weight: .medium)).foregroundStyle(MISILTheme.textSecondary)
                .lineLimit(1)
        }
    }

    private var lastCheckText: String {
        settingsStore.settings.lastUpdateCheckAt?.formatted(date: .abbreviated, time: .shortened) ?? "Nunca"
    }

    private var updateStatusText: String {
        switch updateController.phase {
        case let .idle(message): message
        case .checking: "Buscando actualizaciones"
        case let .available(version, _): "Agerbot \(version) disponible"
        case let .downloading(_, progress): "Descargando · \(Int(progress * 100)) %"
        case let .verifying(message): message
        case .waitingForConversation: "Esperando a que termine la generación"
        case let .activating(version): "Activando \(version)"
        case let .installed(version): "\(version) instalado"
        case let .rollingBack(version): "Restaurando \(version)"
        case .cancelled: "Descarga cancelada"
        case let .failed(message): message
        }
    }

    private var statusColor: Color {
        switch processManager.state {
        case .ready: Color.green
        case .starting, .loading, .stopping: MISILTheme.accent
        case .failed, .portConflict, .unavailable: MISILTheme.danger
        case .notInstalled, .stopped: MISILTheme.textMuted
        }
    }

    private var statusText: String {
        switch processManager.state {
        case let .ready(health): "LISTO · \(health.model.device.uppercased())"
        case .starting: "INICIANDO"
        case .loading: "CARGANDO"
        case .stopping: "DETENIENDO"
        case .portConflict: "PUERTO OCUPADO"
        case .failed: "ERROR"
        case .unavailable: "NO DISPONIBLE"
        case .notInstalled: "NO INSTALADO"
        case .stopped: "DETENIDO"
        }
    }

    private func chooseProject() {
        let panel = NSOpenPanel()
        panel.title = "Elegir instalación local de Agerbot"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            settingsStore.updateProjectPath(url.path)
            if settingsStore.settings.automaticModelUpdates {
                settingsStore.updateCheckpointPath("")
            }
            Task {
                if let selected = await installationManager.discover(using: settingsStore.settings) {
                    settingsStore.applyDiscoveredModel(selected)
                    let previous = installationManager.availableModels
                        .first { $0.version < selected.version }?.manifest.model.version
                    settingsStore.setPreviousVersionIfMissing(previous)
                }
                installationManager.refresh(using: settingsStore.settings)
            }
        }
    }

    private func chooseCheckpoint() {
        let panel = NSOpenPanel()
        panel.title = "Elegir checkpoint verificado de Agerbot"
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = false
        if let checkpointType = UTType(filenameExtension: "pt") {
            panel.allowedContentTypes = [checkpointType]
        }
        if panel.runModal() == .OK, let url = panel.url {
            settingsStore.updateCheckpointPath(url.path)
            settingsStore.settings.automaticModelUpdates = false
            settingsStore.settings.pinnedModelVersion = nil
            installationManager.refresh(using: settingsStore.settings)
        }
    }

    private func startRuntime() {
        installationManager.refresh(using: settingsStore.settings)
        Task {
            await processManager.start(
                settings: settingsStore.settings,
                installationStatus: installationManager.status
            )
            await capabilityViewModel.refresh()
        }
    }
}

private struct SettingInfoRow: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        MISILRow {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundStyle(MISILTheme.accent)
                    .frame(width: 20)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.system(size: 13, weight: .semibold))
                    Text(detail)
                        .font(.system(size: 11))
                        .foregroundStyle(MISILTheme.textMuted)
                }
            }
        } trailing: {
            Image(systemName: "checkmark")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(MISILTheme.accent)
        }
    }
}
