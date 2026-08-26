import Foundation

@MainActor
final class AgerbotCapabilityViewModel: ObservableObject {
    @Published private(set) var health: AgerbotHealthResponse?
    @Published private(set) var capabilities: AgerbotCapabilitiesResponse?
    @Published private(set) var isReachable = false

    private let client: AgerbotRuntimeClient
    private var monitoringTask: Task<Void, Never>?

    init(client: AgerbotRuntimeClient) {
        self.client = client
    }

    func startMonitoring() {
        guard monitoringTask == nil else { return }
        monitoringTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                try? await Task.sleep(for: .seconds(4))
            }
        }
    }

    func refresh() async {
        do {
            async let healthResponse = client.health()
            async let capabilityResponse = client.capabilities()
            health = try await healthResponse
            capabilities = try await capabilityResponse
            isReachable = health?.model.loaded == true
        } catch {
            health = nil
            capabilities = nil
            isReachable = false
        }
    }
}
