import CryptoKit
import Foundation

struct AgerbotSemanticVersion: Comparable, Codable, Equatable, Hashable, Sendable, CustomStringConvertible {
    let major: Int
    let minor: Int
    let patch: Int
    let prerelease: String?

    init?(_ value: String) {
        let normalized = value.hasPrefix("v") ? String(value.dropFirst()) : value
        let withoutMetadata = normalized.split(separator: "+", maxSplits: 1).first.map(String.init) ?? normalized
        let components = withoutMetadata.split(separator: "-", maxSplits: 1).map(String.init)
        let numbers = components[0].split(separator: ".")
        guard numbers.count == 3,
              let major = Int(numbers[0]), let minor = Int(numbers[1]), let patch = Int(numbers[2]),
              major >= 0, minor >= 0, patch >= 0 else { return nil }
        self.major = major
        self.minor = minor
        self.patch = patch
        prerelease = components.count == 2 && !components[1].isEmpty ? components[1] : nil
    }

    var description: String {
        "\(major).\(minor).\(patch)" + (prerelease.map { "-\($0)" } ?? "")
    }

    static func < (lhs: Self, rhs: Self) -> Bool {
        if lhs.major != rhs.major { return lhs.major < rhs.major }
        if lhs.minor != rhs.minor { return lhs.minor < rhs.minor }
        if lhs.patch != rhs.patch { return lhs.patch < rhs.patch }
        switch (lhs.prerelease, rhs.prerelease) {
        case (nil, nil): return false
        case (nil, _): return false
        case (_, nil): return true
        case let (left?, right?): return left.localizedStandardCompare(right) == .orderedAscending
        }
    }
}

struct AgerbotModelManifest: Codable, Equatable, Sendable {
    struct Model: Codable, Equatable, Sendable {
        let name: String
        let version: String
        let trainingName: String
        let architecture: String
        let tokenizer: String
        let parameters: Int
        let contextLength: Int
    }
    struct Runtime: Codable, Equatable, Sendable {
        let minimumVersion: String
        let maximumVersion: String?
    }
    struct Checkpoint: Codable, Equatable, Sendable {
        let filename: String
        let sizeBytes: UInt64
        let sha256: String
    }
    struct Compatibility: Codable, Equatable, Sendable {
        let devices: [String]
        let platforms: [String]
    }
    let schemaVersion: Int
    let channel: String
    let model: Model
    let runtime: Runtime
    let checkpoint: Checkpoint
    let compatibility: Compatibility
    let publishedAt: String?
}

enum AgerbotModelSource: String, Codable, Equatable, Sendable {
    case managed
    case development
}

struct AgerbotModelCandidate: Equatable, Sendable, Identifiable {
    var id: String { "\(source.rawValue)-\(manifest.model.version)-\(checkpointURL.path)" }
    let manifest: AgerbotModelManifest
    let manifestURL: URL
    let checkpointURL: URL
    let source: AgerbotModelSource

    var version: AgerbotSemanticVersion { AgerbotSemanticVersion(manifest.model.version)! }
}

actor AgerbotModelDiscoveryService {
    static let runtimeVersion = AgerbotSemanticVersion("0.2.0")!

    private let fileManager: FileManager
    private let platform: String
    private let devices: Set<String>

    init(
        fileManager: FileManager = .default,
        platform: String = AgerbotModelDiscoveryService.currentPlatform,
        devices: Set<String> = AgerbotModelDiscoveryService.currentDevices
    ) {
        self.fileManager = fileManager
        self.platform = platform
        self.devices = devices
    }

    func discover(managedRoot: URL, developmentProject: URL?) -> [AgerbotModelCandidate] {
        var locations: [(URL, AgerbotModelSource)] = manifestLocations(
            in: managedRoot.appendingPathComponent("models", isDirectory: true)
        ).map { ($0, .managed) }
        if let developmentProject {
            locations += manifestLocations(
                in: developmentProject.appendingPathComponent("checkpoints", isDirectory: true)
            ).map { ($0, .development) }
        }

        var seen = Set<String>()
        return locations.compactMap { manifestURL, source in
            guard seen.insert(manifestURL.standardizedFileURL.path).inserted else { return nil }
            return validatedCandidate(manifestURL: manifestURL, source: source)
        }.sorted { $0.version > $1.version }
    }

    func select(
        from candidates: [AgerbotModelCandidate],
        pinnedVersion: String?,
        automaticUpdates: Bool,
        allowPrerelease: Bool
    ) -> AgerbotModelCandidate? {
        let eligible = candidates.filter { allowPrerelease || $0.version.prerelease == nil }
        if !automaticUpdates, let pinnedVersion {
            return eligible.first { $0.manifest.model.version == pinnedVersion }
        }
        return eligible.first
    }

    private func manifestLocations(in root: URL) -> [URL] {
        guard let children = try? fileManager.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }
        return children.compactMap { child in
            let manifest = child.appendingPathComponent("manifest.json")
            return fileManager.fileExists(atPath: manifest.path) ? manifest : nil
        }
    }

    private func validatedCandidate(
        manifestURL: URL,
        source: AgerbotModelSource
    ) -> AgerbotModelCandidate? {
        guard let data = try? Data(contentsOf: manifestURL),
              let manifest = try? JSONDecoder().decode(AgerbotModelManifest.self, from: data),
              manifest.schemaVersion == 2,
              manifest.channel == "stable",
              manifest.model.name == "Agerbot",
              manifest.model.architecture == "agerbot-transformer",
              ["byte-v1", "char-v1"].contains(manifest.model.tokenizer),
              AgerbotSemanticVersion(manifest.model.version) != nil,
              let minimum = AgerbotSemanticVersion(manifest.runtime.minimumVersion),
              minimum <= Self.runtimeVersion,
              manifest.compatibility.platforms.contains(platform),
              !devices.isDisjoint(with: manifest.compatibility.devices) else { return nil }
        if let maximumValue = manifest.runtime.maximumVersion {
            guard let maximum = AgerbotSemanticVersion(maximumValue), Self.runtimeVersion <= maximum else {
                return nil
            }
        }
        let checkpointURL = manifestURL.deletingLastPathComponent()
            .appendingPathComponent(manifest.checkpoint.filename)
        guard let attributes = try? fileManager.attributesOfItem(atPath: checkpointURL.path),
              let size = attributes[.size] as? NSNumber,
              size.uint64Value == manifest.checkpoint.sizeBytes,
              sha256(of: checkpointURL) == manifest.checkpoint.sha256.lowercased() else { return nil }
        return AgerbotModelCandidate(
            manifest: manifest,
            manifestURL: manifestURL,
            checkpointURL: checkpointURL,
            source: source
        )
    }

    private func sha256(of fileURL: URL) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: fileURL) else { return nil }
        defer { try? handle.close() }
        var hasher = SHA256()
        do {
            while let data = try handle.read(upToCount: 1024 * 1024), !data.isEmpty {
                hasher.update(data: data)
            }
        } catch {
            return nil
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    static var currentPlatform: String {
#if arch(arm64)
        let architecture = "arm64"
#else
        let architecture = "x64"
#endif
#if os(macOS)
        return "macos-\(architecture)"
#elseif os(Windows)
        return "windows-\(architecture)"
#else
        return "linux-\(architecture)"
#endif
    }

    static var currentDevices: Set<String> {
#if os(macOS)
        return ["cpu", "mps"]
#else
        return ["cpu", "cuda"]
#endif
    }
}

enum AgerbotDevelopmentLocator {
    static func projectURL(fileManager: FileManager = .default) -> URL? {
        if let configured = ProcessInfo.processInfo.environment["MISIL_AGERBOT_DEVELOPMENT_PROJECT"],
           fileManager.fileExists(atPath: configured) {
            return URL(fileURLWithPath: configured, isDirectory: true)
        }
        var ancestor = Bundle.main.bundleURL.deletingLastPathComponent()
        for _ in 0 ..< 8 {
            let sibling = ancestor.appendingPathComponent("Agerbot", isDirectory: true)
            if fileManager.fileExists(atPath: sibling.appendingPathComponent("pyproject.toml").path) {
                return sibling
            }
            ancestor.deleteLastPathComponent()
        }
        return nil
    }
}
