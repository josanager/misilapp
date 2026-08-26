using System.Text.Json;
using MISILNative.Core.Distribution;

namespace MISILNative.Core.Agerbot;

public sealed class AgerbotModelDiscoveryService
{
    private readonly SemanticVersion _runtimeVersion;
    private readonly string _platform;
    private readonly HashSet<string> _devices;

    public AgerbotModelDiscoveryService(
        string runtimeVersion,
        string platform = "windows-x64",
        IEnumerable<string>? devices = null)
    {
        _runtimeVersion = SemanticVersion.Parse(runtimeVersion);
        _platform = platform;
        _devices = new HashSet<string>(devices ?? ["cpu", "cuda"], StringComparer.OrdinalIgnoreCase);
    }

    public async Task<IReadOnlyList<AgerbotModelCandidate>> DiscoverAsync(
        string managedRoot,
        string? developmentProject = null,
        CancellationToken cancellationToken = default)
    {
        var locations = ManifestLocations(Path.Combine(managedRoot, "models"))
            .Select(path => (Path: path, Source: AgerbotModelSource.Managed))
            .ToList();
        if (!string.IsNullOrWhiteSpace(developmentProject))
            locations.AddRange(ManifestLocations(Path.Combine(developmentProject, "checkpoints"))
                .Select(path => (Path: path, Source: AgerbotModelSource.Development)));
        var candidates = new List<AgerbotModelCandidate>();
        foreach (var location in locations.DistinctBy(item => Path.GetFullPath(item.Path), StringComparer.OrdinalIgnoreCase))
        {
            var candidate = await ValidateCandidateAsync(location.Path, location.Source, cancellationToken);
            if (candidate != null) candidates.Add(candidate);
        }
        return candidates.OrderByDescending(item => SemanticVersion.Parse(item.Manifest.Model.Version)).ToList();
    }

    public AgerbotModelCandidate? Select(
        IEnumerable<AgerbotModelCandidate> candidates,
        string? pinnedVersion,
        bool automaticUpdates,
        bool allowPrerelease)
    {
        var eligible = candidates
            .Where(item => allowPrerelease || SemanticVersion.Parse(item.Manifest.Model.Version).Prerelease == null)
            .OrderByDescending(item => SemanticVersion.Parse(item.Manifest.Model.Version));
        return !automaticUpdates && !string.IsNullOrWhiteSpace(pinnedVersion)
            ? eligible.FirstOrDefault(item => item.Manifest.Model.Version == pinnedVersion)
            : eligible.FirstOrDefault();
    }

    public bool IsCompatible(AgerbotModelReleaseManifest manifest) =>
        ValidateContract(
            manifest.SchemaVersion,
            manifest.Channel,
            manifest.Model.Name,
            manifest.Model.Architecture,
            manifest.Model.Tokenizer,
            manifest.Release.Version,
            manifest.Runtime,
            manifest.Compatibility);

    private async Task<AgerbotModelCandidate?> ValidateCandidateAsync(
        string manifestPath,
        AgerbotModelSource source,
        CancellationToken cancellationToken)
    {
        try
        {
            await using var stream = File.OpenRead(manifestPath);
            var manifest = await JsonSerializer.DeserializeAsync<AgerbotModelManifest>(stream, GitHubJson.Options, cancellationToken);
            if (manifest == null || !ValidateContract(
                    manifest.SchemaVersion,
                    manifest.Channel,
                    manifest.Model.Name,
                    manifest.Model.Architecture,
                    manifest.Model.Tokenizer,
                    manifest.Model.Version,
                    manifest.Runtime,
                    manifest.Compatibility)) return null;
            string directory = Path.GetDirectoryName(manifestPath)!;
            string checkpoint = Path.GetFullPath(Path.Combine(directory, manifest.Checkpoint.Filename));
            if (!checkpoint.StartsWith(Path.GetFullPath(directory) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                || !File.Exists(checkpoint)
                || (ulong)new FileInfo(checkpoint).Length != manifest.Checkpoint.SizeBytes
                || manifest.Checkpoint.Sha256.Length != 64) return null;
            string digest = await VerifiedDownloadService.Sha256Async(checkpoint, cancellationToken);
            return digest.Equals(manifest.Checkpoint.Sha256, StringComparison.OrdinalIgnoreCase)
                ? new AgerbotModelCandidate(manifest, manifestPath, checkpoint, source)
                : null;
        }
        catch (JsonException) { return null; }
        catch (IOException) { return null; }
        catch (UnauthorizedAccessException) { return null; }
    }

    private bool ValidateContract(
        int schemaVersion,
        string channel,
        string name,
        string architecture,
        string tokenizer,
        string version,
        AgerbotModelRuntimeCompatibility runtime,
        AgerbotModelCompatibility compatibility)
    {
        if (schemaVersion != 2
            || channel != "stable"
            || name != "Agerbot"
            || architecture != "agerbot-transformer"
            || tokenizer is not ("byte-v1" or "char-v1")
            || !SemanticVersion.TryParse(version, out _)
            || !SemanticVersion.TryParse(runtime.MinimumVersion, out var minimum)
            || minimum > _runtimeVersion
            || !compatibility.Platforms.Contains(_platform, StringComparer.OrdinalIgnoreCase)
            || !compatibility.Devices.Any(_devices.Contains)) return false;
        return runtime.MaximumVersion == null
            || SemanticVersion.TryParse(runtime.MaximumVersion, out var maximum) && _runtimeVersion <= maximum;
    }

    private static IEnumerable<string> ManifestLocations(string root)
    {
        if (!Directory.Exists(root)) yield break;
        foreach (string directory in Directory.EnumerateDirectories(root, "*", SearchOption.TopDirectoryOnly))
        {
            string manifest = Path.Combine(directory, "manifest.json");
            if (File.Exists(manifest)) yield return manifest;
        }
    }
}
