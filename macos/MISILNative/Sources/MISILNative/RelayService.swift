import CryptoKit
import Foundation
import Security

struct NativeRelayIdentity: Codable, Equatable, Sendable {
    let version: Int
    let baseURL: String
    let roomID: String
    let accessToken: String
    let encryptionKey: String
    let deviceID: String
    let displayName: String
    let createdAt: String

    var accessCode: String {
        let secret = SharedRoomSecret(v: 1, r: roomID, t: accessToken, k: encryptionKey)
        guard let data = try? JSONEncoder().encode(secret) else { return "" }
        return data.base64URLString
    }
}

struct NativeRelayMessage: Identifiable, Equatable, Sendable {
    let id: UUID
    let content: String
    let createdAt: Date
    let senderID: UUID
    let senderName: String
}

enum RelayServiceError: LocalizedError {
    case invalidEndpoint
    case invalidAccessCode
    case invalidResponse
    case relay(String)

    var errorDescription: String? {
        switch self {
        case .invalidEndpoint: "La dirección del relay no es válida."
        case .invalidAccessCode: "El código privado no es válido."
        case .invalidResponse: "El relay devolvió una respuesta inesperada."
        case .relay(let message): message
        }
    }
}

actor RelayService {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func createRoom(displayName: String, baseURL: String) async throws -> NativeRelayIdentity {
        let identity = NativeRelayIdentity(
            version: 1,
            baseURL: try normalizedBaseURL(baseURL),
            roomID: UUID().uuidString.lowercased(),
            accessToken: try randomSecret(),
            encryptionKey: try randomSecret(),
            deviceID: UUID().uuidString.lowercased(),
            displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        let body = RoomRegistration(
            roomId: identity.roomID,
            tokenHash: SHA256.hash(data: Data(identity.accessToken.utf8)).hexString
        )
        _ = try await request(identity: identity, path: "/api/relay/rooms", method: "POST", body: body, authorized: false) as EmptyResponse
        return identity
    }

    func joinRoom(code: String, displayName: String, baseURL: String) async throws -> NativeRelayIdentity {
        guard let secretData = Data(base64URL: code.trimmingCharacters(in: .whitespacesAndNewlines)),
              let secret = try? JSONDecoder().decode(SharedRoomSecret.self, from: secretData),
              secret.v == 1,
              Data(base64URL: secret.k)?.count == 32
        else { throw RelayServiceError.invalidAccessCode }

        let identity = NativeRelayIdentity(
            version: 1,
            baseURL: try normalizedBaseURL(baseURL),
            roomID: secret.r,
            accessToken: secret.t,
            encryptionKey: secret.k,
            deviceID: UUID().uuidString.lowercased(),
            displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        _ = try await messages(identity: identity)
        return identity
    }

    func send(_ content: String, identity: NativeRelayIdentity) async throws -> NativeRelayMessage {
        let messageID = UUID()
        let createdAt = ISO8601DateFormatter().string(from: Date())
        let senderID = UUID(uuidString: identity.deviceID) ?? UUID()
        let payload = RelayPayload(
            id: messageID.uuidString.lowercased(),
            content: content,
            createdAt: createdAt,
            sender: .init(id: senderID.uuidString.lowercased(), displayName: identity.displayName)
        )
        let plain = try JSONEncoder().encode(payload)
        guard let keyData = Data(base64URL: identity.encryptionKey) else { throw RelayServiceError.invalidAccessCode }
        let sealed = try AES.GCM.seal(plain, using: SymmetricKey(data: keyData))
        let encrypted = sealed.ciphertext + sealed.tag
        let envelope = OutgoingEnvelope(
            roomId: identity.roomID,
            id: payload.id,
            ciphertext: encrypted.base64URLString,
            iv: Data(sealed.nonce).base64URLString,
            createdAt: createdAt
        )
        _ = try await request(identity: identity, path: "/api/relay/messages", method: "POST", body: envelope, authorized: true) as EmptyResponse
        return NativeRelayMessage(id: messageID, content: content, createdAt: Date(), senderID: senderID, senderName: identity.displayName)
    }

    func messages(identity: NativeRelayIdentity) async throws -> [NativeRelayMessage] {
        guard let room = identity.roomID.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            throw RelayServiceError.invalidAccessCode
        }
        let response: EnvelopeList = try await request(
            identity: identity,
            path: "/api/relay/messages?roomId=\(room)",
            method: "GET",
            body: Optional<EmptyResponse>.none,
            authorized: true
        )
        guard let keyData = Data(base64URL: identity.encryptionKey) else { throw RelayServiceError.invalidAccessCode }
        let key = SymmetricKey(data: keyData)
        let formatter = ISO8601DateFormatter()

        return response.messages.compactMap { envelope in
            guard let encrypted = Data(base64URL: envelope.ciphertext), encrypted.count > 16,
                  let nonceData = Data(base64URL: envelope.iv),
                  let nonce = try? AES.GCM.Nonce(data: nonceData)
            else { return nil }
            let ciphertext = encrypted.dropLast(16)
            let tag = encrypted.suffix(16)
            guard let box = try? AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag),
                  let plain = try? AES.GCM.open(box, using: key),
                  let payload = try? JSONDecoder().decode(RelayPayload.self, from: plain),
                  payload.id == envelope.id,
                  let id = UUID(uuidString: payload.id),
                  let senderID = UUID(uuidString: payload.sender.id)
            else { return nil }
            return NativeRelayMessage(
                id: id,
                content: payload.content,
                createdAt: formatter.date(from: payload.createdAt) ?? Date(),
                senderID: senderID,
                senderName: payload.sender.displayName
            )
        }.sorted { $0.createdAt < $1.createdAt }
    }

    private func request<Response: Decodable, Body: Encodable>(
        identity: NativeRelayIdentity,
        path: String,
        method: String,
        body: Body?,
        authorized: Bool
    ) async throws -> Response {
        guard let url = URL(string: identity.baseURL + path) else { throw RelayServiceError.invalidEndpoint }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if authorized { request.setValue("Bearer \(identity.accessToken)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw RelayServiceError.invalidResponse }
        if !(200..<300).contains(http.statusCode) {
            let failure = try? JSONDecoder().decode(RelayFailure.self, from: data)
            throw RelayServiceError.relay(failure?.error ?? "El relay respondió con \(http.statusCode).")
        }
        if Response.self == EmptyResponse.self, data.isEmpty == false,
           let decoded = try? JSONDecoder().decode(Response.self, from: data) { return decoded }
        if Response.self == EmptyResponse.self { return EmptyResponse() as! Response }
        return try JSONDecoder().decode(Response.self, from: data)
    }

    private func normalizedBaseURL(_ value: String) throws -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: trimmed), ["http", "https"].contains(url.scheme), url.host != nil else {
            throw RelayServiceError.invalidEndpoint
        }
        return trimmed
    }

    private func randomSecret() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else { throw StorageSetupError.keychainFailure(status) }
        return Data(bytes).base64URLString
    }
}

private struct SharedRoomSecret: Codable { let v: Int; let r: String; let t: String; let k: String }
private struct RoomRegistration: Codable { let roomId: String; let tokenHash: String }
private struct OutgoingEnvelope: Codable { let roomId: String; let id: String; let ciphertext: String; let iv: String; let createdAt: String }
private struct EnvelopeList: Codable { let messages: [IncomingEnvelope] }
private struct IncomingEnvelope: Codable { let id: String; let ciphertext: String; let iv: String; let createdAt: String }
private struct RelayPayload: Codable {
    let id: String
    let content: String
    let createdAt: String
    let sender: Sender
    struct Sender: Codable { let id: String; let displayName: String }
}
private struct RelayFailure: Codable { let error: String }
private struct EmptyResponse: Codable { init() {} }

private extension Data {
    var base64URLString: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    init?(base64URL: String) {
        var normalized = base64URL.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        normalized += String(repeating: "=", count: (4 - normalized.count % 4) % 4)
        self.init(base64Encoded: normalized)
    }
}

private extension SHA256.Digest {
    var hexString: String { map { String(format: "%02x", $0) }.joined() }
}
