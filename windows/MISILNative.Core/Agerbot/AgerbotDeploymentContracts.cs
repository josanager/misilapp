using System.Text.Json.Serialization;

namespace MISILNative.Core.Agerbot;

public sealed class AgerbotHardwareCapabilities
{
    public string WindowsVersion { get; set; } = string.Empty;
    public string Architecture { get; set; } = "x64";
    public string CpuName { get; set; } = string.Empty;
    public int LogicalCores { get; set; }
    public ulong TotalMemoryBytes { get; set; }
    public string? GpuName { get; set; }
    public ulong? VramBytes { get; set; }
    public string? NvidiaDriverVersion { get; set; }
    public bool NvidiaSmiAvailable { get; set; }
    public bool DirectMlSystemLibraryAvailable { get; set; }
    public ulong DiskAvailableBytes { get; set; }
}

public enum AgerbotRuntimeVariant
{
    Cpu,
    Cuda
}

public sealed record AgerbotHardwareRecommendation(
    AgerbotRuntimeVariant Variant,
    string Device,
    string Summary,
    bool CpuFallbackRequired);

public static class AgerbotHardwareRecommender
{
    public const ulong MinimumCudaVramBytes = 3UL * 1024 * 1024 * 1024;

    public static AgerbotHardwareRecommendation Recommend(
        AgerbotHardwareCapabilities hardware,
        bool compatibleCudaRuntimeAvailable)
    {
        if (compatibleCudaRuntimeAvailable
            && hardware.NvidiaSmiAvailable
            && hardware.VramBytes >= MinimumCudaVramBytes)
        {
            return new(
                AgerbotRuntimeVariant.Cuda,
                "auto",
                $"CUDA recomendado en {hardware.GpuName}; MISIL volverá a CPU si el arranque falla.",
                CpuFallbackRequired: true);
        }
        string reason = hardware.NvidiaSmiAvailable
            ? "La VRAM o el paquete CUDA no cumplen los requisitos."
            : "No se detectó un runtime NVIDIA compatible.";
        return new(AgerbotRuntimeVariant.Cpu, "cpu", $"CPU universal. {reason}", CpuFallbackRequired: false);
    }
}

public sealed class AgerbotRuntimeReleaseManifest
{
    [JsonPropertyName("schemaVersion")]
    public int SchemaVersion { get; set; }

    [JsonPropertyName("channel")]
    public string Channel { get; set; } = "stable";

    [JsonPropertyName("release")]
    public AgerbotRuntimeReleaseIdentity Release { get; set; } = new();

    [JsonPropertyName("packages")]
    public List<AgerbotRuntimePackage> Packages { get; set; } = [];
}

public sealed class AgerbotRuntimeReleaseIdentity
{
    [JsonPropertyName("version")]
    public string Version { get; set; } = string.Empty;

    [JsonPropertyName("tag")]
    public string Tag { get; set; } = string.Empty;

    [JsonPropertyName("publishedAt")]
    public DateTimeOffset PublishedAt { get; set; }
}

public sealed class AgerbotRuntimePackage
{
    [JsonPropertyName("variant")]
    public string Variant { get; set; } = "cpu";

    [JsonPropertyName("platform")]
    public string Platform { get; set; } = "windows-x64";

    [JsonPropertyName("assetName")]
    public string AssetName { get; set; } = string.Empty;

    [JsonPropertyName("entryPoint")]
    public string EntryPoint { get; set; } = "agerbot-runtime.exe";

    [JsonPropertyName("sizeBytes")]
    public ulong SizeBytes { get; set; }

    [JsonPropertyName("installedSizeBytes")]
    public ulong InstalledSizeBytes { get; set; }

    [JsonPropertyName("sha256")]
    public string Sha256 { get; set; } = string.Empty;

    [JsonPropertyName("minimumWindowsBuild")]
    public int MinimumWindowsBuild { get; set; } = 19041;

    [JsonIgnore]
    public AgerbotRuntimeVariant RuntimeVariant => Variant.Equals("cuda", StringComparison.OrdinalIgnoreCase)
        ? AgerbotRuntimeVariant.Cuda
        : AgerbotRuntimeVariant.Cpu;
}

public sealed class AgerbotStorageSnapshot
{
    public ulong QuotaBytes { get; init; }
    public ulong UsedBytes { get; init; }
    public ulong DiskAvailableBytes { get; init; }
    public ulong ReservedForOperationBytes { get; init; }
    public ulong AvailableWithinQuota => QuotaBytes > UsedBytes ? QuotaBytes - UsedBytes : 0;
}

public sealed record AgerbotStorageRequirement(
    ulong DownloadBytes,
    ulong InstalledBytes,
    ulong CandidateModelBytes,
    ulong TemporaryOverheadBytes)
{
    public ulong TotalAdditionalBytes => checked(DownloadBytes + InstalledBytes + CandidateModelBytes + TemporaryOverheadBytes);
}

public sealed record AgerbotStorageDecision(bool Allowed, ulong RequiredBytes, string Message);
