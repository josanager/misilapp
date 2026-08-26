import AppKit
import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            DetailHeader(title: "Almacenamiento local", subtitle: "Controla la cuota cifrada de este Mac")
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    LocalOverviewCard()
                    HStack(spacing: 12) {
                        MetricCard(label: "CUOTA", value: quota)
                        MetricCard(label: "UTILIZADO", value: appState.storageSnapshot.usedBytes.misilFileSize)
                        MetricCard(label: "LIBRE", value: free, accented: true)
                    }
                    if appState.sharesStorage { StorageDirectoryCard() } else { InactiveStorageCard() }
                    HStack(spacing: 8) {
                        Image(systemName: "desktopcomputer").foregroundStyle(MISILTheme.accent)
                        Text("Esta vista funciona de forma local y no depende de servicios web.")
                            .font(.system(size: 10)).foregroundStyle(MISILTheme.textMuted)
                    }
                    .padding(13)
                    .background(MISILTheme.surface.opacity(0.65))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .padding(28)
                .frame(maxWidth: 820, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
        .task { await appState.refreshStorage() }
    }

    private var quota: String { appState.sharesStorage ? appState.storageSnapshot.quotaBytes.misilFileSize : "0 B" }
    private var free: String { appState.sharesStorage ? appState.storageSnapshot.availableWithinQuota.misilFileSize : "0 B" }
}

private struct LocalOverviewCard: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 7) {
                    Text("CUOTA DE ESTE MAC").font(.system(size: 10, weight: .bold)).tracking(1.1).foregroundStyle(MISILTheme.textSecondary)
                    Text(appState.sharesStorage ? appState.storageSnapshot.quotaBytes.misilFileSize : "0 B")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                    Text("Los archivos permanecen cifrados en este equipo.")
                        .font(.system(size: 13)).foregroundStyle(MISILTheme.textSecondary)
                }
                Spacer()
                HStack(spacing: 7) {
                    Circle().fill(appState.sharesStorage ? Color.green : MISILTheme.textMuted).frame(width: 7, height: 7)
                    Text(appState.sharesStorage ? "ACTIVO" : "INACTIVO").font(.system(size: 10, weight: .bold))
                }
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(Color.white.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            ProgressView(
                value: Double(appState.storageSnapshot.usedBytes),
                total: Double(max(1, appState.storageSnapshot.quotaBytes))
            ).tint(MISILTheme.accent)
            HStack {
                Text("\(appState.storageSnapshot.usedBytes.misilFileSize) utilizados")
                Spacer()
                Text("\(appState.storageSnapshot.availableWithinQuota.misilFileSize) libres")
            }.font(.system(size: 10, weight: .medium)).foregroundStyle(MISILTheme.textMuted)
        }
        .padding(24)
        .background(LinearGradient(colors: [MISILTheme.accent.opacity(0.26), MISILTheme.surface, Color.white.opacity(0.04)], startPoint: .topLeading, endPoint: .bottomTrailing))
        .overlay { RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(MISILTheme.accent.opacity(0.36)) }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct MetricCard: View {
    let label: String
    let value: String
    var accented = false
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label).font(.system(size: 9, weight: .bold)).foregroundStyle(MISILTheme.textMuted)
            Text(value).font(.system(size: 23, weight: .bold, design: .rounded)).foregroundStyle(accented ? MISILTheme.accent : MISILTheme.textPrimary)
        }
        .padding(17).frame(maxWidth: .infinity, alignment: .leading)
        .background(MISILTheme.surface)
        .overlay { RoundedRectangle(cornerRadius: 14).stroke(MISILTheme.border) }
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private struct StorageDirectoryCard: View {
    @EnvironmentObject private var appState: AppState
    var body: some View {
        MISILSection {
            MISILRow {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Directorio privado").font(.system(size: 13, weight: .semibold))
                    Text(appState.configuration?.storageDirectory ?? "")
                        .font(.system(size: 10, design: .monospaced)).foregroundStyle(MISILTheme.textMuted).lineLimit(1).truncationMode(.middle)
                }
            } trailing: {
                Button("Mostrar en Finder") {
                    guard let path = appState.configuration?.storageDirectory else { return }
                    NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: path)
                }.buttonStyle(.bordered).tint(MISILTheme.accent)
            }
        }
    }
}

private struct InactiveStorageCard: View {
    @EnvironmentObject private var appState: AppState
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 5) {
                Text("El almacenamiento está desactivado").font(.system(size: 17, weight: .bold))
                Text("Configura una cuota local para reservar espacio cifrado en este Mac.").font(.system(size: 12)).foregroundStyle(MISILTheme.textSecondary)
            }
            Spacer()
            Button("Configurar cuota") { appState.showsContributionSetup = true }.buttonStyle(.bordered).tint(MISILTheme.accent)
        }
        .padding(20).background(MISILTheme.surface)
        .overlay { RoundedRectangle(cornerRadius: 14).stroke(MISILTheme.border) }
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
