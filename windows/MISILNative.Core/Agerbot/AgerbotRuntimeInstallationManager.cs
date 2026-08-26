using MISILNative.Core.Distribution;

namespace MISILNative.Core.Agerbot;

public sealed class AgerbotRuntimeInstallationManager
{
    private readonly string _root;
    private readonly VerifiedDownloadService _downloads;
    private readonly AgerbotStorageQuotaService _quota;
    private readonly AgerbotSettingsStore _settings;

    public AgerbotRuntimeInstallationManager(
        string root,
        VerifiedDownloadService downloads,
        AgerbotStorageQuotaService quota,
        AgerbotSettingsStore settings)
    {
        _root = Path.GetFullPath(root);
        _downloads = downloads;
        _quota = quota;
        _settings = settings;
    }

    public async Task<string> InstallAsync(
        AgerbotRuntimeReleaseManifest manifest,
        AgerbotRuntimePackage package,
        Uri assetUrl,
        ulong diskAvailableBytes,
        ulong candidateModelBytes,
        IProgress<double>? progress = null,
        CancellationToken cancellationToken = default)
    {
        ValidateManifest(manifest, package);
        var snapshot = _quota.Snapshot(_settings.Settings.StorageQuotaBytes, diskAvailableBytes);
        var requirement = new AgerbotStorageRequirement(
            package.SizeBytes,
            package.InstalledSizeBytes,
            candidateModelBytes,
            Math.Max(package.SizeBytes, 64UL * 1024 * 1024));
        var decision = _quota.CanInstall(snapshot, requirement);
        if (!decision.Allowed) throw new InvalidOperationException(decision.Message);

        string downloads = Path.Combine(_root, "downloads");
        string archive = Path.Combine(downloads, package.AssetName);
        await _downloads.DownloadAsync(assetUrl, archive, package.SizeBytes, progress, cancellationToken);
        string digest = await VerifiedDownloadService.Sha256Async(archive, cancellationToken);
        if (!digest.Equals(package.Sha256, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("El runtime descargado no coincide con su SHA-256.");

        string runtimeRoot = Path.Combine(_root, "runtime", manifest.Release.Version);
        string final = Path.Combine(runtimeRoot, package.Variant.ToLowerInvariant());
        string candidate = Path.Combine(runtimeRoot, $".candidate-{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(runtimeRoot);
            SafeZipExtractor.Extract(archive, candidate, package.InstalledSizeBytes);
            string entryPoint = Path.GetFullPath(Path.Combine(candidate, package.EntryPoint));
            string candidatePrefix = Path.GetFullPath(candidate) + Path.DirectorySeparatorChar;
            if (!entryPoint.StartsWith(candidatePrefix, StringComparison.OrdinalIgnoreCase) || !File.Exists(entryPoint))
                throw new InvalidDataException("El paquete no contiene el ejecutable declarado.");
            if (Directory.Exists(final)) Directory.Delete(final, recursive: true);
            Directory.Move(candidate, final);
            string installedEntryPoint = Path.Combine(final, package.EntryPoint);
            _settings.Update(settings =>
            {
                bool versionChanged = !string.IsNullOrWhiteSpace(settings.RuntimeVersion)
                    && settings.RuntimeVersion != manifest.Release.Version;
                if (versionChanged)
                {
                    settings.PreviousRuntimeVersion = settings.RuntimeVersion;
                    settings.PreviousCpuRuntimeExecutablePath = settings.CpuRuntimeExecutablePath;
                    settings.PreviousCudaRuntimeExecutablePath = settings.CudaRuntimeExecutablePath;
                }
                settings.RuntimeVersion = manifest.Release.Version;
                if (package.RuntimeVariant == AgerbotRuntimeVariant.Cuda)
                    settings.CudaRuntimeExecutablePath = installedEntryPoint;
                else
                {
                    settings.CpuRuntimeExecutablePath = installedEntryPoint;
                    if (versionChanged) settings.CudaRuntimeExecutablePath = string.Empty;
                }
                settings.RuntimeExecutablePath = installedEntryPoint;
                settings.RequestedDevice = package.RuntimeVariant == AgerbotRuntimeVariant.Cuda ? "auto" : "cpu";
            });
            return installedEntryPoint;
        }
        catch
        {
            try { if (Directory.Exists(candidate)) Directory.Delete(candidate, recursive: true); }
            catch { }
            throw;
        }
    }

    public void UninstallRuntimeAndModels()
    {
        foreach (string controlled in new[] { "runtime", "models", "downloads", "current-model.json", "update-state.json" })
        {
            string target = Path.Combine(_root, controlled);
            if (Directory.Exists(target)) Directory.Delete(target, recursive: true);
            else if (File.Exists(target)) File.Delete(target);
        }
        _settings.Update(settings =>
        {
            settings.RuntimeExecutablePath = string.Empty;
            settings.CpuRuntimeExecutablePath = string.Empty;
            settings.CudaRuntimeExecutablePath = string.Empty;
            settings.RuntimeVersion = null;
            settings.PreviousRuntimeVersion = null;
            settings.PreviousCpuRuntimeExecutablePath = string.Empty;
            settings.PreviousCudaRuntimeExecutablePath = string.Empty;
            settings.CheckpointPath = string.Empty;
            settings.ActiveModelVersion = null;
            settings.PreviousModelVersion = null;
        });
    }

    public bool RollbackRuntime()
    {
        string? failedVersion = _settings.Settings.RuntimeVersion;
        string? previousVersion = _settings.Settings.PreviousRuntimeVersion;
        if (string.IsNullOrWhiteSpace(previousVersion)
            || string.IsNullOrWhiteSpace(_settings.Settings.PreviousCpuRuntimeExecutablePath)) return false;
        _settings.Update(settings =>
        {
            settings.RuntimeVersion = settings.PreviousRuntimeVersion;
            settings.CpuRuntimeExecutablePath = settings.PreviousCpuRuntimeExecutablePath;
            settings.CudaRuntimeExecutablePath = settings.PreviousCudaRuntimeExecutablePath;
            settings.RuntimeExecutablePath = !string.IsNullOrWhiteSpace(settings.CudaRuntimeExecutablePath)
                ? settings.CudaRuntimeExecutablePath
                : settings.CpuRuntimeExecutablePath;
            settings.RequestedDevice = !string.IsNullOrWhiteSpace(settings.CudaRuntimeExecutablePath) ? "auto" : "cpu";
            settings.PreviousRuntimeVersion = null;
            settings.PreviousCpuRuntimeExecutablePath = string.Empty;
            settings.PreviousCudaRuntimeExecutablePath = string.Empty;
        });
        if (!string.IsNullOrWhiteSpace(failedVersion) && failedVersion != previousVersion)
        {
            string failedRoot = Path.Combine(_root, "runtime", failedVersion);
            try { if (Directory.Exists(failedRoot)) Directory.Delete(failedRoot, recursive: true); }
            catch { }
        }
        return true;
    }

    private static void ValidateManifest(AgerbotRuntimeReleaseManifest manifest, AgerbotRuntimePackage package)
    {
        if (manifest.SchemaVersion != 1 || manifest.Channel != "stable")
            throw new InvalidDataException("El manifiesto del runtime no es estable o compatible.");
        if (!Distribution.SemanticVersion.TryParse(manifest.Release.Version, out _)
            || manifest.Release.Tag != $"runtime-v{manifest.Release.Version}")
            throw new InvalidDataException("La versión del runtime no sigue el contrato.");
        if (!manifest.Packages.Contains(package)
            || package.Platform != "windows-x64"
            || package.SizeBytes == 0
            || package.InstalledSizeBytes < package.SizeBytes
            || package.Sha256.Length != 64
            || string.IsNullOrWhiteSpace(package.AssetName)
            || string.IsNullOrWhiteSpace(package.EntryPoint))
            throw new InvalidDataException("El paquete del runtime no es compatible con Windows x64.");
    }
}
