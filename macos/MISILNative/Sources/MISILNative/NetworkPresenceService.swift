import CryptoKit
import Foundation

enum NetworkPresenceError: LocalizedError {
    case invalidEndpoint
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidEndpoint: "La dirección de la red MISIL no es válida."
        case .invalidResponse: "La red MISIL devolvió una respuesta no válida."
        case .server(let message): message
        }
    }
}

actor NetworkPresenceService {
    static let defaultBaseURL = "https://misil-web.pages.dev"

    private let session: URLSession
    private let identity: NetworkNodeIdentity
    private var registered = false

    init(session: URLSession = .shared, identity: NetworkNodeIdentity? = nil) {
        self.session = session
        self.identity = identity ?? (try? KeychainService.loadOrCreateNetworkIdentity()) ?? .ephemeral
    }

    func heartbeat(storage: StorageSnapshot, storageHealthy: Bool) async throws -> NetworkCapacitySnapshot {
        let baseURL = try normalizedBaseURL()
        try await ensureRegistered(baseURL: baseURL)
        let body = PresenceBody(
            nodeId: identity.nodeId,
            platform: "macos",
            appVersion: "0.2.0",
            quotaBytes: storage.quotaBytes,
            usedBytes: min(storage.usedBytes, storage.quotaBytes),
            storageHealthy: storageHealthy
        )
        return try await request(
            baseURL: baseURL,
            path: "/api/network/presence",
            method: "PUT",
            body: body,
            authorized: true
        )
    }

    func capacity() async throws -> NetworkCapacitySnapshot {
        try await request(
            baseURL: normalizedBaseURL(),
            path: "/api/network/capacity",
            method: "GET",
            body: Optional<EmptyNetworkBody>.none,
            authorized: false
        )
    }

    func goOffline() async throws {
        guard registered else { return }
        let _: EmptyNetworkBody = try await request(
            baseURL: normalizedBaseURL(),
            path: "/api/network/presence",
            method: "DELETE",
            body: OfflineBody(nodeId: identity.nodeId),
            authorized: true
        )
    }

    private func ensureRegistered(baseURL: String) async throws {
        guard !registered else { return }
        let digest = SHA256.hash(data: Data(identity.accessToken.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        let _: RegistrationResponse = try await request(
            baseURL: baseURL,
            path: "/api/network/nodes",
            method: "POST",
            body: RegistrationBody(
                nodeId: identity.nodeId,
                tokenHash: digest,
                platform: "macos",
                appVersion: "0.2.0"
            ),
            authorized: false
        )
        registered = true
    }

    private func normalizedBaseURL() throws -> String {
        let value = ProcessInfo.processInfo.environment["MISIL_RELAY_URL"] ?? Self.defaultBaseURL
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: trimmed), ["http", "https"].contains(url.scheme), url.host != nil else {
            throw NetworkPresenceError.invalidEndpoint
        }
        return trimmed
    }

    private func request<Response: Decodable, Body: Encodable>(
        baseURL: String,
        path: String,
        method: String,
        body: Body?,
        authorized: Bool
    ) async throws -> Response {
        guard let url = URL(string: baseURL + path) else { throw NetworkPresenceError.invalidEndpoint }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("presence-v1", forHTTPHeaderField: "X-MISIL-Protocol")
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if authorized { request.setValue("Bearer \(identity.accessToken)", forHTTPHeaderField: "Authorization") }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw NetworkPresenceError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let failure = try? JSONDecoder().decode(NetworkFailure.self, from: data)
            throw NetworkPresenceError.server(failure?.error ?? "La red MISIL respondió con \(http.statusCode).")
        }
        if Response.self == EmptyNetworkBody.self { return EmptyNetworkBody() as! Response }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}

private struct RegistrationBody: Codable { let nodeId: String; let tokenHash: String; let platform: String; let appVersion: String }
private struct RegistrationResponse: Codable { let ok: Bool; let nodeId: String; let protocolVersion: Int }
private struct PresenceBody: Codable { let nodeId: String; let platform: String; let appVersion: String; let quotaBytes: UInt64; let usedBytes: UInt64; let storageHealthy: Bool }
private struct OfflineBody: Codable { let nodeId: String }
private struct NetworkFailure: Codable { let error: String }
private struct EmptyNetworkBody: Codable { init() {} }
