import Foundation
import Security

enum MessagingConnectionStatus: Sendable {
    case connecting
    case online
    case offline
}

struct MessagingIdentity: Codable, Sendable {
    let deviceId: String
    let deviceKey: String
    let username: String
    let displayName: String
    let hubURL: String

    var personalLink: String { "misil://contacto/\(username)/\(deviceId)" }
}

struct HubMessage: Codable, Sendable {
    let id: String
    let senderUsername: String
    let senderDisplayName: String
    let recipientUsername: String
    let content: String
    let createdAt: String
}

private struct HubEvent: Codable {
    let type: String
    let error: String?
    let message: HubMessage?
    let messages: [HubMessage]?
}

private struct OutgoingHubMessage: Encodable {
    let type = "message.send"
    let recipientUsername: String
    let clientMessageId: String
    let content: String
    let createdAt: String
}

enum MessagingIdentityStore {
    static func loadOrCreate() -> MessagingIdentity {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first!.appendingPathComponent("MISIL", isDirectory: true)
        let fileURL = directory.appendingPathComponent("messaging-identity.json")
        if let data = try? Data(contentsOf: fileURL),
           let identity = try? JSONDecoder().decode(MessagingIdentity.self, from: data) {
            return identity
        }

        var keyBytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, keyBytes.count, &keyBytes)
        var suffixBytes = [UInt8](repeating: 0, count: 3)
        _ = SecRandomCopyBytes(kSecRandomDefault, suffixBytes.count, &suffixBytes)
        let suffix = suffixBytes.map { String(format: "%02x", $0) }.joined()
        let host = Host.current().localizedName ?? "Mac"
        var slug = host.lowercased().map { character -> Character in
            character.isASCII && (character.isLetter || character.isNumber || character == "-" || character == "_") ? character : "-"
        }
        while slug.first == "-" { slug.removeFirst() }
        while slug.last == "-" { slug.removeLast() }
        let base = String(slug.prefix(16)).count >= 3 ? String(slug.prefix(16)) : "mac"
        let hubURL = ProcessInfo.processInfo.environment["MISIL_HUB_URL"] ?? "ws://127.0.0.1:4320/v1/connect"
        let key = Data(keyBytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        let identity = MessagingIdentity(
            deviceId: UUID().uuidString.lowercased(),
            deviceKey: key,
            username: "\(base)-\(suffix)",
            displayName: host,
            hubURL: hubURL
        )
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        if let data = try? JSONEncoder().encode(identity) {
            try? data.write(to: fileURL, options: [.atomic, .completeFileProtection])
        }
        return identity
    }

    static func save(_ identity: MessagingIdentity) {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first!.appendingPathComponent("MISIL", isDirectory: true)
        let fileURL = directory.appendingPathComponent("messaging-identity.json")
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        if let data = try? JSONEncoder().encode(identity) {
            try? data.write(to: fileURL, options: [.atomic, .completeFileProtection])
        }
    }
}

actor InternetMessagingClient {
    private let identity: MessagingIdentity
    private var webSocket: URLSessionWebSocketTask?

    init(identity: MessagingIdentity) { self.identity = identity }

    func connect() throws {
        guard var components = URLComponents(string: identity.hubURL) else {
            throw URLError(.badURL)
        }
        components.queryItems = (components.queryItems ?? []) + [
            URLQueryItem(name: "deviceId", value: identity.deviceId),
            URLQueryItem(name: "key", value: identity.deviceKey),
            URLQueryItem(name: "username", value: identity.username),
            URLQueryItem(name: "displayName", value: identity.displayName),
            URLQueryItem(name: "platform", value: "macos"),
        ]
        guard let url = components.url else { throw URLError(.badURL) }
        let socket = URLSession.shared.webSocketTask(with: url)
        webSocket = socket
        socket.resume()
    }

    func receive() async throws -> [HubMessage] {
        guard let webSocket else { throw URLError(.notConnectedToInternet) }
        let frame = try await webSocket.receive()
        let data: Data
        switch frame {
        case .string(let string): data = Data(string.utf8)
        case .data(let value): data = value
        @unknown default: return []
        }
        let event = try JSONDecoder().decode(HubEvent.self, from: data)
        if event.type == "error" { throw NSError(domain: "MISILHub", code: 1, userInfo: [NSLocalizedDescriptionKey: event.error ?? "Error del Hub MISIL."]) }
        if let message = event.message, event.type == "message.received" { return [message] }
        if event.type == "messages.pending" { return event.messages ?? [] }
        return []
    }

    func send(recipient: String, content: String, id: UUID, createdAt: Date) async throws {
        guard let webSocket else { throw URLError(.notConnectedToInternet) }
        let payload = OutgoingHubMessage(
            recipientUsername: recipient,
            clientMessageId: id.uuidString.lowercased(),
            content: content,
            createdAt: ISO8601DateFormatter().string(from: createdAt)
        )
        let data = try JSONEncoder().encode(payload)
        try await webSocket.send(.string(String(decoding: data, as: UTF8.self)))
    }

    func disconnect() {
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
    }
}
