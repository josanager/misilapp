using System.Text.Json.Serialization;

namespace MISILNative.Core.Distribution;

public sealed class MisilReleaseManifest
{
    [JsonPropertyName("schemaVersion")]
    public int SchemaVersion { get; set; } = 1;

    [JsonPropertyName("product")]
    public string Product { get; set; } = "MISIL";

    [JsonPropertyName("version")]
    public string Version { get; set; } = string.Empty;

    [JsonPropertyName("channel")]
    public string Channel { get; set; } = "stable";

    [JsonPropertyName("publishedAt")]
    public DateTimeOffset PublishedAt { get; set; }

    [JsonPropertyName("architecture")]
    public string Architecture { get; set; } = "x64";

    [JsonPropertyName("minimumWindowsVersion")]
    public string MinimumWindowsVersion { get; set; } = "10.0.19041";

    [JsonPropertyName("assetName")]
    public string AssetName { get; set; } = string.Empty;

    [JsonPropertyName("url")]
    public Uri Url { get; set; } = new("https://github.com");

    [JsonPropertyName("sizeBytes")]
    public ulong SizeBytes { get; set; }

    [JsonPropertyName("sha256")]
    public string Sha256 { get; set; } = string.Empty;

    [JsonPropertyName("installerType")]
    public string InstallerType { get; set; } = "inno";

    [JsonPropertyName("silentArguments")]
    public string SilentArguments { get; set; } = "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS";

    [JsonPropertyName("restartRequired")]
    public bool RestartRequired { get; set; }

    [JsonPropertyName("compatibility")]
    public List<string> Compatibility { get; set; } = ["windows-x64"];
}

public sealed record MisilUpdateCandidate(
    GitHubRelease Release,
    MisilReleaseManifest Manifest,
    Uri InstallerUrl,
    string ReleaseNotes);

public enum MisilUpdateStatus
{
    Idle,
    Checking,
    Available,
    Downloading,
    ReadyToInstall,
    Cancelled,
    Failed
}

public sealed record MisilUpdateState(
    MisilUpdateStatus Status,
    string Detail,
    string? AvailableVersion = null,
    ulong? SizeBytes = null,
    double Progress = 0,
    string? InstallerPath = null);

public sealed record MisilUpdaterLaunchPlan(
    int WaitForProcessId,
    string InstallerPath,
    string ExpectedSha256,
    ulong ExpectedSizeBytes,
    string InstallDirectory,
    string RelaunchExecutable,
    string SilentArguments);
