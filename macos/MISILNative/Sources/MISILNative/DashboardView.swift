import AppKit
import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            DetailHeader(title: "Dashboard", subtitle: appState.sharesStorage ? "Nodo local activo" : "Almacenamiento no configurado")

            if appState.sharesStorage {
                ActiveDashboard()
            } else {
                InactiveDashboard()
            }
        }
        .task {
            await appState.refreshStorage()
        }
    }
}

private struct ActiveDashboard: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(spacing: 14) {
                    Image(systemName: "externaldrive.fill.badge.checkmark")
                        .font(.system(size: 28))
                        .foregroundStyle(MISILTheme.accent)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Este Mac está aportando almacenamiento")
                            .font(.system(size: 20, weight: .bold))
                        Text("La cuota limita cuánto puede ocupar MISIL; el espacio se consume únicamente cuando llegan archivos.")
                            .font(.system(size: 13))
                            .foregroundStyle(MISILTheme.textSecondary)
                    }
                    Spacer()
                }

                MISILSection {
                    StorageValueRow(
                        label: "Cuota compartida",
                        value: appState.storageSnapshot.quotaBytes.misilFileSize,
                        icon: "externaldrive"
                    )
                    Divider().overlay(MISILTheme.border)
                    StorageValueRow(
                        label: "Utilizado por MISIL",
                        value: appState.storageSnapshot.usedBytes.misilFileSize,
                        icon: "internaldrive"
                    )
                    Divider().overlay(MISILTheme.border)
                    StorageValueRow(
                        label: "Disponible en la cuota",
                        value: appState.storageSnapshot.availableWithinQuota.misilFileSize,
                        icon: "arrow.down.to.line"
                    )
                }

                MISILSection {
                    MISILRow {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Directorio del nodo")
                                .font(.system(size: 13, weight: .semibold))
                            Text(appState.configuration?.storageDirectory ?? "")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(MISILTheme.textMuted)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                    } trailing: {
                        Button("Mostrar en Finder") {
                            guard let path = appState.configuration?.storageDirectory else { return }
                            NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: path)
                        }
                        .buttonStyle(.bordered)
                        .tint(MISILTheme.accent)
                    }
                }

                HStack(spacing: 8) {
                    Image(systemName: "lock.shield")
                    Text("La clave maestra se conserva en el Llavero de macOS y no se escribe dentro de la carpeta compartida.")
                }
                .font(.system(size: 12))
                .foregroundStyle(MISILTheme.textMuted)
            }
            .padding(28)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
    }
}

private struct InactiveDashboard: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Image(systemName: "externaldrive.badge.xmark")
                .font(.system(size: 42))
                .foregroundStyle(MISILTheme.textMuted)
            VStack(alignment: .leading, spacing: 8) {
                Text("El Dashboard necesita un nodo activo")
                    .font(.system(size: 23, weight: .bold))
                Text("No estás compartiendo almacenamiento. Activa una cuota para ver capacidad, uso y estado del nodo.")
                    .font(.system(size: 14))
                    .foregroundStyle(MISILTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button("Compartir almacenamiento") {
                appState.showsContributionSetup = true
            }
            .buttonStyle(MISILPrimaryButtonStyle())
            .frame(width: 230)
        }
        .frame(width: 480, alignment: .leading)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct StorageValueRow: View {
    let label: String
    let value: String
    let icon: String

    var body: some View {
        MISILRow {
            Label(label, systemImage: icon)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(MISILTheme.textSecondary)
        } trailing: {
            Text(value)
                .font(.system(size: 15, weight: .semibold, design: .monospaced))
        }
    }
}
