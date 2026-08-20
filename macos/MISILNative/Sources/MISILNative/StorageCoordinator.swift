import Foundation

actor StorageCoordinator {
    typealias ProgressHandler = @Sendable (SetupProgress) async -> Void

    private let fileManager: FileManager
    private let rootDirectory: URL
    private let configurationURL: URL
    private let blobsDirectory: URL
    private let temporaryDirectory: URL

    init(fileManager: FileManager = .default, rootDirectory: URL? = nil) {
        self.fileManager = fileManager
        let base = rootDirectory ?? fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first!.appendingPathComponent("MISIL", isDirectory: true)
        self.rootDirectory = base
        self.configurationURL = base.appendingPathComponent("configuration.json")
        self.blobsDirectory = base.appendingPathComponent("Storage/Blobs", isDirectory: true)
        self.temporaryDirectory = base.appendingPathComponent("Storage/Temporary", isDirectory: true)
    }

    func loadConfiguration() -> AppConfiguration? {
        guard let data = try? Data(contentsOf: configurationURL) else { return nil }
        return try? JSONDecoder.misil.decode(AppConfiguration.self, from: data)
    }

    func diskAvailableBytes() -> UInt64 {
        let values = try? rootDirectory.deletingLastPathComponent().resourceValues(
            forKeys: [.volumeAvailableCapacityForImportantUsageKey, .volumeAvailableCapacityKey]
        )
        if let important = values?.volumeAvailableCapacityForImportantUsage, important > 0 {
            return UInt64(important)
        }
        if let basic = values?.volumeAvailableCapacity, basic > 0 {
            return UInt64(basic)
        }
        return 0
    }

    func prepare(
        sharesStorage: Bool,
        quotaGiB: Int,
        progress: @escaping ProgressHandler
    ) async throws -> AppConfiguration {
        await progress(.init(
            fraction: 0.12,
            title: "Comprobando el disco",
            detail: "Reservando un margen seguro para macOS"
        ))

        if sharesStorage {
            try StoragePolicy.validate(
                gibibytes: quotaGiB,
                availableBytes: diskAvailableBytes()
            )
        }

        await progress(.init(
            fraction: 0.34,
            title: "Creando el nodo local",
            detail: "Preparando directorios privados"
        ))
        do {
            try fileManager.createDirectory(
                at: blobsDirectory,
                withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700]
            )
            try fileManager.createDirectory(
                at: temporaryDirectory,
                withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700]
            )
        } catch {
            throw StorageSetupError.cannotCreateDirectory
        }

        if sharesStorage {
            await progress(.init(
                fraction: 0.58,
                title: "Protegiendo el almacenamiento",
                detail: "Guardando una clave de 256 bits en el Llavero"
            ))
            _ = try KeychainService.loadOrCreateMasterKey()

            await progress(.init(
                fraction: 0.76,
                title: "Verificando escritura",
                detail: "Probando integridad del directorio local"
            ))
            let probeURL = temporaryDirectory.appendingPathComponent("integrity-probe")
            let probe = Data(repeating: 0x4D, count: 1_048_576)
            do {
                try probe.write(to: probeURL, options: [.atomic, .completeFileProtection])
                try fileManager.removeItem(at: probeURL)
            } catch {
                try? fileManager.removeItem(at: probeURL)
                throw StorageSetupError.cannotCreateDirectory
            }
        }

        await progress(.init(
            fraction: 0.9,
            title: "Guardando preferencias",
            detail: sharesStorage ? "Aplicando la cuota seleccionada" : "Configurando el modo local"
        ))

        let configuration = AppConfiguration(
            onboardingCompleted: true,
            sharesStorage: sharesStorage,
            quotaBytes: sharesStorage ? StoragePolicy.bytes(forGiB: quotaGiB) : 0,
            storageDirectory: blobsDirectory.path
        )
        try save(configuration)

        await progress(.init(
            fraction: 1,
            title: "MISIL está listo",
            detail: sharesStorage ? "Tu nodo local ya puede aportar espacio" : "Puedes activar el almacenamiento más adelante"
        ))
        return configuration
    }

    func snapshot(for configuration: AppConfiguration) -> StorageSnapshot {
        StorageSnapshot(
            quotaBytes: configuration.quotaBytes,
            usedBytes: directoryAllocatedSize(at: blobsDirectory),
            diskAvailableBytes: diskAvailableBytes()
        )
    }

    func resetConfiguration() {
        try? fileManager.removeItem(at: configurationURL)
    }

    private func save(_ configuration: AppConfiguration) throws {
        do {
            let data = try JSONEncoder.misil.encode(configuration)
            try data.write(to: configurationURL, options: [.atomic, .completeFileProtection])
        } catch {
            throw StorageSetupError.cannotWriteConfiguration
        }
    }

    private func directoryAllocatedSize(at directory: URL) -> UInt64 {
        guard let enumerator = fileManager.enumerator(
            at: directory,
            includingPropertiesForKeys: [.fileAllocatedSizeKey, .isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else { return 0 }

        var result: UInt64 = 0
        for case let fileURL as URL in enumerator {
            guard let values = try? fileURL.resourceValues(
                forKeys: [.fileAllocatedSizeKey, .isRegularFileKey]
            ), values.isRegularFile == true else { continue }
            result += UInt64(values.fileAllocatedSize ?? 0)
        }
        return result
    }
}

private extension JSONEncoder {
    static var misil: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

private extension JSONDecoder {
    static var misil: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
