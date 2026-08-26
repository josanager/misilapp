import CryptoKit
import Foundation
import Network

struct PeerStorageNode: Identifiable, Equatable, Sendable {
    let id: String
    let username: String
    let displayName: String
    let platform: String
    let host: String
    let port: UInt16
    let quotaBytes: UInt64
    let usedBytes: UInt64
    let lastSeen: Date

    var availableBytes: UInt64 { quotaBytes > usedBytes ? quotaBytes - usedBytes : 0 }
}

@MainActor
final class PeerStorageService: ObservableObject {
    @Published private(set) var peers: [PeerStorageNode] = []
    @Published private(set) var status = "Buscando otros equipos MISIL en esta red Wi‑Fi…"

    private let identity = MessagingIdentityStore.loadOrCreate()
    private let queue = DispatchQueue(label: "com.misil.peer-storage", qos: .userInitiated)
    private var configuration: AppConfiguration?
    private var listener: NWListener?
    private var group: NWConnectionGroup?
    private var broadcastTask: Task<Void, Never>?
    private var cleanupTask: Task<Void, Never>?
    private var nodes: [String: PeerStorageNode] = [:]

    var networkQuotaBytes: UInt64 { peers.reduce(configuration?.quotaBytes ?? 0) { $0 + $1.quotaBytes } }
    var networkUsedBytes: UInt64 { peers.reduce(localUsedBytes) { $0 + $1.usedBytes } }
    var networkAvailableBytes: UInt64 { networkQuotaBytes > networkUsedBytes ? networkQuotaBytes - networkUsedBytes : 0 }

    func start(configuration: AppConfiguration?) {
        stop()
        self.configuration = configuration
        guard configuration?.sharesStorage == true, configuration?.quotaBytes ?? 0 > 0 else { return }
        do {
            let listener = try NWListener(using: .tcp, on: .any)
            self.listener = listener
            listener.newConnectionHandler = { [weak self] connection in
                Task { @MainActor in self?.handle(connection) }
            }
            listener.stateUpdateHandler = { [weak self] state in
                guard case .ready = state, let port = listener.port else { return }
                Task { @MainActor [weak self] in self?.startDiscovery(tcpPort: port.rawValue) }
            }
            listener.start(queue: queue)
        } catch {
            status = "No se pudo iniciar el nodo P2P: \(error.localizedDescription)"
        }
    }

    func stop() {
        listener?.cancel(); listener = nil
        group?.cancel(); group = nil
        broadcastTask?.cancel(); broadcastTask = nil
        cleanupTask?.cancel(); cleanupTask = nil
        nodes.removeAll(); peers = []
    }

    func testFirstPeer() async {
        guard let peer = peers.first else {
            status = "No hay otro equipo MISIL conectado a esta red Wi‑Fi."
            return
        }
        status = "Verificando escritura y lectura remotas…"
        do {
            var random = [UInt8](repeating: 0, count: 64 * 1024)
            for index in random.indices { random[index] = UInt8.random(in: .min ... .max) }
            let payload = Data(random)
            let key = SHA256.hash(data: payload).map { String(format: "%02x", $0) }.joined()
            let put = try await request(peer, operation: "put", key: key, data: payload.base64EncodedString())
            guard put.ok else { throw PeerStorageError.remote(put.error ?? "El equipo remoto rechazó la escritura.") }
            let get = try await request(peer, operation: "get", key: key, data: nil)
            guard get.ok, let encoded = get.data, let received = Data(base64Encoded: encoded), SHA256.hash(data: received) == SHA256.hash(data: payload) else {
                throw PeerStorageError.remote(get.error ?? "La verificación de integridad remota falló.")
            }
            _ = try? await request(peer, operation: "delete", key: key, data: nil)
            status = "Transferencia verificada con \(peer.displayName): 64 KB escritos, leídos y eliminados."
        } catch {
            status = error.localizedDescription
        }
    }

    private func startDiscovery(tcpPort: UInt16) {
        guard group == nil else { return }
        do {
            let multicast = try NWMulticastGroup(for: [.hostPort(host: "239.255.77.77", port: 47777)])
            let parameters = NWParameters.udp
            parameters.allowLocalEndpointReuse = true
            let group = NWConnectionGroup(with: multicast, using: parameters)
            self.group = group
            group.setReceiveHandler(maximumMessageSize: 64 * 1024, rejectOversizedMessages: true) { [weak self] message, content, _ in
                guard let self, let content, let remote = message.remoteEndpoint else { return }
                Task { @MainActor in self.receive(content, from: remote) }
            }
            group.start(queue: queue)
            broadcastTask = Task { [weak self] in
                while !Task.isCancelled {
                    self?.broadcast(tcpPort: tcpPort)
                    try? await Task.sleep(for: .seconds(2))
                }
            }
            cleanupTask = Task { [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(2))
                    self?.removeExpiredPeers()
                }
            }
        } catch {
            status = "No se pudo abrir el descubrimiento local: \(error.localizedDescription)"
        }
    }

    private func broadcast(tcpPort: UInt16) {
        guard let configuration, let group else { return }
        let value = Announcement(
            protocolName: "misil-storage-v1", deviceId: identity.deviceId, username: identity.username,
            displayName: identity.displayName, platform: "macos", port: Int(tcpPort),
            quotaBytes: configuration.quotaBytes, usedBytes: localUsedBytes
        )
        guard let data = try? JSONEncoder().encode(value) else { return }
        group.send(content: data) { _ in }
    }

    private func receive(_ data: Data, from endpoint: NWEndpoint) {
        guard let item = try? JSONDecoder().decode(Announcement.self, from: data),
              item.protocolName == "misil-storage-v1", item.deviceId != identity.deviceId,
              case .hostPort(let host, _) = endpoint, let port = UInt16(exactly: item.port)
        else { return }
        let node = PeerStorageNode(id: item.deviceId, username: item.username, displayName: item.displayName,
                                   platform: item.platform, host: "\(host)", port: port,
                                   quotaBytes: item.quotaBytes, usedBytes: item.usedBytes, lastSeen: Date())
        nodes[item.deviceId] = node
        publishNodes()
    }

    private func removeExpiredPeers() {
        nodes = nodes.filter { Date().timeIntervalSince($0.value.lastSeen) < 7 }
        publishNodes()
    }

    private func publishNodes() {
        peers = nodes.values.sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
        status = peers.isEmpty ? "Buscando otros equipos MISIL en esta red Wi‑Fi…" : "\(peers.count + 1) equipos activos · capacidad actualizada en tiempo real"
        objectWillChange.send()
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: queue)
        receiveLine(connection, accumulated: Data()) { [weak self] data in
            guard let self, let data, let request = try? JSONDecoder().decode(PeerRequest.self, from: data) else {
                connection.cancel(); return
            }
            Task {
                let response = await self.process(request)
                guard var encoded = try? JSONEncoder().encode(response) else { connection.cancel(); return }
                encoded.append(0x0A)
                connection.send(content: encoded, completion: .contentProcessed { _ in connection.cancel() })
            }
        }
    }

    private nonisolated func receiveLine(_ connection: NWConnection, accumulated: Data, completion: @escaping @Sendable (Data?) -> Void) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 1024 * 1024) { [self] content, _, complete, error in
            var result = accumulated
            if let content { result.append(content) }
            if let newline = result.firstIndex(of: 0x0A) { completion(result.prefix(upTo: newline)); return }
            if complete || error != nil || result.count > 24 * 1024 * 1024 { completion(nil); return }
            receiveLine(connection, accumulated: result, completion: completion)
        }
    }

    private func process(_ request: PeerRequest) async -> PeerResponse {
        guard let configuration, configuration.sharesStorage,
              request.key.count == 64, request.key.allSatisfy({ $0.isHexDigit }) else { return .init(ok: false, data: nil, error: "Solicitud inválida.") }
        let url = URL(fileURLWithPath: configuration.storageDirectory).appendingPathComponent(request.key.lowercased() + ".misil")
        do {
            switch request.operation {
            case "put":
                guard let encoded = request.data, let data = Data(base64Encoded: encoded), data.count <= 16 * 1024 * 1024 else { return .init(ok: false, data: nil, error: "Bloque inválido o mayor de 16 MB.") }
                guard UInt64(data.count) <= (configuration.quotaBytes > localUsedBytes ? configuration.quotaBytes - localUsedBytes : 0) else { return .init(ok: false, data: nil, error: "Cuota remota insuficiente.") }
                let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
                guard hash == request.key.lowercased() else { return .init(ok: false, data: nil, error: "Hash inválido.") }
                try data.write(to: url, options: [.atomic, .completeFileProtection]); return .init(ok: true, data: nil, error: nil)
            case "get": return .init(ok: true, data: try Data(contentsOf: url).base64EncodedString(), error: nil)
            case "delete": try? FileManager.default.removeItem(at: url); return .init(ok: true, data: nil, error: nil)
            default: return .init(ok: false, data: nil, error: "Operación desconocida.")
            }
        } catch { return .init(ok: false, data: nil, error: error.localizedDescription) }
    }

    private func request(_ peer: PeerStorageNode, operation: String, key: String, data: String?) async throws -> PeerResponse {
        let connection = NWConnection(host: NWEndpoint.Host(peer.host), port: NWEndpoint.Port(rawValue: peer.port)!, using: .tcp)
        connection.start(queue: queue)
        var encoded = try JSONEncoder().encode(PeerRequest(operation: operation, key: key, data: data)); encoded.append(0x0A)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connection.send(content: encoded, completion: .contentProcessed { error in error == nil ? continuation.resume() : continuation.resume(throwing: error!) })
        }
        let responseData = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Data, Error>) in
            receiveLine(connection, accumulated: Data()) { data in
                connection.cancel()
                if let data { continuation.resume(returning: data) } else { continuation.resume(throwing: PeerStorageError.noResponse) }
            }
        }
        return try JSONDecoder().decode(PeerResponse.self, from: responseData)
    }

    private var localUsedBytes: UInt64 {
        guard let path = configuration?.storageDirectory,
              let enumerator = FileManager.default.enumerator(at: URL(fileURLWithPath: path), includingPropertiesForKeys: [.fileSizeKey]) else { return 0 }
        return enumerator.compactMap { ($0 as? URL).flatMap { try? $0.resourceValues(forKeys: [.fileSizeKey]).fileSize } }.reduce(0) { $0 + UInt64($1) }
    }
}

private struct Announcement: Codable {
    let protocolName: String; let deviceId: String; let username: String; let displayName: String
    let platform: String; let port: Int; let quotaBytes: UInt64; let usedBytes: UInt64
    enum CodingKeys: String, CodingKey { case protocolName = "Protocol", deviceId = "DeviceId", username = "Username", displayName = "DisplayName", platform = "Platform", port = "Port", quotaBytes = "QuotaBytes", usedBytes = "UsedBytes" }
}
private struct PeerRequest: Codable { let operation: String; let key: String; let data: String?; enum CodingKeys: String, CodingKey { case operation = "Operation", key = "Key", data = "Data" } }
private struct PeerResponse: Codable { let ok: Bool; let data: String?; let error: String?; enum CodingKeys: String, CodingKey { case ok = "Ok", data = "Data", error = "Error" } }
private enum PeerStorageError: LocalizedError { case noResponse; case remote(String); var errorDescription: String? { switch self { case .noResponse: "El equipo remoto no respondió."; case .remote(let value): value } } }
