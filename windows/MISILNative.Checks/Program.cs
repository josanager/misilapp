using System.Diagnostics;
using System.Net;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MISILNative.Core.Agerbot;
using MISILNative.Core.Distribution;

await AgerbotChecks.RunAsync();

internal static class AgerbotChecks
{
    private static int _checks;

    public static async Task RunAsync()
    {
        CheckContracts();
        await CheckRuntimeClientAsync();
        await CheckManagedProcessLifecycleAsync();
        await CheckUnexpectedProcessExitAsync();
        await CheckPortConflictAsync();
        await CheckManagedOrphanOwnershipAsync();
        await CheckStartupTimeoutAsync();
        await CheckConversationIsolationAndPersistenceAsync();
        await CheckGenerationCancellationAsync();
        CheckHardwareRecommendations();
        await CheckCpuFallbackAsync();
        CheckStorageQuotaAndCleanup();
        CheckSafeArchiveExtraction();
        await CheckResumableAndTruncatedDownloadsAsync();
        await CheckRuntimeInstallationAsync();
        await CheckRuntimeReleaseSelectionAsync();
        CheckSemanticVersions();
        await CheckModelDiscoveryAsync();
        await CheckModelReleaseSelectionAsync();
        await CheckCandidateValidationAsync();
        await CheckActivationGateAndRollbackAsync();
        await CheckModelHashAndInstallationAsync();
        await CheckMisilUpdateAsync();
        await CheckMisilUpdateTransactionAsync();
        Console.WriteLine($"MISIL Windows phases 1-4: {_checks} comprobaciones superadas");
    }

    private static async Task CheckMisilUpdateAsync()
    {
        byte[] installerPayload = Encoding.UTF8.GetBytes("misil-setup-0.4.0");
        string digest = Convert.ToHexString(SHA256.HashData(installerPayload)).ToLowerInvariant();
        var manifest = new MisilReleaseManifest
        {
            Version = "0.4.0",
            PublishedAt = DateTimeOffset.UtcNow,
            AssetName = "MISIL-Setup-0.4.0-x64.exe",
            Url = new Uri("https://assets.test/MISIL-Setup-0.4.0-x64.exe"),
            SizeBytes = (ulong)installerPayload.Length,
            Sha256 = digest
        };
        var release = new GitHubRelease
        {
            TagName = "v0.4.0",
            Body = "Notas verificables",
            Assets =
            [
                Asset("misil-release.json", 20, "https://assets.test/misil-release.json"),
                Asset(manifest.AssetName, manifest.SizeBytes, manifest.Url.AbsoluteUri)
            ]
        };
        var transport = new FakeGitHubTransport(new Dictionary<string, byte[]>
        {
            ["https://api.test/misil-releases"] = JsonSerializer.SerializeToUtf8Bytes(new[]
            {
                new GitHubRelease { TagName = "v0.5.0-beta.1", Prerelease = true }, release
            }, GitHubJson.Options),
            ["https://assets.test/misil-release.json"] = JsonSerializer.SerializeToUtf8Bytes(manifest, GitHubJson.Options)
        });
        using var downloads = new VerifiedDownloadService(new HttpClient(new FakeHttpHandler(_ =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(installerPayload) }))));
        using var service = new MisilUpdateService(transport, downloads, new Uri("https://api.test/misil-releases"));
        var candidate = await service.LatestCompatibleAsync("0.3.0", false, new Version(10, 0, 22631));
        Require(candidate.Manifest.Version == "0.4.0" && candidate.ReleaseNotes == "Notas verificables", "stable MISIL update selected with notes");
        Require(transport.Requests.All(uri => !uri.AbsolutePath.EndsWith("/latest", StringComparison.OrdinalIgnoreCase)), "MISIL updater never uses releases/latest");
        string root = Path.Combine(Path.GetTempPath(), $"misil-app-download-{Guid.NewGuid():N}");
        try
        {
            string installer = await service.DownloadAsync(candidate, root);
            Require(File.Exists(installer), "MISIL installer downloaded and SHA verified");
            candidate.Manifest.Sha256 = new string('0', 64);
            try
            {
                await service.DownloadAsync(candidate, root);
                throw new InvalidOperationException("Se esperaba actualización corrupta");
            }
            catch (InvalidDataException) { Require(true, "corrupt MISIL update rejected"); }
        }
        finally { try { Directory.Delete(root, true); } catch { } }
    }

    private static async Task CheckMisilUpdateTransactionAsync()
    {
        string root = Path.Combine(Path.GetTempPath(), $"misil-app-transaction-{Guid.NewGuid():N}");
        string install = Path.Combine(root, "installed");
        string backup = Path.Combine(root, "backup");
        Directory.CreateDirectory(install);
        try
        {
            string app = Path.Combine(install, "MISIL.exe");
            string installer = Path.Combine(root, "MISIL-Setup-0.4.0-x64.exe");
            await File.WriteAllTextAsync(app, "version-0.3.0");
            await File.WriteAllTextAsync(installer, "installer");
            string digest = await VerifiedDownloadService.Sha256Async(installer);
            var plan = new MisilUpdaterLaunchPlan(
                Environment.ProcessId,
                installer,
                digest,
                (ulong)new FileInfo(installer).Length,
                install,
                app,
                "/VERYSILENT");
            await MisilUpdateTransaction.ValidateInstallerAsync(plan);
            Require(true, "valid MISIL external update plan accepted");
            MisilUpdateTransaction.BackupDirectory(install, backup);
            await File.WriteAllTextAsync(app, "broken-0.4.0");
            MisilUpdateTransaction.RestoreDirectory(backup, install);
            Require(await File.ReadAllTextAsync(app) == "version-0.3.0", "previous MISIL files restored after simulated update failure");
            var unsafePlan = plan with { RelaunchExecutable = Path.Combine(root, "foreign.exe") };
            await File.WriteAllTextAsync(unsafePlan.RelaunchExecutable, "foreign");
            try
            {
                await MisilUpdateTransaction.ValidateInstallerAsync(unsafePlan);
                throw new InvalidOperationException("Se esperaba plan inseguro");
            }
            catch (InvalidDataException) { Require(true, "updater rejects relaunch executable outside MISIL installation"); }
        }
        finally { try { Directory.Delete(root, true); } catch { } }
    }

    private static async Task CheckManagedOrphanOwnershipAsync()
    {
        string root = Path.Combine(Path.GetTempPath(), $"misil-orphan-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        try
        {
            using var owned = StartLongRunningProcess();
            var store = new ManagedRuntimeMetadataStore(Path.Combine(root, "owned.json"));
            store.Write(new ManagedRuntimeMetadata
            {
                ProcessId = owned.Id,
                StartedAt = owned.StartTime.ToUniversalTime(),
                ExecutablePath = owned.MainModule!.FileName!,
                CheckpointPath = Path.Combine(root, "model.pt")
            });
            Require(store.TryTerminateRecordedOrphan(), "owned orphan runtime terminated from exact metadata");
            await owned.WaitForExitAsync();
            Require(owned.HasExited, "owned orphan process no longer runs");

            using var foreign = StartLongRunningProcess();
            var stale = new ManagedRuntimeMetadataStore(Path.Combine(root, "stale.json"));
            stale.Write(new ManagedRuntimeMetadata
            {
                ProcessId = foreign.Id,
                StartedAt = foreign.StartTime.ToUniversalTime().AddMinutes(-5),
                ExecutablePath = foreign.MainModule!.FileName!,
                CheckpointPath = Path.Combine(root, "model.pt")
            });
            Require(!stale.TryTerminateRecordedOrphan() && !foreign.HasExited, "stale metadata never kills a foreign process");
            foreign.Kill(entireProcessTree: true);
            await foreign.WaitForExitAsync();
        }
        finally { try { Directory.Delete(root, true); } catch { } }
    }

    private static Process StartLongRunningProcess()
    {
        var info = new ProcessStartInfo(OperatingSystem.IsWindows() ? "powershell.exe" : "/bin/sh");
        if (OperatingSystem.IsWindows())
        {
            info.ArgumentList.Add("-NoProfile");
            info.ArgumentList.Add("-Command");
            info.ArgumentList.Add("Start-Sleep -Seconds 30");
        }
        else
        {
            info.ArgumentList.Add("-c");
            info.ArgumentList.Add("sleep 30");
        }
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        return Process.Start(info) ?? throw new InvalidOperationException("No se pudo crear el proceso de prueba controlado.");
    }

    private static void CheckSemanticVersions()
    {
        Require(SemanticVersion.Parse("1.2.0") > SemanticVersion.Parse("1.1.9"), "SemVer compares releases");
        Require(SemanticVersion.Parse("1.2.0") > SemanticVersion.Parse("1.2.0-beta.1"), "SemVer stable follows prerelease");
        Require(SemanticVersion.TryParse("v0.3.0+build.4", out var version) && version.ToString() == "0.3.0", "SemVer normalizes v and metadata");
        Require(!SemanticVersion.TryParse("best.pt", out _), "arbitrary checkpoint name is not a version");
    }

    private static async Task CheckModelDiscoveryAsync()
    {
        string root = Path.Combine(Path.GetTempPath(), $"misil-model-discovery-{Guid.NewGuid():N}");
        try
        {
            string modelRoot = Path.Combine(root, "models", "0.2.0");
            Directory.CreateDirectory(modelRoot);
            byte[] checkpoint = Encoding.UTF8.GetBytes("valid-model");
            string checkpointPath = Path.Combine(modelRoot, "model.pt");
            await File.WriteAllBytesAsync(checkpointPath, checkpoint);
            var manifest = LocalModelManifest("0.2.0", checkpoint);
            await File.WriteAllTextAsync(Path.Combine(modelRoot, "manifest.json"), JsonSerializer.Serialize(manifest, GitHubJson.Options));
            var discovery = new AgerbotModelDiscoveryService("0.2.0");
            var models = await discovery.DiscoverAsync(root);
            Require(models.Count == 1 && models[0].Manifest.Model.Tokenizer == "char-v1", "valid local model discovered by manifest");
            Require(discovery.Select(models, null, true, false)?.Manifest.Model.Version == "0.2.0", "latest compatible local model selected");
            await File.AppendAllTextAsync(checkpointPath, "corrupt");
            Require((await discovery.DiscoverAsync(root)).Count == 0, "local model with wrong size or SHA rejected");
            manifest.Compatibility.Platforms = ["macos-arm64"];
            await File.WriteAllBytesAsync(checkpointPath, checkpoint);
            await File.WriteAllTextAsync(Path.Combine(modelRoot, "manifest.json"), JsonSerializer.Serialize(manifest, GitHubJson.Options));
            Require((await discovery.DiscoverAsync(root)).Count == 0, "incompatible model platform rejected");
        }
        finally { try { Directory.Delete(root, true); } catch { } }
    }

    private static async Task CheckModelReleaseSelectionAsync()
    {
        string hash = new string('a', 64);
        var manifest = RemoteModelManifest("0.3.0", hash, 25);
        var release = new GitHubRelease
        {
            TagName = "model-v0.3.0",
            Assets =
            [
                Asset("agerbot-release.json", 10, "https://assets.test/model-manifest.json"),
                Asset("agerbot-0.3.0.pt", 25, "https://assets.test/model.pt"),
                Asset("evaluation.json", 5, "https://assets.test/evaluation.json"),
                Asset("checksums-sha256.txt", 80, "https://assets.test/checksums.txt")
            ]
        };
        var transport = new FakeGitHubTransport(new Dictionary<string, byte[]>
        {
            ["https://api.test/model-releases"] = JsonSerializer.SerializeToUtf8Bytes(new[]
            {
                new GitHubRelease { TagName = "model-v0.4.0", Prerelease = true }, release
            }, GitHubJson.Options),
            ["https://assets.test/model-manifest.json"] = JsonSerializer.SerializeToUtf8Bytes(manifest, GitHubJson.Options),
            ["https://assets.test/checksums.txt"] = Encoding.UTF8.GetBytes($"{hash}  agerbot-0.3.0.pt\n")
        });
        using var service = new AgerbotModelReleaseService(transport, new Uri("https://api.test/model-releases"));
        var selected = await service.LatestCompatibleAsync("0.2.0", "0.2.0", false);
        Require(selected.Manifest.Release.Version == "0.3.0", "latest stable model selected by SemVer");
        Require(selected.CheckpointUrl.AbsoluteUri == "https://assets.test/model.pt", "model asset resolved only through manifest");
        Require(transport.Requests.All(uri => !uri.AbsolutePath.EndsWith("/latest", StringComparison.OrdinalIgnoreCase)), "model updater never uses releases/latest");

        manifest.Runtime.MinimumVersion = "9.0.0";
        var incompatible = new FakeGitHubTransport(new Dictionary<string, byte[]>
        {
            ["https://api.test/model-releases"] = JsonSerializer.SerializeToUtf8Bytes(new[] { release }, GitHubJson.Options),
            ["https://assets.test/model-manifest.json"] = JsonSerializer.SerializeToUtf8Bytes(manifest, GitHubJson.Options),
            ["https://assets.test/checksums.txt"] = Encoding.UTF8.GetBytes($"{hash}  agerbot-0.3.0.pt\n")
        });
        using var incompatibleService = new AgerbotModelReleaseService(incompatible, new Uri("https://api.test/model-releases"));
        try
        {
            await incompatibleService.LatestCompatibleAsync("0.2.0", null, false);
            throw new InvalidOperationException("Se esperaba modelo incompatible");
        }
        catch (NoUpdateAvailableException exception) when (exception.Message.Contains("compatible", StringComparison.OrdinalIgnoreCase))
        {
            Require(true, "model incompatible with runtime rejected");
        }
    }

    private static async Task CheckCandidateValidationAsync()
    {
        using var fixture = new RuntimeFixture();
        var client = new FakeRuntimeClient { ReadyAfterLaunch = true };
        var launcher = new FakeProcessLauncher(info =>
        {
            client.ProcessLaunched = true;
            client.ActiveDevice = info.Environment["AGERBOT_DEVICE"];
        });
        var validator = new AgerbotCandidateValidator(
            launcher,
            new FixedRuntimeClientFactory(client),
            healthAttempts: 2,
            healthInterval: TimeSpan.FromMilliseconds(1));
        bool valid = await validator.ValidateAsync(
            fixture.Settings.RuntimeExecutablePath,
            fixture.Settings.CheckpointPath,
            "0.2.0",
            "auto");
        Require(valid, "candidate validated with isolated health and generation");
        Require(launcher.Process?.WasKilled == true, "candidate validation process tree terminated");
        client.ProcessLaunched = false;
        bool wrongVersion = await validator.ValidateAsync(
            fixture.Settings.RuntimeExecutablePath,
            fixture.Settings.CheckpointPath,
            "9.9.9",
            "cpu");
        Require(!wrongVersion, "candidate with unexpected runtime model version rejected");
    }

    private static async Task CheckActivationGateAndRollbackAsync()
    {
        string root = Path.Combine(Path.GetTempPath(), $"misil-activation-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        try
        {
            var gate = new AgerbotActivationGate();
            var currentStore = new AgerbotCurrentModelStore(Path.Combine(root, "current.json"));
            var failedStore = new AgerbotFailedVersionStore(Path.Combine(root, "failed.json"));
            var service = new AgerbotModelActivationService(gate, currentStore, failedStore);
            var runtime = new FakeModelRuntimeActivator();
            var previous = ModelRecord("0.2.0", root);
            await currentStore.WriteAsync(previous);
            gate.BeginGeneration();
            Task<bool> activation = service.ActivateAsync(ModelRecord("0.3.0", root, "0.2.0"), previous, runtime);
            await Task.Delay(10);
            Require(!activation.IsCompleted && runtime.Activated.Count == 0, "model activation waits for active generation");
            gate.EndGeneration();
            Require(await activation, "model activated after generation became idle");
            Require((await currentStore.LoadAsync())?.ActiveVersion == "0.3.0", "atomic current model record persisted");

            var failedRuntime = new FakeModelRuntimeActivator { FailedVersions = { "0.4.0" } };
            var active = await currentStore.LoadAsync();
            bool result = await service.ActivateAsync(ModelRecord("0.4.0", root, "0.3.0"), active, failedRuntime);
            Require(!result, "failed activation reports failure");
            Require((await currentStore.LoadAsync())?.ActiveVersion == "0.3.0", "failed activation rolls back current model atomically");
            Require(failedRuntime.Activated.SequenceEqual(["0.4.0", "0.3.0"]), "runtime rolled back to previous version");
            Require(await failedStore.ContainsAsync("0.4.0"), "failed version persisted to prevent reinstall loop");
        }
        finally { try { Directory.Delete(root, true); } catch { } }
    }

    private static async Task CheckModelHashAndInstallationAsync()
    {
        string root = Path.Combine(Path.GetTempPath(), $"misil-model-install-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        try
        {
            byte[] model = Encoding.UTF8.GetBytes("model-three");
            byte[] evaluation = Encoding.UTF8.GetBytes("{}");
            string digest = Convert.ToHexString(SHA256.HashData(model)).ToLowerInvariant();
            var remote = RemoteModelManifest("0.3.0", digest, (ulong)model.Length);
            var candidate = new AgerbotRemoteModelCandidate(
                remote,
                new Uri("https://assets.test/model.pt"),
                new Uri("https://assets.test/evaluation.json"),
                new Uri("https://assets.test/checksums.txt"),
                (ulong)evaluation.Length);
            using var verified = new VerifiedDownloadService(new HttpClient(new FakeHttpHandler(request =>
                Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new ByteArrayContent(request.RequestUri!.AbsolutePath.Contains("evaluation") ? evaluation : model)
                }))));
            var settings = new AgerbotSettingsStore(Path.Combine(root, "settings.json"));
            settings.Update(value => value.StorageQuotaBytes = AgerbotStorageQuotaService.BytesPerGiB);
            var downloader = new AgerbotModelDownloadService(root, verified, new AgerbotStorageQuotaService(root), settings);
            var downloaded = await downloader.DownloadAsync(candidate, 2 * AgerbotStorageQuotaService.BytesPerGiB);
            Require(File.Exists(downloaded.Checkpoint), "verified model downloaded");
            var installer = new AgerbotModelInstallationManager(root);
            var installed = await installer.InstallCandidateAsync(candidate, downloaded.Checkpoint, downloaded.Evaluation);
            Require(File.Exists(installed.ManifestPath) && File.Exists(installed.CheckpointPath), "model installed atomically with local manifest");
            Directory.CreateDirectory(Path.Combine(root, "models", "0.1.0"));
            Directory.CreateDirectory(Path.Combine(root, "models", "0.2.0"));
            Require(installer.PruneOldModels("0.3.0", "0.2.0") == 1, "model pruning keeps active and rollback versions");

            remote.Artifact.Sha256 = new string('f', 64);
            try
            {
                await downloader.DownloadAsync(candidate, 2 * AgerbotStorageQuotaService.BytesPerGiB);
                throw new InvalidOperationException("Se esperaba hash incorrecto");
            }
            catch (InvalidDataException) { Require(true, "model with incorrect SHA rejected"); }
        }
        finally { try { Directory.Delete(root, true); } catch { } }
    }

    private static AgerbotModelManifest LocalModelManifest(string version, byte[] checkpoint) => new()
    {
        SchemaVersion = 2,
        Channel = "stable",
        Model = new AgerbotModelManifestIdentity
        {
            Name = "Agerbot", Version = version, TrainingName = "test", Architecture = "agerbot-transformer",
            Tokenizer = "char-v1", Parameters = 10, ContextLength = 32
        },
        Runtime = new AgerbotModelRuntimeCompatibility { MinimumVersion = "0.2.0", MaximumVersion = "0.3.0" },
        Checkpoint = new AgerbotModelCheckpoint
        {
            Filename = "model.pt", SizeBytes = (ulong)checkpoint.Length,
            Sha256 = Convert.ToHexString(SHA256.HashData(checkpoint)).ToLowerInvariant()
        },
        Compatibility = new AgerbotModelCompatibility { Platforms = ["windows-x64"], Devices = ["cpu", "cuda"] }
    };

    private static AgerbotModelReleaseManifest RemoteModelManifest(string version, string hash, ulong size) => new()
    {
        SchemaVersion = 2,
        Channel = "stable",
        Release = new AgerbotModelReleaseIdentity { Version = version, Tag = $"model-v{version}", PublishedAt = "2026-01-01T00:00:00Z" },
        Model = new AgerbotReleaseModelIdentity
        {
            Name = "Agerbot", TrainingName = "test", Architecture = "agerbot-transformer", Tokenizer = "char-v1",
            Parameters = 10, ContextLength = 32
        },
        Runtime = new AgerbotModelRuntimeCompatibility { MinimumVersion = "0.2.0", MaximumVersion = "0.3.0" },
        Artifact = new AgerbotModelArtifact { AssetName = $"agerbot-{version}.pt", SizeBytes = size, Sha256 = hash },
        Evaluation = new AgerbotEvaluationArtifact { AssetName = "evaluation.json", Status = "passed" },
        Compatibility = new AgerbotModelCompatibility { Platforms = ["windows-x64"], Devices = ["cpu", "cuda"] }
    };

    private static AgerbotCurrentModelRecord ModelRecord(string version, string root, string? previous = null) => new()
    {
        ActiveVersion = version,
        PreviousVersion = previous,
        ActivatedAt = DateTimeOffset.UtcNow,
        CheckpointPath = Path.Combine(root, version, "model.pt"),
        ManifestPath = Path.Combine(root, version, "manifest.json")
    };

    private static async Task CheckRuntimeReleaseSelectionAsync()
    {
        var cpu = RuntimePackage("cpu", "cpu.zip", 100, 200, 19041);
        var cuda = RuntimePackage("cuda", "cuda.zip", 120, 240, 19041);
        var manifest = new AgerbotRuntimeReleaseManifest
        {
            SchemaVersion = 1,
            Channel = "stable",
            Release = new AgerbotRuntimeReleaseIdentity { Version = "0.3.0", Tag = "runtime-v0.3.0" },
            Packages = [cpu, cuda]
        };
        var release = new GitHubRelease
        {
            TagName = "runtime-v0.3.0",
            Assets =
            [
                Asset("agerbot-runtime-release.json", 10, "https://assets.test/runtime-manifest.json"),
                Asset("cpu.zip", 100, "https://assets.test/cpu.zip"),
                Asset("cuda.zip", 120, "https://assets.test/cuda.zip")
            ]
        };
        var prerelease = new GitHubRelease { TagName = "runtime-v0.4.0", Prerelease = true };
        var transport = new FakeGitHubTransport(new Dictionary<string, byte[]>
        {
            ["https://api.test/releases"] = JsonSerializer.SerializeToUtf8Bytes(new[] { prerelease, release }, GitHubJson.Options),
            ["https://assets.test/runtime-manifest.json"] = JsonSerializer.SerializeToUtf8Bytes(manifest, GitHubJson.Options)
        });
        using var service = new AgerbotRuntimeReleaseService(transport, new Uri("https://api.test/releases"));
        var selected = await service.LatestCompatibleAsync("0.2.0", allowPrerelease: false, windowsBuild: 22631);
        Require(selected.Manifest.Release.Version == "0.3.0", "latest stable runtime selected with SemVer");
        Require(selected.Packages.ContainsKey(AgerbotRuntimeVariant.Cpu), "runtime release contains mandatory CPU package");
        Require(selected.Packages.ContainsKey(AgerbotRuntimeVariant.Cuda), "runtime release exposes compatible CUDA package");
        Require(transport.Requests.All(uri => !uri.AbsolutePath.EndsWith("/latest", StringComparison.OrdinalIgnoreCase)), "runtime release never uses releases/latest");

        manifest.Packages = [RuntimePackage("cuda", "cuda.zip", 120, 240, 30000)];
        var incompatibleTransport = new FakeGitHubTransport(new Dictionary<string, byte[]>
        {
            ["https://api.test/releases"] = JsonSerializer.SerializeToUtf8Bytes(new[] { release }, GitHubJson.Options),
            ["https://assets.test/runtime-manifest.json"] = JsonSerializer.SerializeToUtf8Bytes(manifest, GitHubJson.Options)
        });
        using var incompatibleService = new AgerbotRuntimeReleaseService(incompatibleTransport, new Uri("https://api.test/releases"));
        try
        {
            await incompatibleService.LatestCompatibleAsync(null, false, 22631);
            throw new InvalidOperationException("Se esperaba rechazo de runtime incompatible");
        }
        catch (InvalidOperationException exception) when (exception.Message.Contains("compatible", StringComparison.OrdinalIgnoreCase))
        {
            Require(true, "runtime incompatible rejected");
        }
    }

    private static AgerbotRuntimePackage RuntimePackage(string variant, string asset, ulong size, ulong installed, int build) => new()
    {
        Variant = variant,
        Platform = "windows-x64",
        AssetName = asset,
        EntryPoint = "agerbot-runtime.exe",
        SizeBytes = size,
        InstalledSizeBytes = installed,
        Sha256 = new string('a', 64),
        MinimumWindowsBuild = build
    };

    private static GitHubReleaseAsset Asset(string name, ulong size, string url) => new()
    {
        Name = name,
        Size = size,
        BrowserDownloadUrl = new Uri(url)
    };

    private static void CheckHardwareRecommendations()
    {
        var rtx = new AgerbotHardwareCapabilities
        {
            GpuName = "NVIDIA RTX 3050 Laptop",
            VramBytes = 4UL * 1024 * 1024 * 1024,
            NvidiaSmiAvailable = true
        };
        var cuda = AgerbotHardwareRecommender.Recommend(rtx, compatibleCudaRuntimeAvailable: true);
        Require(cuda.Variant == AgerbotRuntimeVariant.Cuda && cuda.CpuFallbackRequired, "CUDA recommended when compatible");
        var noPackage = AgerbotHardwareRecommender.Recommend(rtx, compatibleCudaRuntimeAvailable: false);
        Require(noPackage.Variant == AgerbotRuntimeVariant.Cpu, "CPU when CUDA package unavailable");
        rtx.VramBytes = 2UL * 1024 * 1024 * 1024;
        Require(AgerbotHardwareRecommender.Recommend(rtx, true).Variant == AgerbotRuntimeVariant.Cpu, "CPU for insufficient VRAM");
    }

    private static async Task CheckCpuFallbackAsync()
    {
        using var fixture = new RuntimeFixture();
        var client = new FakeRuntimeClient { ReadyAfterLaunch = true, ReadyOnlyOnCpu = true };
        var launcher = new FakeProcessLauncher(info =>
        {
            client.ProcessLaunched = true;
            client.ActiveDevice = info.Environment["AGERBOT_DEVICE"];
        });
        var manager = fixture.Manager(client, launcher, attempts: 2);
        fixture.Settings.RequestedDevice = "auto";
        await manager.StartAsync(fixture.Settings);
        Require(manager.State.IsReady && manager.State.Health?.Model.Device == "cpu", "CUDA failure falls back to CPU");
        Require(launcher.Devices.SequenceEqual(["auto", "cpu"]), "fallback launch order");
        Require(launcher.Executables.Count == 2
            && launcher.Executables[0] == fixture.Settings.CudaRuntimeExecutablePath
            && launcher.Executables[1] == fixture.Settings.CpuRuntimeExecutablePath,
            "CPU fallback uses its own packaged runtime");
        await manager.StopAsync();
    }

    private static void CheckStorageQuotaAndCleanup()
    {
        string root = Path.Combine(Path.GetTempPath(), $"misil-quota-{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(Path.Combine(root, "downloads"));
            File.WriteAllBytes(Path.Combine(root, "runtime.bin"), new byte[1024]);
            string oldPartial = Path.Combine(root, "downloads", "old.partial");
            string recentPartial = Path.Combine(root, "downloads", "recent.partial");
            File.WriteAllText(oldPartial, "old");
            File.WriteAllText(recentPartial, "new");
            File.SetLastWriteTimeUtc(oldPartial, DateTime.UtcNow.AddDays(-10));
            var quota = new AgerbotStorageQuotaService(root);
            var enough = quota.Snapshot(2 * AgerbotStorageQuotaService.BytesPerGiB, 5 * AgerbotStorageQuotaService.BytesPerGiB);
            var requirement = new AgerbotStorageRequirement(100, 200, 300, 400);
            Require(quota.CanInstall(enough, requirement).Allowed, "storage quota allows valid installation");
            var small = quota.Snapshot(1024, 5 * AgerbotStorageQuotaService.BytesPerGiB);
            Require(!quota.CanInstall(small, requirement).Allowed, "storage quota rejects insufficient quota");
            var noDisk = quota.Snapshot(2 * AgerbotStorageQuotaService.BytesPerGiB, 100);
            Require(!quota.CanInstall(noDisk, requirement).Allowed, "storage quota rejects insufficient disk");
            Require(quota.CleanOldPartialDownloads(TimeSpan.FromDays(7)) == 1, "old partial cleaned");
            Require(File.Exists(recentPartial), "recent partial preserved");
        }
        finally { try { Directory.Delete(root, true); } catch { } }
    }

    private static void CheckSafeArchiveExtraction()
    {
        string root = Path.Combine(Path.GetTempPath(), $"misil-zip-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        try
        {
            string valid = Path.Combine(root, "valid.zip");
            using (var archive = ZipFile.Open(valid, ZipArchiveMode.Create))
            {
                var entry = archive.CreateEntry("runtime/agerbot-runtime.exe");
                using var writer = new StreamWriter(entry.Open());
                writer.Write("runtime");
            }
            string validOut = Path.Combine(root, "valid-out");
            SafeZipExtractor.Extract(valid, validOut, 1024);
            Require(File.Exists(Path.Combine(validOut, "runtime", "agerbot-runtime.exe")), "safe zip extracted");

            string malicious = Path.Combine(root, "malicious.zip");
            using (var archive = ZipFile.Open(malicious, ZipArchiveMode.Create))
                archive.CreateEntry("../escape.exe");
            try
            {
                SafeZipExtractor.Extract(malicious, Path.Combine(root, "bad-out"), 1024);
                throw new InvalidOperationException("Se esperaba rechazo de path traversal");
            }
            catch (InvalidDataException) { Require(!File.Exists(Path.Combine(root, "escape.exe")), "zip path traversal rejected"); }
        }
        finally { try { Directory.Delete(root, true); } catch { } }
    }

    private static async Task CheckResumableAndTruncatedDownloadsAsync()
    {
        string root = Path.Combine(Path.GetTempPath(), $"misil-download-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        try
        {
            byte[] payload = Encoding.UTF8.GetBytes("runtime-payload");
            var handler = new FakeHttpHandler(request =>
            {
                long start = request.Headers.Range?.Ranges.FirstOrDefault()?.From ?? 0;
                var response = new HttpResponseMessage(start > 0 ? HttpStatusCode.PartialContent : HttpStatusCode.OK)
                {
                    Content = new ByteArrayContent(payload[(int)start..])
                };
                return Task.FromResult(response);
            });
            using var service = new VerifiedDownloadService(new HttpClient(handler));
            string resumed = Path.Combine(root, "runtime.zip");
            await File.WriteAllBytesAsync(resumed + ".partial", payload[..4]);
            await service.DownloadAsync(new Uri("https://assets.test/runtime.zip"), resumed, (ulong)payload.Length);
            Require((await File.ReadAllBytesAsync(resumed)).SequenceEqual(payload), "download resumed safely");
            Require(handler.Requests.Any(item => item.Contains("GET /runtime.zip", StringComparison.Ordinal)), "resume request sent");

            string truncated = Path.Combine(root, "truncated.zip");
            try
            {
                await service.DownloadAsync(new Uri("https://assets.test/truncated.zip"), truncated, (ulong)payload.Length + 1);
                throw new InvalidOperationException("Se esperaba descarga truncada");
            }
            catch (InvalidDataException) { Require(File.Exists(truncated + ".partial"), "truncated download retained as partial"); }

            string cancelled = Path.Combine(root, "cancelled.zip");
            using var cancellation = new CancellationTokenSource();
            using var cancellableService = new VerifiedDownloadService(new HttpClient(new FakeHttpHandler(_ =>
                Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StreamContent(new ChunkedReadStream(payload, 3))
                }))));
            try
            {
                await cancellableService.DownloadAsync(
                    new Uri("https://assets.test/cancelled.zip"),
                    cancelled,
                    (ulong)payload.Length,
                    new CallbackProgress(value =>
                    {
                        if (value > 0) cancellation.Cancel();
                    }),
                    cancellation.Token);
                throw new InvalidOperationException("Se esperaba cancelación");
            }
            catch (OperationCanceledException)
            {
                string partial = cancelled + ".partial";
                Require(File.Exists(partial) && new FileInfo(partial).Length < payload.Length, "cancelled download preserves resumable partial");
            }
        }
        finally { try { Directory.Delete(root, true); } catch { } }
    }

    private static async Task CheckRuntimeInstallationAsync()
    {
        string root = Path.Combine(Path.GetTempPath(), $"misil-runtime-install-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        try
        {
            string sourceZip = Path.Combine(root, "source.zip");
            using (var archive = ZipFile.Open(sourceZip, ZipArchiveMode.Create))
            {
                var entry = archive.CreateEntry("agerbot-runtime.exe");
                using var writer = new StreamWriter(entry.Open());
                writer.Write("runtime");
            }
            byte[] payload = await File.ReadAllBytesAsync(sourceZip);
            string hash = Convert.ToHexString(SHA256.HashData(payload)).ToLowerInvariant();
            var package = new AgerbotRuntimePackage
            {
                Variant = "cpu",
                Platform = "windows-x64",
                AssetName = "agerbot-runtime.zip",
                EntryPoint = "agerbot-runtime.exe",
                SizeBytes = (ulong)payload.Length,
                InstalledSizeBytes = 1024 * 1024,
                Sha256 = hash
            };
            var manifest = new AgerbotRuntimeReleaseManifest
            {
                SchemaVersion = 1,
                Channel = "stable",
                Release = new AgerbotRuntimeReleaseIdentity { Version = "0.2.0", Tag = "runtime-v0.2.0" },
                Packages = [package]
            };
            using var downloads = new VerifiedDownloadService(new HttpClient(new FakeHttpHandler(_ =>
                Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(payload) }))));
            string settingsPath = Path.Combine(root, "settings.json");
            var settings = new AgerbotSettingsStore(settingsPath);
            settings.Update(value => value.StorageQuotaBytes = 2 * AgerbotStorageQuotaService.BytesPerGiB);
            string managed = Path.Combine(root, "managed");
            var installer = new AgerbotRuntimeInstallationManager(
                managed,
                downloads,
                new AgerbotStorageQuotaService(managed),
                settings);
            string entryPoint = await installer.InstallAsync(
                manifest,
                package,
                new Uri("https://assets.test/agerbot-runtime.zip"),
                5 * AgerbotStorageQuotaService.BytesPerGiB,
                candidateModelBytes: 128);
            Require(File.Exists(entryPoint), "runtime installed atomically");
            Require(settings.Settings.CpuRuntimeExecutablePath == entryPoint, "runtime settings persisted");
            var nextManifest = new AgerbotRuntimeReleaseManifest
            {
                SchemaVersion = 1,
                Channel = "stable",
                Release = new AgerbotRuntimeReleaseIdentity { Version = "0.3.0", Tag = "runtime-v0.3.0" },
                Packages = [package]
            };
            string updatedEntryPoint = await installer.InstallAsync(
                nextManifest,
                package,
                new Uri("https://assets.test/agerbot-runtime.zip"),
                5 * AgerbotStorageQuotaService.BytesPerGiB,
                candidateModelBytes: 128);
            Require(settings.Settings.PreviousRuntimeVersion == "0.2.0" && File.Exists(updatedEntryPoint), "runtime update preserves previous version metadata");
            Require(installer.RollbackRuntime() && settings.Settings.RuntimeVersion == "0.2.0" && settings.Settings.RuntimeExecutablePath == entryPoint, "failed runtime update rolls back to previous executable");
            string conversation = Path.Combine(root, "agerbot-conversation.json");
            await File.WriteAllTextAsync(conversation, "[]");
            installer.UninstallRuntimeAndModels();
            Require(!File.Exists(entryPoint) && string.IsNullOrEmpty(settings.Settings.RuntimeExecutablePath), "runtime uninstalled");
            Require(File.Exists(conversation), "Agerbot uninstall preserves local conversation");
        }
        finally { try { Directory.Delete(root, true); } catch { } }
    }

    private static async Task CheckRuntimeClientAsync()
    {
        var handler = new FakeHttpHandler(async request =>
        {
            if (request.RequestUri?.AbsolutePath == "/v1/health")
            {
                return JsonResponse(HttpStatusCode.OK, """{"status":"ready","runtimeVersion":"0.2.0","model":{"name":"Agerbot","version":"0.2.0","loaded":true,"device":"cpu"}}""");
            }
            if (request.RequestUri?.AbsolutePath == "/v1/chat")
            {
                string body = await request.Content!.ReadAsStringAsync();
                Require(body.Contains("agerbot-local", StringComparison.Ordinal), "runtime client chat body");
                return JsonResponse(HttpStatusCode.OK, """{"conversationId":"agerbot-local","message":{"role":"assistant","content":"hola"},"usage":{"promptTokens":1,"generatedTokens":1,"durationMs":2},"model":{"name":"Agerbot","version":"0.2.0","device":"cpu"}}""");
            }
            return JsonResponse(HttpStatusCode.OK, """{"conversationId":"agerbot-local","cancelRequested":true}""");
        });
        using var client = new AgerbotRuntimeClient(new Uri("http://127.0.0.1:4318"), handler);
        var health = await client.HealthAsync();
        Require(health.RuntimeVersion == "0.2.0" && health.Model.Loaded == true, "runtime client health");
        var chat = await client.ChatAsync(new AgerbotChatRequest { Message = "hola" });
        Require(chat.Message.Content == "hola", "runtime client chat response");
        var cancel = await client.CancelAsync();
        Require(cancel.CancelRequested, "runtime client cancel response");
        Require(handler.Requests.SequenceEqual(["GET /v1/health", "POST /v1/chat", "POST /v1/chat/cancel"]), "runtime client endpoints");

        using var errorClient = new AgerbotRuntimeClient(
            new Uri("http://127.0.0.1:4318"),
            new FakeHttpHandler(_ => Task.FromResult(JsonResponse(
                HttpStatusCode.BadRequest,
                """{"error":{"code":"checkpoint_invalid","message":"Modelo inválido","retryable":false}}"""))));
        try
        {
            await errorClient.HealthAsync();
            throw new InvalidOperationException("Se esperaba error estructurado");
        }
        catch (AgerbotClientException exception)
        {
            Require(exception.Code == "checkpoint_invalid" && !exception.Retryable, "runtime client structured error");
        }
    }

    private static void CheckContracts()
    {
        const string healthJson = """
        {"status":"ready","runtimeVersion":"0.2.0","model":{"name":"Agerbot","version":"0.2.0","trainingName":"gastronomia-peruana-v2","loaded":true,"parameters":10773504,"parameterCount":10773504,"device":"cuda","tokenizer":"char-v1","contextLength":256}}
        """;
        var health = JsonSerializer.Deserialize<AgerbotHealthResponse>(healthJson, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Require(health?.Model.Name == "Agerbot", "health name");
        Require(health?.Model.Tokenizer == "char-v1", "health tokenizer");
        Require(health?.Model.ContextLength == 256, "health context");
        Require(health?.Model.ParameterCount == 10_773_504, "health parameters");
        Require(AgerbotConstants.ReservedConversationId == "agerbot-local", "reserved id");

        var request = new AgerbotChatRequest
        {
            Message = "hola",
            History = [new AgerbotHistoryItem { Role = "user", Content = "antes" }]
        };
        string encoded = JsonSerializer.Serialize(request, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Require(encoded.Contains("\"conversationId\":\"agerbot-local\"", StringComparison.Ordinal), "chat contract");
    }

    private static async Task CheckManagedProcessLifecycleAsync()
    {
        using var fixture = new RuntimeFixture();
        var client = new FakeRuntimeClient { ReadyAfterLaunch = true };
        var launcher = new FakeProcessLauncher(_ => client.ProcessLaunched = true);
        var manager = fixture.Manager(client, launcher, attempts: 3);
        await manager.StartAsync(fixture.Settings);
        Require(manager.State.IsReady, "managed process ready");
        Require(launcher.Process != null && !launcher.Process.WasKilled, "process running");
        await manager.StopAsync();
        Require(launcher.Process?.WasKilled == true, "managed process killed on stop");
        Require(manager.State.Status == AgerbotRuntimeStatus.Stopped, "state stopped");
    }

    private static async Task CheckPortConflictAsync()
    {
        using var fixture = new RuntimeFixture();
        var client = new FakeRuntimeClient { PortHasService = true };
        var launcher = new FakeProcessLauncher();
        var manager = fixture.Manager(client, launcher, attempts: 2);
        await manager.StartAsync(fixture.Settings);
        Require(manager.State.Status == AgerbotRuntimeStatus.PortConflict, "foreign port conflict");
        Require(launcher.Process == null, "foreign process not launched or killed");
    }

    private static async Task CheckUnexpectedProcessExitAsync()
    {
        using var fixture = new RuntimeFixture();
        var client = new FakeRuntimeClient { ReadyAfterLaunch = true };
        var launcher = new FakeProcessLauncher(_ => client.ProcessLaunched = true);
        var manager = fixture.Manager(client, launcher, attempts: 3);
        await manager.StartAsync(fixture.Settings);
        launcher.Process!.Crash(17);
        Require(manager.State.Status == AgerbotRuntimeStatus.Failed, "unexpected runtime exit reported");
    }

    private static async Task CheckStartupTimeoutAsync()
    {
        using var fixture = new RuntimeFixture();
        var client = new FakeRuntimeClient();
        var launcher = new FakeProcessLauncher();
        var manager = fixture.Manager(client, launcher, attempts: 2);
        await manager.StartAsync(fixture.Settings);
        Require(manager.State.Status == AgerbotRuntimeStatus.Failed, "startup timeout state");
        Require(launcher.Process?.WasKilled == true, "timed out process killed");
    }

    private static async Task CheckConversationIsolationAndPersistenceAsync()
    {
        using var fixture = new RuntimeFixture();
        string conversation = Path.Combine(fixture.Root, "agerbot-conversation.json");
        var client = new FakeRuntimeClient { ChatText = "Respuesta local" };
        var process = new FakeReadyProcessManager();
        var settings = new AgerbotSettingsStore(Path.Combine(fixture.Root, "settings.json"));
        var store = new AgerbotConversationStore(client, process, settings, conversation);
        await store.SendAsync("Hola Agerbot");
        Require(store.Messages.Count == 2, "local messages appended");
        Require(store.Messages[1].Content == "Respuesta local", "assistant response");
        Require(client.LastChat?.ConversationId == "agerbot-local", "local conversation id");
        Require(File.Exists(conversation), "separate history file");
        Require(!conversation.Contains("internet-messages", StringComparison.OrdinalIgnoreCase), "history separate from hub");
        var restored = new AgerbotConversationStore(client, process, settings, conversation);
        Require(restored.Messages.Count == 2, "history restored");
    }

    private static async Task CheckGenerationCancellationAsync()
    {
        using var fixture = new RuntimeFixture();
        var client = new FakeRuntimeClient { BlockChatUntilCancelled = true };
        var process = new FakeReadyProcessManager();
        var settings = new AgerbotSettingsStore(Path.Combine(fixture.Root, "settings.json"));
        var store = new AgerbotConversationStore(client, process, settings, Path.Combine(fixture.Root, "cancel.json"));
        Task sending = store.SendAsync("Cancela esto");
        for (int index = 0; index < 100 && !store.IsGenerating; index++) await Task.Delay(2);
        await store.CancelAsync();
        await sending;
        Require(client.CancelWasRequested, "cancel endpoint requested");
        Require(!store.IsGenerating, "conversation recovered after cancel");
    }

    private static void Require(bool condition, string name)
    {
        if (!condition) throw new InvalidOperationException($"Falló: {name}");
        _checks++;
    }

    private static HttpResponseMessage JsonResponse(HttpStatusCode status, string json) => new(status)
    {
        Content = new StringContent(json, Encoding.UTF8, "application/json")
    };

    private sealed class RuntimeFixture : IDisposable
    {
        public string Root { get; } = Path.Combine(Path.GetTempPath(), $"misil-win-check-{Guid.NewGuid():N}");
        public AgerbotSettings Settings { get; }

        public RuntimeFixture()
        {
            Directory.CreateDirectory(Root);
            string runtime = Path.Combine(Root, "agerbot-runtime-cuda.exe");
            string cpuRuntime = Path.Combine(Root, "agerbot-runtime-cpu.exe");
            string checkpoint = Path.Combine(Root, "model.pt");
            File.WriteAllText(runtime, "runtime");
            File.WriteAllText(cpuRuntime, "runtime-cpu");
            File.WriteAllText(checkpoint, "model");
            Settings = new AgerbotSettings
            {
                RuntimeExecutablePath = runtime,
                CudaRuntimeExecutablePath = runtime,
                CpuRuntimeExecutablePath = cpuRuntime,
                CheckpointPath = checkpoint
            };
        }

        public AgerbotProcessManager Manager(FakeRuntimeClient client, FakeProcessLauncher launcher, int attempts) =>
            new(
                client,
                launcher,
                new ManagedRuntimeMetadataStore(Path.Combine(Root, "managed-process.json")),
                attempts,
                TimeSpan.FromMilliseconds(2));

        public void Dispose()
        {
            try { Directory.Delete(Root, recursive: true); }
            catch { }
        }
    }

    private sealed class FakeRuntimeClient : IAgerbotRuntimeClient
    {
        public bool PortHasService { get; set; }
        public bool ReadyAfterLaunch { get; set; }
        public bool ReadyOnlyOnCpu { get; set; }
        public string? ActiveDevice { get; set; }
        public bool ProcessLaunched { get; set; }
        public string ChatText { get; set; } = "respuesta";
        public bool BlockChatUntilCancelled { get; set; }
        public bool CancelWasRequested { get; private set; }
        public AgerbotChatRequest? LastChat { get; private set; }

        public Task<AgerbotHealthResponse> HealthAsync(CancellationToken cancellationToken = default)
        {
            if (!ReadyAfterLaunch || !ProcessLaunched || (ReadyOnlyOnCpu && ActiveDevice != "cpu"))
                throw new AgerbotClientException("unavailable", "sin runtime");
            return Task.FromResult(new AgerbotHealthResponse
            {
                Status = "ready",
                RuntimeVersion = "0.2.0",
                Model = new AgerbotModelIdentity { Loaded = true, Version = "0.2.0", Device = ActiveDevice == "cpu" ? "cpu" : "cuda" }
            });
        }

        public Task<AgerbotCapabilitiesResponse> CapabilitiesAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new AgerbotCapabilitiesResponse());

        public async Task<AgerbotChatResponse> ChatAsync(AgerbotChatRequest request, CancellationToken cancellationToken = default)
        {
            LastChat = request;
            if (BlockChatUntilCancelled) await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            return new AgerbotChatResponse
            {
                ConversationId = request.ConversationId,
                Message = new AgerbotChatMessagePayload { Role = "assistant", Content = ChatText }
            };
        }

        public Task<AgerbotCancelResponse> CancelAsync(string conversationId = AgerbotConstants.ReservedConversationId, CancellationToken cancellationToken = default)
        {
            CancelWasRequested = true;
            return Task.FromResult(new AgerbotCancelResponse { ConversationId = conversationId, CancelRequested = true });
        }

        public Task<bool> HasHttpServiceOnRuntimePortAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(PortHasService);
    }

    private sealed class FakeProcessLauncher : IAgerbotProcessLauncher
    {
        private readonly Action<ProcessStartInfo>? _onStart;
        public FakeManagedProcess? Process { get; private set; }
        public List<string> Devices { get; } = [];
        public List<string> Executables { get; } = [];
        public FakeProcessLauncher(Action<ProcessStartInfo>? onStart = null) => _onStart = onStart;
        public IAgerbotManagedProcess Start(ProcessStartInfo startInfo)
        {
            Process = new FakeManagedProcess();
            Devices.Add(startInfo.Environment["AGERBOT_DEVICE"] ?? string.Empty);
            Executables.Add(startInfo.FileName);
            _onStart?.Invoke(startInfo);
            return Process;
        }
    }

    private sealed class FakeManagedProcess : IAgerbotManagedProcess
    {
        public int Id => 42;
        public bool HasExited { get; private set; }
        public int? ExitCode => HasExited ? SimulatedExitCode ?? 0 : null;
        public DateTimeOffset StartedAt { get; } = DateTimeOffset.UtcNow;
        public bool WasKilled { get; private set; }
        public event EventHandler? Exited;
        public void KillEntireTree()
        {
            WasKilled = true;
            HasExited = true;
            Exited?.Invoke(this, EventArgs.Empty);
        }
        public void Crash(int exitCode)
        {
            HasExited = true;
            SimulatedExitCode = exitCode;
            Exited?.Invoke(this, EventArgs.Empty);
        }
        private int? SimulatedExitCode { get; set; }
        public void Dispose() { }
    }

    private sealed class FakeHttpHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, Task<HttpResponseMessage>> _handler;
        public List<string> Requests { get; } = [];
        public FakeHttpHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler) => _handler = handler;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add($"{request.Method.Method} {request.RequestUri?.AbsolutePath}");
            return _handler(request);
        }
    }

    private sealed class CallbackProgress : IProgress<double>
    {
        private readonly Action<double> _callback;
        public CallbackProgress(Action<double> callback) => _callback = callback;
        public void Report(double value) => _callback(value);
    }

    private sealed class ChunkedReadStream : MemoryStream
    {
        private readonly int _chunkSize;
        public ChunkedReadStream(byte[] buffer, int chunkSize) : base(buffer) => _chunkSize = chunkSize;

        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return base.ReadAsync(buffer[..Math.Min(buffer.Length, _chunkSize)], cancellationToken);
        }
    }

    private sealed class FakeGitHubTransport : IGitHubApiTransport
    {
        private readonly IReadOnlyDictionary<string, byte[]> _responses;
        public List<Uri> Requests { get; } = [];
        public FakeGitHubTransport(IReadOnlyDictionary<string, byte[]> responses) => _responses = responses;
        public Task<(byte[] Data, int StatusCode)> GetAsync(Uri uri, string accept, CancellationToken cancellationToken = default)
        {
            Requests.Add(uri);
            return Task.FromResult(_responses.TryGetValue(uri.AbsoluteUri, out var data)
                ? (data, 200)
                : (Array.Empty<byte>(), 404));
        }
    }

    private sealed class FixedRuntimeClientFactory : IAgerbotRuntimeClientFactory
    {
        private readonly IAgerbotRuntimeClient _client;
        public FixedRuntimeClientFactory(IAgerbotRuntimeClient client) => _client = client;
        public IAgerbotRuntimeClient Create(Uri baseUri) => _client;
    }

    private sealed class FakeModelRuntimeActivator : IAgerbotModelRuntimeActivator
    {
        public HashSet<string> FailedVersions { get; } = new(StringComparer.OrdinalIgnoreCase);
        public List<string> Activated { get; } = [];
        public bool WasDeactivated { get; private set; }

        public Task<bool> ActivateAsync(AgerbotCurrentModelRecord record, CancellationToken cancellationToken = default)
        {
            Activated.Add(record.ActiveVersion);
            return Task.FromResult(!FailedVersions.Contains(record.ActiveVersion));
        }

        public Task DeactivateAsync(CancellationToken cancellationToken = default)
        {
            WasDeactivated = true;
            return Task.CompletedTask;
        }
    }

    private sealed class FakeReadyProcessManager : IAgerbotProcessManager
    {
        public AgerbotRuntimeState State { get; } = new(
            AgerbotRuntimeStatus.Ready,
            "Listo · CPU",
            1,
            new AgerbotHealthResponse
            {
                Status = "ready",
                Model = new AgerbotModelIdentity { Loaded = true, Version = "0.2.0", Device = "cpu" }
            });
        public Task StartAsync(AgerbotSettings settings, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task StopAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
