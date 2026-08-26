using System.Text.Json;
using MISILNative.Core.Distribution;

namespace MISILNative.Core.Agerbot;

public sealed class AgerbotModelInstallationManager
{
    private readonly string _managedRoot;

    public AgerbotModelInstallationManager(string managedRoot) => _managedRoot = Path.GetFullPath(managedRoot);

    public async Task<AgerbotModelCandidate> InstallCandidateAsync(
        AgerbotRemoteModelCandidate candidate,
        string downloadedCheckpoint,
        string downloadedEvaluation,
        CancellationToken cancellationToken = default)
    {
        string modelsRoot = Path.Combine(_managedRoot, "models");
        string final = Path.Combine(modelsRoot, candidate.Manifest.Release.Version);
        if (Directory.Exists(final))
        {
            string existingCheckpoint = Path.Combine(final, "model.pt");
            string existingManifest = Path.Combine(final, "manifest.json");
            if (File.Exists(existingCheckpoint)
                && File.Exists(existingManifest)
                && (ulong)new FileInfo(existingCheckpoint).Length == candidate.Manifest.Artifact.SizeBytes
                && (await VerifiedDownloadService.Sha256Async(existingCheckpoint, cancellationToken))
                    .Equals(candidate.Manifest.Artifact.Sha256, StringComparison.OrdinalIgnoreCase))
            {
                var local = JsonSerializer.Deserialize<AgerbotModelManifest>(
                    await File.ReadAllTextAsync(existingManifest, cancellationToken),
                    GitHubJson.Options);
                if (local?.Model.Version == candidate.Manifest.Release.Version)
                    return new(local, existingManifest, existingCheckpoint, AgerbotModelSource.Managed);
            }
            throw new InvalidDataException("La carpeta del modelo ya existe, pero no supera la verificación.");
        }

        Directory.CreateDirectory(modelsRoot);
        string temporary = Path.Combine(modelsRoot, $".candidate-{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(temporary);
            string checkpoint = Path.Combine(temporary, "model.pt");
            string evaluation = Path.Combine(temporary, "evaluation.json");
            File.Copy(downloadedCheckpoint, checkpoint, overwrite: false);
            File.Copy(downloadedEvaluation, evaluation, overwrite: false);
            var localManifest = ToLocalManifest(candidate.Manifest);
            string manifest = Path.Combine(temporary, "manifest.json");
            await File.WriteAllTextAsync(
                manifest,
                JsonSerializer.Serialize(localManifest, new JsonSerializerOptions(GitHubJson.Options) { WriteIndented = true }),
                cancellationToken);
            string digest = await VerifiedDownloadService.Sha256Async(checkpoint, cancellationToken);
            if ((ulong)new FileInfo(checkpoint).Length != localManifest.Checkpoint.SizeBytes
                || !digest.Equals(localManifest.Checkpoint.Sha256, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("El candidato cambió durante la preparación.");
            Directory.Move(temporary, final);
            return new(
                localManifest,
                Path.Combine(final, "manifest.json"),
                Path.Combine(final, "model.pt"),
                AgerbotModelSource.Managed);
        }
        catch
        {
            try { if (Directory.Exists(temporary)) Directory.Delete(temporary, recursive: true); }
            catch { }
            throw;
        }
    }

    public int PruneOldModels(params string?[] versionsToKeep)
    {
        string root = Path.Combine(_managedRoot, "models");
        if (!Directory.Exists(root)) return 0;
        var keep = new HashSet<string>(
            versionsToKeep.Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!),
            StringComparer.OrdinalIgnoreCase);
        int deleted = 0;
        foreach (string directory in Directory.EnumerateDirectories(root, "*", SearchOption.TopDirectoryOnly))
        {
            string name = Path.GetFileName(directory);
            if (name.StartsWith(".candidate-", StringComparison.Ordinal) || keep.Contains(name)) continue;
            Directory.Delete(directory, recursive: true);
            deleted++;
        }
        return deleted;
    }

    private static AgerbotModelManifest ToLocalManifest(AgerbotModelReleaseManifest remote) => new()
    {
        SchemaVersion = 2,
        Channel = remote.Channel,
        PublishedAt = remote.Release.PublishedAt,
        Model = new AgerbotModelManifestIdentity
        {
            Name = remote.Model.Name,
            Version = remote.Release.Version,
            TrainingName = remote.Model.TrainingName,
            Architecture = remote.Model.Architecture,
            Tokenizer = remote.Model.Tokenizer,
            Parameters = remote.Model.Parameters,
            ContextLength = remote.Model.ContextLength
        },
        Runtime = remote.Runtime,
        Checkpoint = new AgerbotModelCheckpoint
        {
            Filename = "model.pt",
            SizeBytes = remote.Artifact.SizeBytes,
            Sha256 = remote.Artifact.Sha256
        },
        Compatibility = remote.Compatibility
    };
}
