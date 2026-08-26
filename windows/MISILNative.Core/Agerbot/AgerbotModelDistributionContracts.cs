using System.Text.Json.Serialization;

namespace MISILNative.Core.Agerbot;

public sealed class AgerbotModelManifest
{
    [JsonPropertyName("schemaVersion")]
    public int SchemaVersion { get; set; }

    [JsonPropertyName("channel")]
    public string Channel { get; set; } = "stable";

    [JsonPropertyName("model")]
    public AgerbotModelManifestIdentity Model { get; set; } = new();

    [JsonPropertyName("runtime")]
    public AgerbotModelRuntimeCompatibility Runtime { get; set; } = new();

    [JsonPropertyName("checkpoint")]
    public AgerbotModelCheckpoint Checkpoint { get; set; } = new();

    [JsonPropertyName("compatibility")]
    public AgerbotModelCompatibility Compatibility { get; set; } = new();

    [JsonPropertyName("publishedAt")]
    public string? PublishedAt { get; set; }
}

public sealed class AgerbotModelManifestIdentity
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "Agerbot";

    [JsonPropertyName("version")]
    public string Version { get; set; } = string.Empty;

    [JsonPropertyName("trainingName")]
    public string TrainingName { get; set; } = string.Empty;

    [JsonPropertyName("architecture")]
    public string Architecture { get; set; } = "agerbot-transformer";

    [JsonPropertyName("tokenizer")]
    public string Tokenizer { get; set; } = string.Empty;

    [JsonPropertyName("parameters")]
    public long Parameters { get; set; }

    [JsonPropertyName("contextLength")]
    public int ContextLength { get; set; }
}

public sealed class AgerbotModelRuntimeCompatibility
{
    [JsonPropertyName("minimumVersion")]
    public string MinimumVersion { get; set; } = string.Empty;

    [JsonPropertyName("maximumVersion")]
    public string? MaximumVersion { get; set; }
}

public sealed class AgerbotModelCheckpoint
{
    [JsonPropertyName("filename")]
    public string Filename { get; set; } = "model.pt";

    [JsonPropertyName("sizeBytes")]
    public ulong SizeBytes { get; set; }

    [JsonPropertyName("sha256")]
    public string Sha256 { get; set; } = string.Empty;
}

public sealed class AgerbotModelCompatibility
{
    [JsonPropertyName("devices")]
    public List<string> Devices { get; set; } = [];

    [JsonPropertyName("platforms")]
    public List<string> Platforms { get; set; } = [];
}

public enum AgerbotModelSource { Managed, Development }

public sealed record AgerbotModelCandidate(
    AgerbotModelManifest Manifest,
    string ManifestPath,
    string CheckpointPath,
    AgerbotModelSource Source);

public sealed class AgerbotModelReleaseManifest
{
    [JsonPropertyName("schemaVersion")]
    public int SchemaVersion { get; set; }

    [JsonPropertyName("channel")]
    public string Channel { get; set; } = "stable";

    [JsonPropertyName("release")]
    public AgerbotModelReleaseIdentity Release { get; set; } = new();

    [JsonPropertyName("model")]
    public AgerbotReleaseModelIdentity Model { get; set; } = new();

    [JsonPropertyName("runtime")]
    public AgerbotModelRuntimeCompatibility Runtime { get; set; } = new();

    [JsonPropertyName("artifact")]
    public AgerbotModelArtifact Artifact { get; set; } = new();

    [JsonPropertyName("evaluation")]
    public AgerbotEvaluationArtifact Evaluation { get; set; } = new();

    [JsonPropertyName("compatibility")]
    public AgerbotModelCompatibility Compatibility { get; set; } = new();
}

public sealed class AgerbotModelReleaseIdentity
{
    [JsonPropertyName("version")]
    public string Version { get; set; } = string.Empty;

    [JsonPropertyName("tag")]
    public string Tag { get; set; } = string.Empty;

    [JsonPropertyName("publishedAt")]
    public string PublishedAt { get; set; } = string.Empty;
}

public sealed class AgerbotReleaseModelIdentity
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "Agerbot";

    [JsonPropertyName("trainingName")]
    public string TrainingName { get; set; } = string.Empty;

    [JsonPropertyName("architecture")]
    public string Architecture { get; set; } = "agerbot-transformer";

    [JsonPropertyName("tokenizer")]
    public string Tokenizer { get; set; } = string.Empty;

    [JsonPropertyName("parameters")]
    public long Parameters { get; set; }

    [JsonPropertyName("contextLength")]
    public int ContextLength { get; set; }
}

public sealed class AgerbotModelArtifact
{
    [JsonPropertyName("assetName")]
    public string AssetName { get; set; } = string.Empty;

    [JsonPropertyName("sizeBytes")]
    public ulong SizeBytes { get; set; }

    [JsonPropertyName("sha256")]
    public string Sha256 { get; set; } = string.Empty;
}

public sealed class AgerbotEvaluationArtifact
{
    [JsonPropertyName("assetName")]
    public string AssetName { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;
}

public sealed record AgerbotRemoteModelCandidate(
    AgerbotModelReleaseManifest Manifest,
    Uri CheckpointUrl,
    Uri EvaluationUrl,
    Uri ChecksumsUrl,
    ulong EvaluationSizeBytes);

public sealed class AgerbotCurrentModelRecord
{
    public string ActiveVersion { get; set; } = string.Empty;
    public string? PreviousVersion { get; set; }
    public DateTimeOffset ActivatedAt { get; set; }
    public string CheckpointPath { get; set; } = string.Empty;
    public string ManifestPath { get; set; } = string.Empty;
}

public sealed class AgerbotPersistedUpdateState
{
    public Dictionary<string, string> FailedVersions { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum AgerbotModelUpdateStatus
{
    Idle,
    Checking,
    Available,
    Downloading,
    Verifying,
    WaitingForConversation,
    Activating,
    Installed,
    RollingBack,
    Cancelled,
    Failed
}

public sealed record AgerbotModelUpdateState(
    AgerbotModelUpdateStatus Status,
    string Detail,
    string? Version = null,
    ulong? SizeBytes = null,
    double Progress = 0);
