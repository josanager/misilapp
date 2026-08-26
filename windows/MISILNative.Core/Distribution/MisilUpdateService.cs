using System.Text.Json;

namespace MISILNative.Core.Distribution;

public sealed class MisilUpdateService : IDisposable
{
    private readonly IGitHubApiTransport _transport;
    private readonly bool _ownsTransport;
    private readonly Uri _releasesEndpoint;
    private readonly VerifiedDownloadService _downloads;
    private readonly bool _ownsDownloads;

    public MisilUpdateService(
        IGitHubApiTransport? transport = null,
        VerifiedDownloadService? downloads = null,
        Uri? releasesEndpoint = null)
    {
        _ownsTransport = transport == null;
        _transport = transport ?? new GitHubApiTransport();
        _ownsDownloads = downloads == null;
        _downloads = downloads ?? new VerifiedDownloadService();
        _releasesEndpoint = releasesEndpoint ?? new Uri("https://api.github.com/repos/josanager/misilapp/releases?per_page=30");
    }

    public async Task<MisilUpdateCandidate> LatestCompatibleAsync(
        string installedVersion,
        bool allowPrerelease,
        Version windowsVersion,
        CancellationToken cancellationToken = default)
    {
        SemanticVersion installed = SemanticVersion.Parse(installedVersion);
        var (data, status) = await _transport.GetAsync(_releasesEndpoint, "application/vnd.github+json", cancellationToken);
        if (status != 200) throw new InvalidOperationException("No se pudieron consultar las releases de MISIL.");
        var releases = JsonSerializer.Deserialize<List<GitHubRelease>>(data, GitHubJson.Options) ?? [];
        foreach (var release in releases
                     .Where(item => !item.Draft && (allowPrerelease || !item.Prerelease))
                     .Select(item => (Release: item, Version: item.TagName.TrimStart('v')))
                     .Where(item => SemanticVersion.TryParse(item.Version, out var version) && version > installed)
                     .OrderByDescending(item => SemanticVersion.Parse(item.Version)))
        {
            var manifestAsset = release.Release.Assets.FirstOrDefault(asset => asset.Name == "misil-release.json");
            if (manifestAsset == null) continue;
            var (manifestData, manifestStatus) = await _transport.GetAsync(manifestAsset.BrowserDownloadUrl, "application/octet-stream", cancellationToken);
            if (manifestStatus != 200) continue;
            var manifest = JsonSerializer.Deserialize<MisilReleaseManifest>(manifestData, GitHubJson.Options);
            if (!ValidateManifest(manifest, release.Release, release.Version, windowsVersion)) continue;
            var installer = release.Release.Assets.FirstOrDefault(asset =>
                asset.Name == manifest!.AssetName && asset.Size == manifest.SizeBytes);
            if (installer == null || installer.BrowserDownloadUrl != manifest!.Url) continue;
            return new(release.Release, manifest, installer.BrowserDownloadUrl, release.Release.Body ?? string.Empty);
        }
        throw new NoUpdateAvailableException("MISIL ya está actualizado; no hay una release estable más reciente.");
    }

    public async Task<string> DownloadAsync(
        MisilUpdateCandidate candidate,
        string updatesRoot,
        IProgress<double>? progress = null,
        CancellationToken cancellationToken = default)
    {
        string destination = Path.Combine(updatesRoot, candidate.Manifest.AssetName);
        await _downloads.DownloadAsync(
            candidate.InstallerUrl,
            destination,
            candidate.Manifest.SizeBytes,
            progress,
            cancellationToken);
        string digest = await VerifiedDownloadService.Sha256Async(destination, cancellationToken);
        if (!digest.Equals(candidate.Manifest.Sha256, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("La actualización de MISIL no coincide con su SHA-256.");
        return destination;
    }

    private static bool ValidateManifest(
        MisilReleaseManifest? manifest,
        GitHubRelease release,
        string version,
        Version windowsVersion)
    {
        return manifest != null
            && manifest.SchemaVersion == 1
            && manifest.Product == "MISIL"
            && manifest.Channel == "stable"
            && manifest.Version == version
            && release.TagName == $"v{version}"
            && manifest.Architecture == "x64"
            && manifest.Compatibility.Contains("windows-x64", StringComparer.OrdinalIgnoreCase)
            && Version.TryParse(manifest.MinimumWindowsVersion, out var minimum)
            && windowsVersion >= minimum
            && manifest.SizeBytes > 0
            && manifest.Sha256.Length == 64
            && manifest.InstallerType == "inno"
            && manifest.AssetName.Equals($"MISIL-Setup-{version}-x64.exe", StringComparison.Ordinal)
            && manifest.Url.Scheme == Uri.UriSchemeHttps
            && !string.IsNullOrWhiteSpace(manifest.SilentArguments);
    }

    public void Dispose()
    {
        if (_ownsTransport && _transport is IDisposable transport) transport.Dispose();
        if (_ownsDownloads) _downloads.Dispose();
    }
}
