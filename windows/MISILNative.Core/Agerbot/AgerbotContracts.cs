using System.Text.Json.Serialization;

namespace MISILNative.Core.Agerbot;

public static class AgerbotConstants
{
    public const string ReservedConversationId = "agerbot-local";
    public static readonly Uri DefaultBaseUri = new("http://127.0.0.1:4318");
}

public sealed class AgerbotModelIdentity
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "Agerbot";

    [JsonPropertyName("version")]
    public string Version { get; set; } = string.Empty;

    [JsonPropertyName("trainingName")]
    public string? TrainingName { get; set; }

    [JsonPropertyName("loaded")]
    public bool? Loaded { get; set; }

    [JsonPropertyName("parameters")]
    public long? Parameters { get; set; }

    [JsonPropertyName("parameterCount")]
    public long? ParameterCount { get; set; }

    [JsonPropertyName("device")]
    public string Device { get; set; } = "cpu";

    [JsonPropertyName("tokenizer")]
    public string? Tokenizer { get; set; }

    [JsonPropertyName("contextLength")]
    public int? ContextLength { get; set; }
}

public sealed class AgerbotHealthResponse
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("runtimeVersion")]
    public string? RuntimeVersion { get; set; }

    [JsonPropertyName("model")]
    public AgerbotModelIdentity Model { get; set; } = new();
}

public sealed class AgerbotCpuCapability
{
    [JsonPropertyName("logicalCores")]
    public int LogicalCores { get; set; }
}

public sealed class AgerbotMemoryCapability
{
    [JsonPropertyName("totalBytes")]
    public ulong TotalBytes { get; set; }
}

public sealed class AgerbotAccelerator
{
    [JsonPropertyName("kind")]
    public string Kind { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public sealed class AgerbotWorkloadCapability
{
    [JsonPropertyName("supported")]
    public bool Supported { get; set; }

    [JsonPropertyName("recommendedDevice")]
    public string RecommendedDevice { get; set; } = "cpu";
}

public sealed class AgerbotCapabilitiesResponse
{
    [JsonPropertyName("platform")]
    public string Platform { get; set; } = string.Empty;

    [JsonPropertyName("architecture")]
    public string Architecture { get; set; } = string.Empty;

    [JsonPropertyName("cpu")]
    public AgerbotCpuCapability Cpu { get; set; } = new();

    [JsonPropertyName("memory")]
    public AgerbotMemoryCapability Memory { get; set; } = new();

    [JsonPropertyName("accelerators")]
    public List<AgerbotAccelerator> Accelerators { get; set; } = [];

    [JsonPropertyName("inference")]
    public AgerbotWorkloadCapability Inference { get; set; } = new();

    [JsonPropertyName("training")]
    public AgerbotWorkloadCapability Training { get; set; } = new();
}

public sealed class AgerbotHistoryItem
{
    [JsonPropertyName("role")]
    public string Role { get; set; } = string.Empty;

    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;
}

public sealed class AgerbotGenerationSettings
{
    [JsonPropertyName("maxNewTokens")]
    public int MaxNewTokens { get; set; } = 120;

    [JsonPropertyName("temperature")]
    public double Temperature { get; set; } = 0.8;

    [JsonPropertyName("topK")]
    public int? TopK { get; set; } = 40;
}

public sealed class AgerbotChatRequest
{
    [JsonPropertyName("conversationId")]
    public string ConversationId { get; set; } = AgerbotConstants.ReservedConversationId;

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("history")]
    public List<AgerbotHistoryItem> History { get; set; } = [];

    [JsonPropertyName("generation")]
    public AgerbotGenerationSettings Generation { get; set; } = new();
}

public sealed class AgerbotChatMessagePayload
{
    [JsonPropertyName("role")]
    public string Role { get; set; } = string.Empty;

    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;
}

public sealed class AgerbotUsage
{
    [JsonPropertyName("promptTokens")]
    public int PromptTokens { get; set; }

    [JsonPropertyName("generatedTokens")]
    public int GeneratedTokens { get; set; }

    [JsonPropertyName("durationMs")]
    public int DurationMs { get; set; }
}

public sealed class AgerbotChatResponse
{
    [JsonPropertyName("conversationId")]
    public string ConversationId { get; set; } = string.Empty;

    [JsonPropertyName("message")]
    public AgerbotChatMessagePayload Message { get; set; } = new();

    [JsonPropertyName("usage")]
    public AgerbotUsage Usage { get; set; } = new();

    [JsonPropertyName("model")]
    public AgerbotModelIdentity Model { get; set; } = new();
}

public sealed class AgerbotCancelResponse
{
    [JsonPropertyName("conversationId")]
    public string ConversationId { get; set; } = string.Empty;

    [JsonPropertyName("cancelRequested")]
    public bool CancelRequested { get; set; }
}

public sealed class AgerbotApiErrorDetail
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("retryable")]
    public bool Retryable { get; set; }
}

public sealed class AgerbotApiErrorEnvelope
{
    [JsonPropertyName("error")]
    public AgerbotApiErrorDetail Error { get; set; } = new();
}

public sealed class AgerbotClientException : Exception
{
    public string Code { get; }
    public bool Retryable { get; }

    public AgerbotClientException(string code, string message, bool retryable = false, Exception? inner = null)
        : base(message, inner)
    {
        Code = code;
        Retryable = retryable;
    }
}

public enum AgerbotRuntimeStatus
{
    NotInstalled,
    Stopped,
    Starting,
    Loading,
    Ready,
    Stopping,
    PortConflict,
    Unavailable,
    Failed
}

public sealed record AgerbotRuntimeState(
    AgerbotRuntimeStatus Status,
    string Detail,
    double Progress = 0,
    AgerbotHealthResponse? Health = null)
{
    public bool IsReady => Status == AgerbotRuntimeStatus.Ready && Health?.Model.Loaded == true;
    public static AgerbotRuntimeState Stopped => new(AgerbotRuntimeStatus.Stopped, "Detenido");
}

public enum AgerbotConversationStatus
{
    Idle,
    Starting,
    Thinking,
    Cancelling,
    Unavailable,
    Failed
}

public enum AgerbotMessageRole
{
    User,
    Assistant
}

public sealed class AgerbotLocalMessage
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [JsonPropertyName("role")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public AgerbotMessageRole Role { get; set; }

    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;

    [JsonPropertyName("createdAt")]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [JsonIgnore]
    public bool IsOutgoing => Role == AgerbotMessageRole.User;

    [JsonIgnore]
    public string SenderName => IsOutgoing ? "Tú" : "Agerbot";

    [JsonIgnore]
    public string FormattedTime => CreatedAt.ToLocalTime().ToString("HH:mm");
}

public sealed class AgerbotSettings
{
    public string RuntimeExecutablePath { get; set; } = string.Empty;
    public string CpuRuntimeExecutablePath { get; set; } = string.Empty;
    public string CudaRuntimeExecutablePath { get; set; } = string.Empty;
    public string? RuntimeVersion { get; set; }
    public string? PreviousRuntimeVersion { get; set; }
    public string PreviousCpuRuntimeExecutablePath { get; set; } = string.Empty;
    public string PreviousCudaRuntimeExecutablePath { get; set; } = string.Empty;
    public string CheckpointPath { get; set; } = string.Empty;
    public bool StartWithMisil { get; set; }
    public string RequestedDevice { get; set; } = "auto";
    public AgerbotGenerationSettings Generation { get; set; } = new();
    public string ModelChannel { get; set; } = "stable";
    public bool AutomaticModelUpdates { get; set; } = true;
    public bool AllowPrereleaseModels { get; set; }
    public string? PinnedModelVersion { get; set; }
    public DateTimeOffset? LastUpdateCheckAt { get; set; }
    public string? ActiveModelVersion { get; set; }
    public string? PreviousModelVersion { get; set; }
    public ulong StorageQuotaBytes { get; set; } = 2UL * 1024 * 1024 * 1024;
}

public sealed class ManagedRuntimeMetadata
{
    public int ProcessId { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public string ExecutablePath { get; set; } = string.Empty;
    public string CheckpointPath { get; set; } = string.Empty;
}
