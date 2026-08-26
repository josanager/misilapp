import Foundation

let agerbotReservedConversationID = "agerbot-local"

struct AgerbotModelIdentity: Codable, Equatable, Sendable {
    let name: String
    let version: String
    let trainingName: String?
    let loaded: Bool?
    let parameters: Int?
    let parameterCount: Int?
    let device: String
    let tokenizer: String?
    let contextLength: Int?
}

struct AgerbotHealthResponse: Codable, Equatable, Sendable {
    let status: String
    let runtimeVersion: String?
    let model: AgerbotModelIdentity
}

struct AgerbotCPUCapability: Codable, Equatable, Sendable {
    let logicalCores: Int
}

struct AgerbotMemoryCapability: Codable, Equatable, Sendable {
    let totalBytes: UInt64
}

struct AgerbotAccelerator: Codable, Equatable, Sendable, Identifiable {
    var id: String { "\(kind)-\(name)" }
    let kind: String
    let name: String
}

struct AgerbotWorkloadCapability: Codable, Equatable, Sendable {
    let supported: Bool
    let recommendedDevice: String
}

struct AgerbotCapabilitiesResponse: Codable, Equatable, Sendable {
    let platform: String
    let architecture: String
    let cpu: AgerbotCPUCapability
    let memory: AgerbotMemoryCapability
    let accelerators: [AgerbotAccelerator]
    let inference: AgerbotWorkloadCapability
    let training: AgerbotWorkloadCapability
}

struct AgerbotHistoryItem: Codable, Equatable, Sendable {
    let role: String
    let content: String
}

struct AgerbotGenerationSettings: Codable, Equatable, Sendable {
    var maxNewTokens = 120
    var temperature = 0.8
    var topK: Int? = 40
}

struct AgerbotChatRequest: Codable, Equatable, Sendable {
    let conversationId: String
    let message: String
    let history: [AgerbotHistoryItem]
    let generation: AgerbotGenerationSettings
}

struct AgerbotChatMessagePayload: Codable, Equatable, Sendable {
    let role: String
    let content: String
}

struct AgerbotUsage: Codable, Equatable, Sendable {
    let promptTokens: Int
    let generatedTokens: Int
    let durationMs: Int
}

struct AgerbotChatResponse: Codable, Equatable, Sendable {
    let conversationId: String
    let message: AgerbotChatMessagePayload
    let usage: AgerbotUsage
    let model: AgerbotModelIdentity
}

struct AgerbotCancelResponse: Codable, Equatable, Sendable {
    let conversationId: String
    let cancelRequested: Bool
}

struct AgerbotAPIErrorDetail: Codable, Equatable, Sendable {
    let code: String
    let message: String
    let retryable: Bool
}

struct AgerbotAPIErrorEnvelope: Codable, Equatable, Sendable {
    let error: AgerbotAPIErrorDetail
}

enum AgerbotClientError: LocalizedError, Equatable, Sendable {
    case unavailable
    case invalidResponse
    case timedOut
    case api(code: String, message: String, retryable: Bool)

    var errorDescription: String? {
        switch self {
        case .unavailable:
            "El runtime local de Agerbot no está disponible."
        case .invalidResponse:
            "Agerbot devolvió una respuesta que MISIL no reconoce."
        case .timedOut:
            "Agerbot tardó demasiado en responder."
        case let .api(_, message, _):
            message
        }
    }
}

enum AgerbotRuntimeState: Equatable {
    case notInstalled
    case stopped
    case starting(progress: Double, detail: String)
    case loading(progress: Double, detail: String)
    case ready(AgerbotHealthResponse)
    case stopping
    case portConflict
    case unavailable(String)
    case failed(String)

    var isReady: Bool {
        if case .ready = self { return true }
        return false
    }
}

enum AgerbotConversationState: Equatable {
    case idle
    case starting
    case thinking
    case cancelling
    case unavailable(String)
    case failed(String)
}

enum AgerbotMessageRole: String, Codable, Sendable {
    case user
    case assistant
}

struct AgerbotLocalMessage: Codable, Identifiable, Equatable, Sendable {
    let id: UUID
    let role: AgerbotMessageRole
    let content: String
    let createdAt: Date
}

struct AgerbotSettings: Codable, Equatable, Sendable {
    var projectPath: String
    var checkpointPath: String
    var startWithMISIL: Bool
    var generation: AgerbotGenerationSettings
    var modelChannel: String
    var automaticModelUpdates: Bool
    var allowPrereleaseModels: Bool
    var pinnedModelVersion: String?
    var lastUpdateCheckAt: Date?
    var activeModelVersion: String?
    var previousModelVersion: String?

    init(
        projectPath: String = "",
        checkpointPath: String = "",
        startWithMISIL: Bool = false,
        generation: AgerbotGenerationSettings = AgerbotGenerationSettings(),
        modelChannel: String = "stable",
        automaticModelUpdates: Bool = true,
        allowPrereleaseModels: Bool = false,
        pinnedModelVersion: String? = nil,
        lastUpdateCheckAt: Date? = nil,
        activeModelVersion: String? = nil,
        previousModelVersion: String? = nil
    ) {
        self.projectPath = projectPath
        self.checkpointPath = checkpointPath
        self.startWithMISIL = startWithMISIL
        self.generation = generation
        self.modelChannel = modelChannel
        self.automaticModelUpdates = automaticModelUpdates
        self.allowPrereleaseModels = allowPrereleaseModels
        self.pinnedModelVersion = pinnedModelVersion
        self.lastUpdateCheckAt = lastUpdateCheckAt
        self.activeModelVersion = activeModelVersion
        self.previousModelVersion = previousModelVersion
    }

    private enum CodingKeys: String, CodingKey {
        case projectPath, checkpointPath, startWithMISIL, generation
        case modelChannel, automaticModelUpdates, allowPrereleaseModels
        case pinnedModelVersion, lastUpdateCheckAt, activeModelVersion, previousModelVersion
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        projectPath = try container.decodeIfPresent(String.self, forKey: .projectPath) ?? ""
        checkpointPath = try container.decodeIfPresent(String.self, forKey: .checkpointPath) ?? ""
        startWithMISIL = try container.decodeIfPresent(Bool.self, forKey: .startWithMISIL) ?? false
        generation = try container.decodeIfPresent(AgerbotGenerationSettings.self, forKey: .generation) ?? AgerbotGenerationSettings()
        modelChannel = try container.decodeIfPresent(String.self, forKey: .modelChannel) ?? "stable"
        automaticModelUpdates = try container.decodeIfPresent(Bool.self, forKey: .automaticModelUpdates) ?? true
        allowPrereleaseModels = try container.decodeIfPresent(Bool.self, forKey: .allowPrereleaseModels) ?? false
        pinnedModelVersion = try container.decodeIfPresent(String.self, forKey: .pinnedModelVersion)
        lastUpdateCheckAt = try container.decodeIfPresent(Date.self, forKey: .lastUpdateCheckAt)
        activeModelVersion = try container.decodeIfPresent(String.self, forKey: .activeModelVersion)
        previousModelVersion = try container.decodeIfPresent(String.self, forKey: .previousModelVersion)
    }
}

enum AgerbotInstallationStatus: Equatable {
    case notInstalled
    case invalid(String)
    case developmentReady(modelVersion: String)
}

struct AgerbotCurrentModelRecord: Codable, Equatable, Sendable {
    let activeVersion: String
    let previousVersion: String?
    let activatedAt: Date
    let checkpointPath: String
    let manifestPath: String
}

struct AgerbotPersistedUpdateState: Codable, Equatable, Sendable {
    var failedVersions: [String: String]
    var updatedAt: Date

    static let empty = AgerbotPersistedUpdateState(failedVersions: [:], updatedAt: Date())
}

enum AgerbotModelUpdatePhase: Equatable {
    case idle(String)
    case checking
    case available(version: String, sizeBytes: UInt64)
    case downloading(version: String, progress: Double)
    case verifying(String)
    case waitingForConversation
    case activating(String)
    case installed(String)
    case rollingBack(String)
    case cancelled
    case failed(String)
}
