import AppKit
import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            DetailHeader(
                title: "Red de almacenamiento",
                subtitle: networkSubtitle
            )

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    NetworkOverviewCard()
                    PlatformCards()
                    if appState.sharesStorage {
                        LocalStorageCard()
                    } else {
                        InactiveNodeCard()
                    }
                }
                .padding(28)
                .frame(maxWidth: 820, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
        .task { await appState.refreshStorage() }
    }

    private var networkSubtitle: String {
        switch appState.networkStatus {
        case .online:
            "Actualización cada \(appState.networkSnapshot.heartbeatIntervalSeconds) s · baja automática tras \(appState.networkSnapshot.offlineAfterSeconds) s"
        case .connecting:
            "Sincronizando capacidad entre dispositivos"
        case .offline:
            "Sin conexión · reintento automático"
        }
    }
}

private struct NetworkOverviewCard: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 7) {
                    Text("CAPACIDAD TOTAL EN LÍNEA")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(1.1)
                        .foregroundStyle(MISILTheme.textSecondary)
                    Text(appState.lastNetworkUpdate == nil ? "—" : appState.networkSnapshot.totalQuotaBytes.misilFileSize)
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                    Text("\(appState.networkSnapshot.onlineNodes) nodos disponibles ahora")
                        .font(.system(size: 13))
                        .foregroundStyle(MISILTheme.textSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 8) {
                    NetworkStatusBadge()
                    Text("Este Mac")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(MISILTheme.textMuted)
                    Text(appState.sharesStorage ? appState.storageSnapshot.quotaBytes.misilFileSize : "0 GB")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundStyle(MISILTheme.accent)
                }
            }

            ProgressView(
                value: Double(appState.networkSnapshot.totalUsedBytes),
                total: Double(max(1, appState.networkSnapshot.totalQuotaBytes))
            )
            .tint(MISILTheme.accent)

            HStack {
                Text("\(appState.networkSnapshot.totalUsedBytes.misilFileSize) utilizados")
                Spacer()
                Text("\(appState.networkSnapshot.availableBytes.misilFileSize) disponibles")
            }
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(MISILTheme.textMuted)
        }
        .padding(24)
        .background(
            LinearGradient(
                colors: [MISILTheme.accent.opacity(0.26), MISILTheme.surface, Color.white.opacity(0.04)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(MISILTheme.accent.opacity(0.36))
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct NetworkStatusBadge: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        HStack(spacing: 7) {
            Circle().fill(statusColor).frame(width: 7, height: 7)
            Text(statusText)
                .font(.system(size: 10, weight: .bold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.05))
        .overlay { RoundedRectangle(cornerRadius: 10).stroke(MISILTheme.border) }
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var statusText: String {
        switch appState.networkStatus {
        case .online: "EN LÍNEA"
        case .connecting: "SINCRONIZANDO"
        case .offline: "SIN CONEXIÓN"
        }
    }

    private var statusColor: Color {
        switch appState.networkStatus {
        case .online: Color(red: 69 / 255, green: 212 / 255, blue: 131 / 255)
        case .connecting: MISILTheme.accent
        case .offline: MISILTheme.textMuted
        }
    }
}

private struct PlatformCards: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        HStack(spacing: 12) {
            MetricCard(label: "NODOS EN LÍNEA", value: "\(appState.networkSnapshot.onlineNodes)", detail: "activos ahora")
            MetricCard(label: "WINDOWS", value: "\(appState.networkSnapshot.windowsNodes)", detail: "equipos conectados")
            MetricCard(label: "MACOS", value: "\(appState.networkSnapshot.macNodes)", detail: "equipos conectados")
        }
    }
}

private struct MetricCard: View {
    let label: String
    let value: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(MISILTheme.textMuted)
            Text(value).font(.system(size: 25, weight: .bold, design: .rounded))
            Text(detail).font(.system(size: 10)).foregroundStyle(MISILTheme.textSecondary)
        }
        .padding(17)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MISILTheme.surface)
        .overlay { RoundedRectangle(cornerRadius: 14).stroke(MISILTheme.border) }
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private struct LocalStorageCard: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Este nodo").font(.system(size: 18, weight: .bold))
            MISILSection {
                StorageValueRow(label: "Cuota local", value: appState.storageSnapshot.quotaBytes.misilFileSize, icon: "externaldrive")
                Divider().overlay(MISILTheme.border)
                StorageValueRow(label: "Utilizado", value: appState.storageSnapshot.usedBytes.misilFileSize, icon: "internaldrive")
                Divider().overlay(MISILTheme.border)
                StorageValueRow(label: "Libre en la cuota", value: appState.storageSnapshot.availableWithinQuota.misilFileSize, icon: "arrow.down.to.line")
            }
            MISILSection {
                MISILRow {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Directorio cifrado del nodo").font(.system(size: 13, weight: .semibold))
                        Text(appState.configuration?.storageDirectory ?? "")
                            .font(.system(size: 10, design: .monospaced))
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
        }
    }
}

private struct InactiveNodeCard: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 5) {
                Text("Este Mac todavía no aporta espacio").font(.system(size: 17, weight: .bold))
                Text("Activa una cuota para que aparezca como nodo disponible en la red.")
                    .font(.system(size: 12))
                    .foregroundStyle(MISILTheme.textSecondary)
            }
            Spacer()
            Button("Compartir almacenamiento") { appState.showsContributionSetup = true }
                .buttonStyle(.bordered)
                .tint(MISILTheme.accent)
        }
        .padding(20)
        .background(MISILTheme.surface)
        .overlay { RoundedRectangle(cornerRadius: 14).stroke(MISILTheme.border) }
        .clipShape(RoundedRectangle(cornerRadius: 14))
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
            Text(value).font(.system(size: 15, weight: .semibold, design: .monospaced))
        }
    }
}
