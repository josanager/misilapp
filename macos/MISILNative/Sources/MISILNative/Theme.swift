import AppKit
import SwiftUI

enum MISILTheme {
    static let background = Color(red: 21 / 255, green: 0, blue: 0)
    static let sidebar = Color(red: 30 / 255, green: 0, blue: 0)
    static let surface = Color(red: 38 / 255, green: 0, blue: 0)
    static let hover = Color(red: 51 / 255, green: 0, blue: 0)
    static let active = Color(red: 77 / 255, green: 0, blue: 0)
    static let accent = Color(red: 1, green: 55 / 255, blue: 55 / 255)
    static let accentHover = Color(red: 1, green: 85 / 255, blue: 85 / 255)
    static let danger = Color(red: 239 / 255, green: 83 / 255, blue: 80 / 255)
    static let textPrimary = Color(red: 245 / 255, green: 245 / 255, blue: 245 / 255)
    static let textSecondary = Color(red: 139 / 255, green: 155 / 255, blue: 171 / 255)
    static let textMuted = Color(red: 108 / 255, green: 120 / 255, blue: 131 / 255)
    static let border = Color.white.opacity(0.09)
}

struct MISILPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(configuration.isPressed ? MISILTheme.accentHover : MISILTheme.accent)
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
    }
}

struct MISILSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(MISILTheme.textPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(configuration.isPressed ? MISILTheme.hover : MISILTheme.surface)
            .overlay {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(MISILTheme.border)
            }
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
    }
}

struct MISILBrandMark: View {
    var size: CGFloat = 40

    var body: some View {
        Group {
            if let logo = Self.logoImage {
                Image(nsImage: logo)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            } else {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: size * 0.58, weight: .bold))
                    .rotationEffect(.degrees(-12))
                    .foregroundStyle(MISILTheme.accent)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private static let logoImage: NSImage? = {
        guard let url = Bundle.main.url(forResource: "MISILLogo", withExtension: "svg") else {
            return nil
        }
        return NSImage(contentsOf: url)
    }()
}

struct MISILSection<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .background(MISILTheme.surface)
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(MISILTheme.border)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct MISILRow<Leading: View, Trailing: View>: View {
    @ViewBuilder var leading: Leading
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(spacing: 14) {
            leading
            Spacer(minLength: 20)
            trailing
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}
