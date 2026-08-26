import Foundation

enum AppRoute: String, CaseIterable, Identifiable {
    case chats
    case dashboard
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .chats: "Chats"
        case .dashboard: "Dashboard"
        case .settings: "Ajustes"
        }
    }

    var systemImage: String {
        switch self {
        case .chats: "bubble.left.and.bubble.right"
        case .dashboard: "externaldrive"
        case .settings: "gearshape"
        }
    }
}

struct AppConfiguration: Codable, Equatable, Sendable {
    static let currentSchemaVersion = 1

    let schemaVersion: Int
    var onboardingCompleted: Bool
    var sharesStorage: Bool
    var quotaBytes: UInt64
    var storageDirectory: String
    var configuredAt: Date

    init(
        onboardingCompleted: Bool,
        sharesStorage: Bool,
        quotaBytes: UInt64,
        storageDirectory: String,
        configuredAt: Date = Date()
    ) {
        self.schemaVersion = Self.currentSchemaVersion
        self.onboardingCompleted = onboardingCompleted
        self.sharesStorage = sharesStorage
        self.quotaBytes = quotaBytes
        self.storageDirectory = storageDirectory
        self.configuredAt = configuredAt
    }
}

struct StorageSnapshot: Equatable, Sendable {
    var quotaBytes: UInt64
    var usedBytes: UInt64
    var diskAvailableBytes: UInt64

    var availableWithinQuota: UInt64 {
        quotaBytes > usedBytes ? quotaBytes - usedBytes : 0
    }
}

struct SetupProgress: Equatable, Sendable {
    var fraction: Double
    var title: String
    var detail: String

    static let idle = SetupProgress(
        fraction: 0,
        title: "Preparando MISIL",
        detail: "Comprobando este Mac"
    )
}

enum StoragePolicy {
    static let bytesPerGiB: UInt64 = 1_073_741_824
    static let minimumGiB = 10
    static let safetyReserveGiB = 5
    static let presets = [10, 50, 100, 500]

    static func bytes(forGiB gibibytes: Int) -> UInt64 {
        guard gibibytes > 0 else { return 0 }
        return UInt64(gibibytes) * bytesPerGiB
    }

    static func maxShareableGiB(availableBytes: UInt64) -> Int {
        let reserve = bytes(forGiB: safetyReserveGiB)
        guard availableBytes > reserve else { return 0 }
        return Int((availableBytes - reserve) / bytesPerGiB)
    }

    static func validate(gibibytes: Int, availableBytes: UInt64) throws {
        guard gibibytes >= minimumGiB else {
            throw StorageSetupError.belowMinimum
        }
        guard gibibytes <= maxShareableGiB(availableBytes: availableBytes) else {
            throw StorageSetupError.insufficientDiskSpace
        }
    }
}

enum StorageSetupError: LocalizedError, Equatable {
    case belowMinimum
    case insufficientDiskSpace
    case cannotCreateDirectory
    case cannotWriteConfiguration
    case keychainFailure(Int32)

    var errorDescription: String? {
        switch self {
        case .belowMinimum:
            "La aportación personalizada debe ser de al menos 10 GB."
        case .insufficientDiskSpace:
            "Este Mac no tiene espacio libre suficiente para esa cuota."
        case .cannotCreateDirectory:
            "MISIL no pudo crear su directorio privado de almacenamiento."
        case .cannotWriteConfiguration:
            "MISIL no pudo guardar la configuración local."
        case .keychainFailure:
            "MISIL no pudo proteger la clave local en el Llavero de macOS."
        }
    }
}

extension UInt64 {
    var misilFileSize: String {
        ByteCountFormatter.string(fromByteCount: Int64(clamping: self), countStyle: .binary)
    }
}
