import SwiftUI

private enum OnboardingStep {
    case welcome
    case storageChoice
    case storageAmount
    case keychainDisclosure
    case preparing
}

struct OnboardingView: View {
    @EnvironmentObject private var appState: AppState
    @State private var step: OnboardingStep = .welcome
    @State private var selectedGiB = StoragePolicy.minimumGiB
    @State private var availableBytes: UInt64 = 0

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                MISILBrandMark(size: 32)
                Text("MISIL")
                    .font(.system(size: 18, weight: .bold))
                Spacer()
                Text(stepLabel)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(MISILTheme.textMuted)
            }
            .padding(.horizontal, 26)
            .frame(height: 58)
            .overlay(alignment: .bottom) {
                Rectangle().fill(MISILTheme.border).frame(height: 1)
            }

            Group {
                switch step {
                case .welcome:
                    WelcomeStep {
                        step = .storageChoice
                    }
                case .storageChoice:
                    StorageChoiceStep(
                        onShare: { step = .storageAmount },
                        onSkip: startWithoutContribution,
                        onBack: { step = .welcome }
                    )
                case .storageAmount:
                    StorageAmountStep(
                        selectedGiB: $selectedGiB,
                        availableBytes: availableBytes,
                        onContinue: { step = .keychainDisclosure },
                        onBack: { step = .storageChoice }
                    )
                case .keychainDisclosure:
                    KeychainDisclosureStep(
                        onContinue: startWithContribution,
                        onBack: { step = .storageAmount }
                    )
                case .preparing:
                    PreparationStep()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(MISILTheme.background)
        .task {
            availableBytes = await appState.availableDiskBytes()
        }
        .alert("No se pudo preparar MISIL", isPresented: .init(
            get: { appState.presentationError != nil },
            set: { if !$0 { appState.presentationError = nil } }
        )) {
            Button("Volver") { step = .storageAmount }
        } message: {
            Text(appState.presentationError ?? "Error desconocido")
        }
    }

    private var stepLabel: String {
        switch step {
        case .welcome: "Inicio"
        case .storageChoice: "Almacenamiento"
        case .storageAmount: "Cuota"
        case .keychainDisclosure: "Seguridad"
        case .preparing: "Preparación"
        }
    }

    private func startWithoutContribution() {
        step = .preparing
        Task {
            let success = await appState.finishOnboarding(sharesStorage: false)
            if !success { step = .storageChoice }
        }
    }

    private func startWithContribution() {
        step = .preparing
        Task {
            let success = await appState.finishOnboarding(
                sharesStorage: true,
                quotaGiB: selectedGiB
            )
            if !success { step = .storageAmount }
        }
    }
}

private struct KeychainDisclosureStep: View {
    let onContinue: () -> Void
    let onBack: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 23) {
            BackButton(action: onBack)

            Image(systemName: "lock.shield.fill")
                .font(.system(size: 42))
                .foregroundStyle(MISILTheme.accent)

            VStack(alignment: .leading, spacing: 9) {
                Text("macOS te pedirá permiso")
                    .font(.system(size: 27, weight: .bold))
                Text("Para cifrar el almacenamiento, MISIL necesita guardar y recuperar una única clave secreta en el Llavero de este Mac.")
                    .font(.system(size: 15))
                    .foregroundStyle(MISILTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            MISILSection {
                KeychainExplanationRow(
                    icon: "key",
                    title: "Solo la clave de MISIL",
                    detail: "No permite acceder a tus contraseñas, tarjetas ni otras claves."
                )
                Divider().overlay(MISILTheme.border)
                KeychainExplanationRow(
                    icon: "macwindow",
                    title: "La contraseña se entrega a macOS",
                    detail: "MISIL no puede verla, leerla ni almacenarla."
                )
                Divider().overlay(MISILTheme.border)
                KeychainExplanationRow(
                    icon: "checkmark.shield",
                    title: "Necesario únicamente para aportar espacio",
                    detail: "Si deniegas el permiso, el nodo no se activará."
                )
            }

            Text("En esta alpha local, macOS puede volver a preguntar después de una actualización. La versión pública tendrá una firma estable para evitar solicitudes repetidas.")
                .font(.system(size: 12))
                .foregroundStyle(MISILTheme.textMuted)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 10) {
                Button("Continuar y autorizar", action: onContinue)
                    .buttonStyle(MISILPrimaryButtonStyle())
                    .frame(width: 220)
                Button("Volver", action: onBack)
                    .buttonStyle(MISILSecondaryButtonStyle())
                    .frame(width: 120)
            }
        }
        .frame(width: 560, alignment: .leading)
        .padding(.vertical, 32)
    }
}

private struct KeychainExplanationRow: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        MISILRow {
            HStack(spacing: 13) {
                Image(systemName: icon)
                    .foregroundStyle(MISILTheme.accent)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.system(size: 14, weight: .semibold))
                    Text(detail)
                        .font(.system(size: 12))
                        .foregroundStyle(MISILTheme.textSecondary)
                }
            }
        } trailing: {
            EmptyView()
        }
    }
}

private struct WelcomeStep: View {
    let onContinue: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            MISILBrandMark(size: 72)

            VStack(alignment: .leading, spacing: 10) {
                Text("Bienvenido a MISIL")
                    .font(.system(size: 30, weight: .bold))
                Text("Esta versión crea un nodo privado en tu Mac. No necesitas una cuenta y tus preferencias permanecen en este equipo.")
                    .font(.system(size: 15))
                    .foregroundStyle(MISILTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            MISILSection {
                OnboardingFact(
                    icon: "person.crop.circle.badge.checkmark",
                    title: "Sin inicio de sesión",
                    detail: "Entrarás directamente a tu espacio local."
                )
                Divider().overlay(MISILTheme.border)
                OnboardingFact(
                    icon: "lock.shield",
                    title: "Clave protegida por macOS",
                    detail: "El Llavero conserva la clave de almacenamiento."
                )
                Divider().overlay(MISILTheme.border)
                OnboardingFact(
                    icon: "externaldrive",
                    title: "Tú eliges la cuota",
                    detail: "Compartir espacio es opcional y reversible."
                )
            }

            Button("Continuar", action: onContinue)
                .buttonStyle(MISILPrimaryButtonStyle())
                .frame(maxWidth: 220)
        }
        .frame(width: 520, alignment: .leading)
        .padding(.vertical, 42)
    }
}

private struct StorageChoiceStep: View {
    let onShare: () -> Void
    let onSkip: () -> Void
    let onBack: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            BackButton(action: onBack)

            VStack(alignment: .leading, spacing: 9) {
                Text("¿Quieres compartir almacenamiento?")
                    .font(.system(size: 27, weight: .bold))
                Text("MISIL usará esa cuota como límite. No reservará todo el espacio de inmediato; solo crecerá cuando existan archivos.")
                    .font(.system(size: 15))
                    .foregroundStyle(MISILTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(spacing: 12) {
                ChoiceButton(
                    icon: "externaldrive.badge.plus",
                    title: "Sí, compartir almacenamiento",
                    detail: "Activa el nodo y el Dashboard de capacidad.",
                    isPrimary: true,
                    action: onShare
                )
                ChoiceButton(
                    icon: "arrow.right",
                    title: "Ahora no",
                    detail: "Podrás entrar a MISIL y activarlo después.",
                    isPrimary: false,
                    action: onSkip
                )
            }
        }
        .frame(width: 540, alignment: .leading)
        .padding(.vertical, 42)
    }
}

struct StorageAmountStep: View {
    @Binding var selectedGiB: Int
    let availableBytes: UInt64
    let onContinue: () -> Void
    let onBack: () -> Void

    @State private var customText = ""
    @State private var usesCustomValue = false

    private var maximumGiB: Int {
        StoragePolicy.maxShareableGiB(availableBytes: availableBytes)
    }

    private var selectedIsValid: Bool {
        selectedGiB >= StoragePolicy.minimumGiB && selectedGiB <= maximumGiB
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            BackButton(action: onBack)

            VStack(alignment: .leading, spacing: 9) {
                Text("Elige cuánto espacio aportar")
                    .font(.system(size: 27, weight: .bold))
                Text("Disponible para compartir: hasta \(StoragePolicy.bytes(forGiB: maximumGiB).misilFileSize). MISIL conserva 5 GB libres como margen de seguridad.")
                    .font(.system(size: 14))
                    .foregroundStyle(MISILTheme.textSecondary)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(StoragePolicy.presets, id: \.self) { value in
                    StoragePresetButton(
                        value: value,
                        selected: !usesCustomValue && selectedGiB == value,
                        enabled: value <= maximumGiB
                    ) {
                        usesCustomValue = false
                        selectedGiB = value
                        customText = ""
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Cantidad personalizada")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(MISILTheme.textSecondary)
                HStack(spacing: 10) {
                    TextField("Mínimo 10", text: $customText)
                        .textFieldStyle(.plain)
                        .font(.system(size: 14, weight: .medium))
                        .padding(.horizontal, 12)
                        .frame(height: 40)
                        .background(MISILTheme.surface)
                        .overlay {
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .stroke(usesCustomValue ? MISILTheme.accent : MISILTheme.border)
                        }
                        .onChange(of: customText) { _, value in
                            let filtered = value.filter(\.isNumber)
                            if filtered != value { customText = filtered }
                            usesCustomValue = !filtered.isEmpty
                            if let number = Int(filtered) { selectedGiB = number }
                        }
                    Text("GB")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(MISILTheme.textMuted)
                }
                if usesCustomValue && selectedGiB < StoragePolicy.minimumGiB {
                    Text("La cantidad mínima es 10 GB.")
                        .font(.system(size: 12))
                        .foregroundStyle(MISILTheme.accent)
                } else if usesCustomValue && selectedGiB > maximumGiB {
                    Text("La cantidad supera el espacio seguro disponible.")
                        .font(.system(size: 12))
                        .foregroundStyle(MISILTheme.accent)
                }
            }

            Button("Preparar \(selectedGiB) GB", action: onContinue)
                .buttonStyle(MISILPrimaryButtonStyle())
                .disabled(!selectedIsValid)
                .opacity(selectedIsValid ? 1 : 0.45)
                .frame(maxWidth: 230)
        }
        .frame(width: 540, alignment: .leading)
        .padding(.vertical, 34)
    }
}

private struct PreparationStep: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            MISILBrandMark(size: 62)
            VStack(alignment: .leading, spacing: 8) {
                Text(appState.setupProgress.title)
                    .font(.system(size: 27, weight: .bold))
                Text(appState.setupProgress.detail)
                    .font(.system(size: 14))
                    .foregroundStyle(MISILTheme.textSecondary)
            }

            ProgressView(value: appState.setupProgress.fraction)
                .progressViewStyle(.linear)
                .tint(MISILTheme.accent)
                .frame(width: 430)

            Text("\(Int(appState.setupProgress.fraction * 100)) %")
                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                .foregroundStyle(MISILTheme.textMuted)
        }
        .frame(width: 520, alignment: .leading)
    }
}

private struct OnboardingFact: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        MISILRow {
            HStack(spacing: 13) {
                Image(systemName: icon)
                    .foregroundStyle(MISILTheme.accent)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.system(size: 14, weight: .semibold))
                    Text(detail)
                        .font(.system(size: 12))
                        .foregroundStyle(MISILTheme.textSecondary)
                }
            }
        } trailing: {
            EmptyView()
        }
    }
}

private struct ChoiceButton: View {
    let icon: String
    let title: String
    let detail: String
    let isPrimary: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(isPrimary ? MISILTheme.accent : MISILTheme.textSecondary)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                    Text(detail)
                        .font(.system(size: 12))
                        .foregroundStyle(MISILTheme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(MISILTheme.textMuted)
            }
            .foregroundStyle(MISILTheme.textPrimary)
            .padding(.horizontal, 16)
            .frame(height: 72)
            .background(isPrimary ? MISILTheme.accent.opacity(0.1) : MISILTheme.surface)
            .overlay {
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .stroke(isPrimary ? MISILTheme.accent.opacity(0.55) : MISILTheme.border)
            }
            .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

private struct StoragePresetButton: View {
    let value: Int
    let selected: Bool
    let enabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(value) GB")
                        .font(.system(size: 18, weight: .bold))
                    Text(enabled ? "Disponible" : "Sin espacio suficiente")
                        .font(.system(size: 11))
                        .foregroundStyle(MISILTheme.textMuted)
                }
                Spacer()
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(MISILTheme.accent)
                }
            }
            .foregroundStyle(MISILTheme.textPrimary)
            .padding(14)
            .frame(height: 68)
            .background(selected ? MISILTheme.active.opacity(0.65) : MISILTheme.surface)
            .overlay {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(selected ? MISILTheme.accent : MISILTheme.border)
            }
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
    }
}

private struct BackButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label("Atrás", systemImage: "chevron.left")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(MISILTheme.textSecondary)
        }
        .buttonStyle(.plain)
    }
}

struct ContributionSetupView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var selectedGiB = StoragePolicy.minimumGiB
    @State private var availableBytes: UInt64 = 0
    @State private var isPreparing = false
    @State private var showsKeychainDisclosure = false

    var body: some View {
        ZStack {
            MISILTheme.background.ignoresSafeArea()
            if isPreparing {
                PreparationStep()
            } else if showsKeychainDisclosure {
                KeychainDisclosureStep(
                    onContinue: prepare,
                    onBack: { showsKeychainDisclosure = false }
                )
            } else {
                StorageAmountStep(
                    selectedGiB: $selectedGiB,
                    availableBytes: availableBytes,
                    onContinue: { showsKeychainDisclosure = true },
                    onBack: { dismiss() }
                )
            }
        }
        .frame(width: 650, height: 590)
        .task {
            availableBytes = await appState.availableDiskBytes()
        }
        .alert("No se pudo activar el nodo", isPresented: .init(
            get: { appState.presentationError != nil },
            set: { if !$0 { appState.presentationError = nil } }
        )) {
            Button("Aceptar") { isPreparing = false }
        } message: {
            Text(appState.presentationError ?? "Error desconocido")
        }
    }

    private func prepare() {
        isPreparing = true
        Task {
            let success = await appState.finishOnboarding(
                sharesStorage: true,
                quotaGiB: selectedGiB
            )
            if success { dismiss() }
            else { isPreparing = false }
        }
    }
}
