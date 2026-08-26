using System.Text.Json;
using MISILNative.Core.Distribution;

namespace MISILNative.Core.Agerbot;

public sealed record AgerbotRemoteRuntimeCandidate(
    GitHubRelease Release,
    AgerbotRuntimeReleaseManifest Manifest,
    IReadOnlyDictionary<AgerbotRuntimeVariant, (AgerbotRuntimePackage Package, Uri Url)> Packages);

public sealed class AgerbotRuntimeReleaseService : IDisposable
{
    private readonly IGitHubApiTransport _transport;
    private readonly bool _ownsTransport;
    private readonly Uri _releasesEndpoint;

    public AgerbotRuntimeReleaseService(
        IGitHubApiTransport? transport = null,
        Uri? releasesEndpoint = null)
    {
        _ownsTransport = transport == null;
        _transport = transport ?? new GitHubApiTransport();
        _releasesEndpoint = releasesEndpoint ?? new Uri("https://api.github.com/repos/josanager/Agerbot/releases?per_page=30");
    }

    public async Task<AgerbotRemoteRuntimeCandidate> LatestCompatibleAsync(
        string? installedVersion,
        bool allowPrerelease,
        int windowsBuild,
        CancellationToken cancellationToken = default)
    {
        var (data, status) = await _transport.GetAsync(_releasesEndpoint, "application/vnd.github+json", cancellationToken);
        if (status != 200) throw new InvalidOperationException("No se pudieron consultar las releases del runtime Agerbot.");
        var releases = JsonSerializer.Deserialize<List<GitHubRelease>>(data, GitHubJson.Options) ?? [];
        var eligible = releases
            .Where(item => !item.Draft && (allowPrerelease || !item.Prerelease) && item.TagName.StartsWith("runtime-v", StringComparison.Ordinal))
            .Select(item => (Release: item, VersionText: item.TagName["runtime-v".Length..]))
            .Where(item => SemanticVersion.TryParse(item.VersionText, out _))
            .OrderByDescending(item => SemanticVersion.Parse(item.VersionText));
        foreach (var item in eligible)
        {
            if (installedVersion != null
                && SemanticVersion.TryParse(installedVersion, out var installed)
                && SemanticVersion.Parse(item.VersionText) <= installed) continue;
            var manifestAsset = item.Release.Assets.FirstOrDefault(asset => asset.Name == "agerbot-runtime-release.json");
            if (manifestAsset == null) continue;
            var (manifestData, manifestStatus) = await _transport.GetAsync(manifestAsset.BrowserDownloadUrl, "application/octet-stream", cancellationToken);
            if (manifestStatus != 200) continue;
            var manifest = JsonSerializer.Deserialize<AgerbotRuntimeReleaseManifest>(manifestData, GitHubJson.Options);
            if (manifest == null
                || manifest.SchemaVersion != 1
                || manifest.Channel != "stable"
                || manifest.Release.Tag != item.Release.TagName
                || manifest.Release.Version != item.VersionText
                || !SemanticVersion.TryParse(manifest.Release.Version, out _)) continue;
            var packages = new Dictionary<AgerbotRuntimeVariant, (AgerbotRuntimePackage, Uri)>();
            foreach (var package in manifest.Packages.Where(package =>
                         package.Platform == "windows-x64"
                         && package.MinimumWindowsBuild <= windowsBuild
                         && (package.Variant.Equals("cpu", StringComparison.OrdinalIgnoreCase)
                             || package.Variant.Equals("cuda", StringComparison.OrdinalIgnoreCase))
                         && package.SizeBytes > 0
                         && package.InstalledSizeBytes >= package.SizeBytes
                         && !string.IsNullOrWhiteSpace(package.EntryPoint)))
            {
                var asset = item.Release.Assets.FirstOrDefault(asset => asset.Name == package.AssetName && asset.Size == package.SizeBytes);
                if (asset == null || package.Sha256.Length != 64) continue;
                packages[package.RuntimeVariant] = (package, asset.BrowserDownloadUrl);
            }
            if (packages.ContainsKey(AgerbotRuntimeVariant.Cpu))
                return new(item.Release, manifest, packages);
        }
        throw new InvalidOperationException("Agerbot todavía no tiene un runtime estable compatible para Windows x64.");
    }

    public void Dispose()
    {
        if (_ownsTransport && _transport is IDisposable disposable) disposable.Dispose();
    }
}
