import AppKit
import SwiftUI

@main
struct MISILNativeApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .preferredColorScheme(.dark)
                .task {
                    await appState.load()
                }
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1040, height: 700)
        .commands {
            CommandGroup(replacing: .newItem) { }
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        NSWindow.allowsAutomaticWindowTabbing = false
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ZStack {
            MISILTheme.background.ignoresSafeArea()
            if appState.isLoading {
                VStack(spacing: 14) {
                    MISILBrandMark(size: 54)
                    ProgressView()
                        .controlSize(.small)
                        .tint(MISILTheme.accent)
                }
            } else if !appState.hasCompletedOnboarding {
                OnboardingView()
            } else {
                MainShellView()
            }
        }
        .frame(minWidth: 820, minHeight: 580)
        .foregroundStyle(MISILTheme.textPrimary)
    }
}
