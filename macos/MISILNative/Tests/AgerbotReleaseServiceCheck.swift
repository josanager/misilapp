import CryptoKit
import Foundation

actor MockAgerbotHTTPTransport: AgerbotHTTPTransport {
    struct Response: Sendable {
        let data: Data
        let status: Int
    }
    let responses: [URL: Response]

    init(responses: [URL: Response]) { self.responses = responses }

    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        guard let response = responses[request.url!],
              let http = HTTPURLResponse(
                url: request.url!,
                statusCode: response.status,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
              ) else { throw AgerbotReleaseError.invalidResponse }
        return (response.data, http)
    }
}

@main
struct AgerbotReleaseServiceCheck {
    static let endpoint = URL(string: "https://api.test/releases/latest")!
    static let manifestURL = URL(string: "https://assets.test/agerbot-release.json")!
    static let modelURL = URL(string: "https://assets.test/agerbot-model-0.2.0.pt")!
    static let evaluationURL = URL(string: "https://assets.test/agerbot-evaluation-0.2.0.json")!
    static let checksumsURL = URL(string: "https://assets.test/checksums-sha256.txt")!

    static func main() async throws {
        let payload = Data("checkpoint-simulado-v2".utf8)
        let digest = SHA256.hash(data: payload).map { String(format: "%02x", $0) }.joined()
        let manifest = manifestData(digest: digest, size: payload.count)
        let release = releaseData(size: payload.count)
        let transport = MockAgerbotHTTPTransport(responses: [
            endpoint: .init(data: release, status: 200),
            manifestURL: .init(data: manifest, status: 200),
        ])
        let service = AgerbotReleaseService(
            transport: transport,
            platform: "macos-arm64",
            devices: ["cpu", "mps"],
            endpoint: endpoint
        )
        let candidate = try await service.latestCompatible(
            installedVersion: "0.1.0",
            allowPrerelease: false
        )
        precondition(candidate.manifest.release.version == "0.2.0")
        precondition(candidate.checkpointAsset.browserDownloadURL == modelURL)

        try await expect(.notNewer) {
            _ = try await service.latestCompatible(installedVersion: "0.2.0", allowPrerelease: false)
        }
        try await expect(.noPublishedRelease) {
            let draftService = makeService(release: releaseData(size: payload.count, draft: true), manifest: manifest)
            _ = try await draftService.latestCompatible(installedVersion: "0.1.0", allowPrerelease: false)
        }
        try await expect(.noPublishedRelease) {
            let prereleaseService = makeService(release: releaseData(size: payload.count, prerelease: true), manifest: manifest)
            _ = try await prereleaseService.latestCompatible(installedVersion: "0.1.0", allowPrerelease: false)
        }
        try await expect(.incompatibleRelease) {
            let incompatible = makeService(
                release: release,
                manifest: manifestData(digest: digest, size: payload.count, minimumRuntime: "9.0.0")
            )
            _ = try await incompatible.latestCompatible(installedVersion: "0.1.0", allowPrerelease: false)
        }

        let temporary = FileManager.default.temporaryDirectory
            .appendingPathComponent("misil-release-check-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: temporary) }
        try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
        let downloaded = temporary.appendingPathComponent("download.tmp")
        try payload.write(to: downloaded)
        let staged = try await AgerbotArtifactStager().verifyAndStage(
            downloadedFile: downloaded,
            candidate: candidate,
            stagingRoot: temporary.appendingPathComponent("staging")
        )
        precondition(FileManager.default.fileExists(atPath: staged.path))
        precondition(staged.deletingLastPathComponent().lastPathComponent == "staging")

        try Data("corrupto".utf8).write(to: downloaded, options: .atomic)
        try await expect(.artifactSizeMismatch) {
            _ = try await AgerbotArtifactStager().verifyAndStage(
                downloadedFile: downloaded,
                candidate: candidate,
                stagingRoot: temporary.appendingPathComponent("bad")
            )
        }

        let sameSizeCorrupt = Data(repeating: 0, count: payload.count)
        try sameSizeCorrupt.write(to: downloaded, options: .atomic)
        try await expect(.artifactHashMismatch) {
            _ = try await AgerbotArtifactStager().verifyAndStage(
                downloadedFile: downloaded,
                candidate: candidate,
                stagingRoot: temporary.appendingPathComponent("bad-hash")
            )
        }
        print("AgerbotReleaseService: 11 comprobaciones simuladas superadas")
    }

    static func makeService(release: Data, manifest: Data) -> AgerbotReleaseService {
        AgerbotReleaseService(
            transport: MockAgerbotHTTPTransport(responses: [
                endpoint: .init(data: release, status: 200),
                manifestURL: .init(data: manifest, status: 200),
            ]),
            platform: "macos-arm64",
            devices: ["cpu", "mps"],
            endpoint: endpoint
        )
    }

    static func releaseData(size: Int, draft: Bool = false, prerelease: Bool = false) -> Data {
        json([
            "tag_name": "model-v0.2.0",
            "name": "Agerbot Model 0.2.0 — Gastronomía peruana v2",
            "draft": draft,
            "prerelease": prerelease,
            "published_at": "2026-08-25T00:00:00Z",
            "assets": [
                asset("agerbot-release.json", 100, manifestURL),
                asset("agerbot-model-0.2.0.pt", size, modelURL),
                asset("agerbot-evaluation-0.2.0.json", 100, evaluationURL),
                asset("checksums-sha256.txt", 100, checksumsURL),
            ],
        ])
    }

    static func manifestData(digest: String, size: Int, minimumRuntime: String = "0.2.0") -> Data {
        json([
            "schemaVersion": 2,
            "channel": "stable",
            "release": [
                "version": "0.2.0",
                "tag": "model-v0.2.0",
                "publishedAt": "2026-08-25T00:00:00Z",
            ],
            "model": [
                "name": "Agerbot",
                "trainingName": "gastronomia-peruana-v2",
                "architecture": "agerbot-transformer",
                "tokenizer": "char-v1",
                "parameters": 10_773_504,
                "contextLength": 256,
            ],
            "runtime": ["minimumVersion": minimumRuntime],
            "artifact": [
                "assetName": "agerbot-model-0.2.0.pt",
                "sizeBytes": size,
                "sha256": digest,
            ],
            "evaluation": [
                "assetName": "agerbot-evaluation-0.2.0.json",
                "status": "experimental",
            ],
            "compatibility": [
                "platforms": ["macos-arm64", "windows-x64"],
                "devices": ["cpu", "mps", "cuda"],
            ],
        ])
    }

    static func asset(_ name: String, _ size: Int, _ url: URL) -> [String: Any] {
        ["name": name, "size": size, "browser_download_url": url.absoluteString]
    }

    static func json(_ object: Any) -> Data {
        try! JSONSerialization.data(withJSONObject: object)
    }

    static func expect(
        _ expected: AgerbotReleaseError,
        operation: () async throws -> Void
    ) async throws {
        do {
            try await operation()
            preconditionFailure("Se esperaba \(expected)")
        } catch let error as AgerbotReleaseError {
            precondition(error == expected)
        }
    }
}
