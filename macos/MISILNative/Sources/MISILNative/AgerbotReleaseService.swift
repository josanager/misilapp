import Foundation

protocol AgerbotHTTPTransport: Sendable {
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

struct AgerbotURLSessionTransport: AgerbotHTTPTransport {
    let session: URLSession

    init(session: URLSession = .shared) { self.session = session }

    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AgerbotReleaseError.invalidResponse
        }
        return (data, http)
    }
}

struct AgerbotGitHubAsset: Codable, Equatable, Sendable {
    let name: String
    let size: UInt64
    let browserDownloadURL: URL

    private enum CodingKeys: String, CodingKey {
        case name, size
        case browserDownloadURL = "browser_download_url"
    }
}

struct AgerbotGitHubRelease: Codable, Equatable, Sendable {
    let tagName: String
    let name: String?
    let draft: Bool
    let prerelease: Bool
    let publishedAt: String?
    let assets: [AgerbotGitHubAsset]

    private enum CodingKeys: String, CodingKey {
        case name, draft, prerelease, assets
        case tagName = "tag_name"
        case publishedAt = "published_at"
    }
}

struct AgerbotReleaseManifest: Codable, Equatable, Sendable {
    struct Release: Codable, Equatable, Sendable {
        let version: String
        let tag: String
        let publishedAt: String
    }
    struct Model: Codable, Equatable, Sendable {
        let name: String
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
    struct Artifact: Codable, Equatable, Sendable {
        let assetName: String
        let sizeBytes: UInt64
        let sha256: String
    }
    struct Evaluation: Codable, Equatable, Sendable {
        let assetName: String
        let status: String
    }
    struct Compatibility: Codable, Equatable, Sendable {
        let platforms: [String]
        let devices: [String]
    }
    let schemaVersion: Int
    let channel: String
    let release: Release
    let model: Model
    let runtime: Runtime
    let artifact: Artifact
    let evaluation: Evaluation
    let compatibility: Compatibility
}

struct AgerbotRemoteModelCandidate: Equatable, Sendable {
    let manifest: AgerbotReleaseManifest
    let checkpointAsset: AgerbotGitHubAsset
    let evaluationAsset: AgerbotGitHubAsset
    let checksumsAsset: AgerbotGitHubAsset
}

enum AgerbotReleaseError: LocalizedError, Equatable, Sendable {
    case noPublishedRelease
    case invalidResponse
    case invalidManifest
    case incompatibleRelease
    case missingAsset(String)
    case notNewer
    case downloadFailed
    case artifactSizeMismatch
    case artifactHashMismatch

    var errorDescription: String? {
        switch self {
        case .noPublishedRelease: "Agerbot todavía no tiene una release pública compatible."
        case .invalidResponse: "GitHub devolvió una respuesta no válida."
        case .invalidManifest: "La release de Agerbot contiene un manifiesto no válido."
        case .incompatibleRelease: "La release disponible no es compatible con este runtime o equipo."
        case let .missingAsset(name): "La release no contiene el asset obligatorio \(name)."
        case .notNewer: "No hay una versión estable más reciente."
        case .downloadFailed: "No se pudo descargar el modelo de Agerbot."
        case .artifactSizeMismatch: "El modelo descargado no tiene el tamaño declarado."
        case .artifactHashMismatch: "El modelo descargado no coincide con su SHA-256."
        }
    }
}

actor AgerbotReleaseService {
    static let owner = "josanager"
    static let repository = "Agerbot"
    static let apiVersion = "2022-11-28"

    private let transport: any AgerbotHTTPTransport
    private let platform: String
    private let devices: Set<String>
    private let endpoint: URL

    init(
        transport: any AgerbotHTTPTransport = AgerbotURLSessionTransport(),
        platform: String = AgerbotModelDiscoveryService.currentPlatform,
        devices: Set<String> = AgerbotModelDiscoveryService.currentDevices,
        endpoint: URL = URL(string: "https://api.github.com/repos/josanager/Agerbot/releases/latest")!
    ) {
        self.transport = transport
        self.platform = platform
        self.devices = devices
        self.endpoint = endpoint
    }

    func latestCompatible(
        installedVersion: String?,
        allowPrerelease: Bool
    ) async throws -> AgerbotRemoteModelCandidate {
        let release = try await fetchRelease()
        guard !release.draft else { throw AgerbotReleaseError.noPublishedRelease }
        guard allowPrerelease || !release.prerelease else {
            throw AgerbotReleaseError.noPublishedRelease
        }
        guard release.tagName.hasPrefix("model-v"),
              let tagVersion = AgerbotSemanticVersion(String(release.tagName.dropFirst("model-v".count))) else {
            throw AgerbotReleaseError.invalidManifest
        }
        if let installedVersion, let installed = AgerbotSemanticVersion(installedVersion), tagVersion <= installed {
            throw AgerbotReleaseError.notNewer
        }
        let manifestAsset = try requiredAsset(named: "agerbot-release.json", in: release)
        let manifest = try await fetchManifest(from: manifestAsset.browserDownloadURL)
        guard manifest.schemaVersion == 2,
              manifest.channel == "stable",
              manifest.release.tag == release.tagName,
              manifest.release.version == tagVersion.description,
              manifest.model.name == "Agerbot",
              manifest.model.architecture == "agerbot-transformer",
              ["byte-v1", "char-v1"].contains(manifest.model.tokenizer),
              manifest.artifact.sha256.count == 64 else {
            throw AgerbotReleaseError.invalidManifest
        }
        guard let minimum = AgerbotSemanticVersion(manifest.runtime.minimumVersion),
              minimum <= AgerbotModelDiscoveryService.runtimeVersion,
              manifest.compatibility.platforms.contains(platform),
              !devices.isDisjoint(with: manifest.compatibility.devices) else {
            throw AgerbotReleaseError.incompatibleRelease
        }
        if let maximumValue = manifest.runtime.maximumVersion {
            guard let maximum = AgerbotSemanticVersion(maximumValue),
                  AgerbotModelDiscoveryService.runtimeVersion <= maximum else {
                throw AgerbotReleaseError.incompatibleRelease
            }
        }
        let checkpoint = try requiredAsset(named: manifest.artifact.assetName, in: release)
        guard checkpoint.size == manifest.artifact.sizeBytes else {
            throw AgerbotReleaseError.invalidManifest
        }
        let evaluation = try requiredAsset(named: manifest.evaluation.assetName, in: release)
        let checksums = try requiredAsset(named: "checksums-sha256.txt", in: release)
        return AgerbotRemoteModelCandidate(
            manifest: manifest,
            checkpointAsset: checkpoint,
            evaluationAsset: evaluation,
            checksumsAsset: checksums
        )
    }

    private func fetchRelease() async throws -> AgerbotGitHubRelease {
        var request = URLRequest(url: endpoint)
        request.timeoutInterval = 15
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue(Self.apiVersion, forHTTPHeaderField: "X-GitHub-Api-Version")
        request.setValue("MISIL-Agerbot-Updater/0.2.0", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await transport.data(for: request)
        if response.statusCode == 404 { throw AgerbotReleaseError.noPublishedRelease }
        guard response.statusCode == 200,
              let release = try? JSONDecoder().decode(AgerbotGitHubRelease.self, from: data) else {
            throw AgerbotReleaseError.invalidResponse
        }
        return release
    }

    private func fetchManifest(from url: URL) async throws -> AgerbotReleaseManifest {
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        request.setValue("application/octet-stream", forHTTPHeaderField: "Accept")
        let (data, response) = try await transport.data(for: request)
        guard response.statusCode == 200,
              let manifest = try? JSONDecoder().decode(AgerbotReleaseManifest.self, from: data) else {
            throw AgerbotReleaseError.invalidManifest
        }
        return manifest
    }

    private func requiredAsset(named name: String, in release: AgerbotGitHubRelease) throws -> AgerbotGitHubAsset {
        guard let asset = release.assets.first(where: { $0.name == name }) else {
            throw AgerbotReleaseError.missingAsset(name)
        }
        return asset
    }
}
