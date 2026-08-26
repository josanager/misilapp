using System.Text;
using System.Text.Json;
using MISILNative.Core.Distribution;

namespace MISILNative.Core.Agerbot;

public sealed class AgerbotModelReleaseService : IDisposable
{
    private readonly IGitHubApiTransport _transport;
    private readonly bool _ownsTransport;
    private readonly Uri _releasesEndpoint;
    private readonly string _platform;
    private readonly HashSet<string> _devices;

    public AgerbotModelReleaseService(
        IGitHubApiTransport? transport = null,
        Uri? releasesEndpoint = null,
        string platform = "windows-x64",
        IEnumerable<string>? devices = null)
    {
        _ownsTransport = transport == null;
        _transport = transport ?? new GitHubApiTransport();
        _releasesEndpoint = releasesEndpoint ?? new Uri("https://api.github.com/repos/josanager/Agerbot/releases?per_page=30");
        _platform = platform;
        _devices = new HashSet<string>(devices ?? ["cpu", "cuda"], StringComparer.OrdinalIgnoreCase);
    }

    public async Task<AgerbotRemoteModelCandidate> LatestCompatibleAsync(
        string runtimeVersion,
        string? installedVersion,
        bool allowPrerelease,
        CancellationToken cancellationToken = default)
    {
        var (data, status) = await _transport.GetAsync(_releasesEndpoint, "application/vnd.github+json", cancellationToken);
        if (status == 404) throw new InvalidOperationException("Agerbot todavía no tiene una release pública compatible.");
        if (status != 200) throw new InvalidOperationException("No se pudieron consultar las releases de modelos Agerbot.");
        var releases = JsonSerializer.Deserialize<List<GitHubRelease>>(data, GitHubJson.Options) ?? [];
        var eligible = releases
            .Where(item => !item.Draft && (allowPrerelease || !item.Prerelease) && item.TagName.StartsWith("model-v", StringComparison.Ordinal))
            .Select(item => (Release: item, Version: item.TagName["model-v".Length..]))
            .Where(item => SemanticVersion.TryParse(item.Version, out _))
            .OrderByDescending(item => SemanticVersion.Parse(item.Version));
        SemanticVersion runtime = SemanticVersion.Parse(runtimeVersion);
        SemanticVersion? installed = SemanticVersion.TryParse(installedVersion, out var parsed) ? parsed : null;
        foreach (var item in eligible)
        {
            if (installed != null && SemanticVersion.Parse(item.Version) <= installed.Value) continue;
            var manifestAsset = item.Release.Assets.FirstOrDefault(asset => asset.Name == "agerbot-release.json");
            if (manifestAsset == null) continue;
            var (manifestData, manifestStatus) = await _transport.GetAsync(manifestAsset.BrowserDownloadUrl, "application/octet-stream", cancellationToken);
            if (manifestStatus != 200) continue;
            var manifest = JsonSerializer.Deserialize<AgerbotModelReleaseManifest>(manifestData, GitHubJson.Options);
            if (!ValidateManifest(manifest, item.Release, item.Version, runtime)) continue;
            var checkpoint = item.Release.Assets.FirstOrDefault(asset =>
                asset.Name == manifest!.Artifact.AssetName && asset.Size == manifest.Artifact.SizeBytes);
            var evaluation = item.Release.Assets.FirstOrDefault(asset => asset.Name == manifest!.Evaluation.AssetName);
            var checksums = item.Release.Assets.FirstOrDefault(asset => asset.Name == "checksums-sha256.txt");
            if (checkpoint == null || evaluation == null || checksums == null) continue;
            var (checksumData, checksumStatus) = await _transport.GetAsync(checksums.BrowserDownloadUrl, "application/octet-stream", cancellationToken);
            if (checksumStatus != 200 || !ChecksumFileContains(checksumData, manifest!.Artifact.AssetName, manifest.Artifact.Sha256)) continue;
            return new(manifest!, checkpoint.BrowserDownloadUrl, evaluation.BrowserDownloadUrl, checksums.BrowserDownloadUrl, evaluation.Size);
        }
        throw new NoUpdateAvailableException("Agerbot está actualizado o todavía no hay un modelo estable compatible publicado.");
    }

    private bool ValidateManifest(
        AgerbotModelReleaseManifest? manifest,
        GitHubRelease release,
        string version,
        SemanticVersion runtime)
    {
        if (manifest == null
            || manifest.SchemaVersion != 2
            || manifest.Channel != "stable"
            || manifest.Release.Tag != release.TagName
            || manifest.Release.Version != version
            || manifest.Model.Name != "Agerbot"
            || manifest.Model.Architecture != "agerbot-transformer"
            || manifest.Model.Tokenizer is not ("byte-v1" or "char-v1")
            || !manifest.Evaluation.Status.Equals("passed", StringComparison.OrdinalIgnoreCase)
            || manifest.Artifact.SizeBytes == 0
            || manifest.Artifact.Sha256.Length != 64
            || !SemanticVersion.TryParse(manifest.Runtime.MinimumVersion, out var minimum)
            || minimum > runtime
            || !manifest.Compatibility.Platforms.Contains(_platform, StringComparer.OrdinalIgnoreCase)
            || !manifest.Compatibility.Devices.Any(_devices.Contains)) return false;
        return manifest.Runtime.MaximumVersion == null
            || SemanticVersion.TryParse(manifest.Runtime.MaximumVersion, out var maximum) && runtime <= maximum;
    }

    private static bool ChecksumFileContains(byte[] data, string assetName, string expectedHash)
    {
        foreach (string line in Encoding.UTF8.GetString(data).Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            string[] parts = line.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 2
                && parts[0].Equals(expectedHash, StringComparison.OrdinalIgnoreCase)
                && parts[^1].TrimStart('*').Equals(assetName, StringComparison.Ordinal)) return true;
        }
        return false;
    }

    public void Dispose()
    {
        if (_ownsTransport && _transport is IDisposable disposable) disposable.Dispose();
    }
}
