import Foundation

actor AgerbotRuntimeClient {
    private let baseURL: URL
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(baseURL: URL = URL(string: "http://127.0.0.1:4318")!) {
        self.baseURL = baseURL
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 180
        configuration.waitsForConnectivity = false
        configuration.urlCache = nil
        session = URLSession(configuration: configuration)
    }

    func health() async throws -> AgerbotHealthResponse {
        try await get(path: "/v1/health", as: AgerbotHealthResponse.self, timeout: 3)
    }

    func capabilities() async throws -> AgerbotCapabilitiesResponse {
        try await get(path: "/v1/capabilities", as: AgerbotCapabilitiesResponse.self, timeout: 5)
    }

    func chat(_ requestBody: AgerbotChatRequest) async throws -> AgerbotChatResponse {
        try await post(path: "/v1/chat", body: requestBody, as: AgerbotChatResponse.self, timeout: 180)
    }

    func cancel(conversationId: String = agerbotReservedConversationID) async throws -> AgerbotCancelResponse {
        struct CancelBody: Codable { let conversationId: String }
        return try await post(
            path: "/v1/chat/cancel",
            body: CancelBody(conversationId: conversationId),
            as: AgerbotCancelResponse.self,
            timeout: 3
        )
    }

    func hasHTTPServiceOnRuntimePort() async -> Bool {
        var request = URLRequest(url: baseURL.appendingPathComponent("v1/health"))
        request.timeoutInterval = 1
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        do {
            _ = try await session.data(for: request)
            return true
        } catch {
            return false
        }
    }

    private func get<Response: Decodable>(
        path: String,
        as type: Response.Type,
        timeout: TimeInterval
    ) async throws -> Response {
        var request = URLRequest(url: endpoint(path))
        request.httpMethod = "GET"
        request.timeoutInterval = timeout
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        return try await perform(request, as: type)
    }

    private func post<Body: Encodable, Response: Decodable>(
        path: String,
        body: Body,
        as type: Response.Type,
        timeout: TimeInterval
    ) async throws -> Response {
        var request = URLRequest(url: endpoint(path))
        request.httpMethod = "POST"
        request.httpBody = try encoder.encode(body)
        request.timeoutInterval = timeout
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await perform(request, as: type)
    }

    private func perform<Response: Decodable>(
        _ request: URLRequest,
        as type: Response.Type
    ) async throws -> Response {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw AgerbotClientError.invalidResponse
            }
            guard (200 ..< 300).contains(http.statusCode) else {
                if let envelope = try? decoder.decode(AgerbotAPIErrorEnvelope.self, from: data) {
                    throw AgerbotClientError.api(
                        code: envelope.error.code,
                        message: envelope.error.message,
                        retryable: envelope.error.retryable
                    )
                }
                throw AgerbotClientError.invalidResponse
            }
            guard let decoded = try? decoder.decode(type, from: data) else {
                throw AgerbotClientError.invalidResponse
            }
            return decoded
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as AgerbotClientError {
            throw error
        } catch let error as URLError where error.code == .timedOut {
            throw AgerbotClientError.timedOut
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch {
            throw AgerbotClientError.unavailable
        }
    }

    private func endpoint(_ path: String) -> URL {
        baseURL.appendingPathComponent(String(path.drop(while: { $0 == "/" })))
    }
}
