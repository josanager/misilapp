using MISILNative.Core.Distribution;

namespace MISILNative.Core.Agerbot;

public sealed class AgerbotModelDownloadService
{
    private readonly string _managedRoot;
    private readonly VerifiedDownloadService _downloads;
    private readonly AgerbotStorageQuotaService _quota;
    private readonly AgerbotSettingsStore _settings;

    public AgerbotModelDownloadService(
        string managedRoot,
        VerifiedDownloadService downloads,
        AgerbotStorageQuotaService quota,
        AgerbotSettingsStore settings)
    {
        _managedRoot = Path.GetFullPath(managedRoot);
        _downloads = downloads;
        _quota = quota;
        _settings = settings;
    }

    public async Task<(string Checkpoint, string Evaluation)> DownloadAsync(
        AgerbotRemoteModelCandidate candidate,
        ulong diskAvailableBytes,
        IProgress<double>? progress = null,
        CancellationToken cancellationToken = default)
    {
        ulong downloadBytes = checked(candidate.Manifest.Artifact.SizeBytes + candidate.EvaluationSizeBytes);
        var requirement = new AgerbotStorageRequirement(
            DownloadBytes: downloadBytes,
            InstalledBytes: candidate.Manifest.Artifact.SizeBytes,
            CandidateModelBytes: 0,
            TemporaryOverheadBytes: Math.Max(candidate.Manifest.Artifact.SizeBytes / 20, 16UL * 1024 * 1024));
        var decision = _quota.CanInstall(_quota.Snapshot(_settings.Settings.StorageQuotaBytes, diskAvailableBytes), requirement);
        if (!decision.Allowed) throw new InvalidOperationException(decision.Message);
        string root = Path.Combine(_managedRoot, "downloads");
        string version = candidate.Manifest.Release.Version;
        string checkpoint = Path.Combine(root, $"model-{version}.pt");
        string evaluation = Path.Combine(root, $"evaluation-{version}.json");
        await _downloads.DownloadAsync(
            candidate.CheckpointUrl,
            checkpoint,
            candidate.Manifest.Artifact.SizeBytes,
            progress,
            cancellationToken);
        string digest = await VerifiedDownloadService.Sha256Async(checkpoint, cancellationToken);
        if (!digest.Equals(candidate.Manifest.Artifact.Sha256, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("El modelo descargado no coincide con su SHA-256.");
        await _downloads.DownloadAsync(
            candidate.EvaluationUrl,
            evaluation,
            candidate.EvaluationSizeBytes,
            cancellationToken: cancellationToken);
        return (checkpoint, evaluation);
    }
}
