import SwiftUI

struct MainShellView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                HStack(spacing: 9) {
                    MISILBrandMark(size: 30)
                    Text("MISIL")
                        .font(.system(size: 17, weight: .bold))
                    Spacer()
                }
                .padding(.horizontal, 16)
                .frame(height: 54)

                VStack(spacing: 4) {
                    ForEach(AppRoute.allCases) { route in
                        Button {
                            appState.route = route
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: route.systemImage)
                                    .frame(width: 18)
                                Text(route.title)
                                Spacer()
                            }
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(
                                appState.route == route
                                    ? MISILTheme.textPrimary
                                    : MISILTheme.textSecondary
                            )
                            .padding(.horizontal, 11)
                            .frame(height: 34)
                            .background(
                                appState.route == route
                                    ? MISILTheme.active
                                    : Color.clear
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                    Spacer()
                }
                .padding(.horizontal, 10)
                .padding(.top, 4)

                NodeFooter()
            }
            .background(MISILTheme.sidebar)
            .navigationSplitViewColumnWidth(min: 210, ideal: 230, max: 250)
        } detail: {
            Group {
                switch appState.route {
                case .chats:
                    NativeChatsView()
                case .dashboard:
                    DashboardView()
                case .settings:
                    SettingsView()
                }
            }
            .background(MISILTheme.background)
        }
        .navigationSplitViewStyle(.balanced)
        .toolbar(removing: .sidebarToggle)
        .sheet(isPresented: $appState.showsContributionSetup) {
            ContributionSetupView()
                .environmentObject(appState)
        }
    }
}

private struct NodeFooter: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(appState.sharesStorage ? Color(red: 69 / 255, green: 212 / 255, blue: 131 / 255) : MISILTheme.textMuted)
                .frame(width: 9, height: 9)
            VStack(alignment: .leading, spacing: 2) {
                Text(appState.sharesStorage ? "Almacenamiento activo" : "Almacenamiento inactivo")
                    .font(.system(size: 12, weight: .semibold))
                Text(appState.sharesStorage ? "Cuota local · \(appState.storageSnapshot.quotaBytes.misilFileSize)" : "Sólo datos locales")
                    .font(.system(size: 10))
                    .foregroundStyle(MISILTheme.textMuted)
            }
            Spacer()
        }
        .padding(14)
        .overlay(alignment: .top) {
            Rectangle().fill(MISILTheme.border).frame(height: 1)
        }
    }
}
