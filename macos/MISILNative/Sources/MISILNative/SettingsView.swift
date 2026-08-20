import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var confirmsReset = false

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
                        Text("Privacidad")
                            .font(.system(size: 18, weight: .bold))
                        MISILSection {
                            SettingInfoRow(
                                icon: "person.crop.circle",
                                title: "Perfil local",
                                detail: "No existe una cuenta ni una sesión remota."
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

                    Text("MISIL Local Alpha 0.1.2 · macOS")
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
