using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using MISILNative.Core.Agerbot;
using MISILNative.Core.Distribution;
using MISILNative.Core.Diagnostics;
using MISILNative.Models;
using MISILNative.Services;

namespace MISILNative.ViewModels
{
    public class AppState : INotifyPropertyChanged
    {
        private readonly StorageCoordinator _storage;
        private readonly AgerbotRuntimeClient _agerbotRuntimeClient;
        private readonly AgerbotCapabilityService _agerbotCapabilityService;
        private readonly AgerbotRuntimeReleaseService _agerbotRuntimeReleaseService;
        private readonly VerifiedDownloadService _agerbotDownloads;
        private readonly AgerbotRuntimeInstallationManager _agerbotRuntimeInstaller;
        private readonly string _agerbotManagedRoot;
        private readonly string _misilUpdatesRoot;
        private readonly DiagnosticLogService _diagnostics;
        private CancellationTokenSource? _agerbotInstallCancellation;
        private AgerbotHardwareCapabilities? _agerbotHardware;
        private AgerbotStorageSnapshot? _agerbotStorageUsage;
        private bool _cudaRuntimeAvailable;
        private bool _isInstallingAgerbot;
        private double _agerbotInstallProgress;
        private string _agerbotInstallStatus = string.Empty;
        private bool _agerbotWasRunningBeforeSuspend;
        private AppConfiguration? _configuration;
        private StorageSnapshot _storageSnapshot = new(0, 0, 0);
        private SetupProgress _setupProgress = SetupProgress.Idle;
        private bool _isLoading = true;
        private bool _isPreparing;
        private AppRoute _currentRoute = AppRoute.Chats;
        private string? _presentationError;

        public event PropertyChangedEventHandler? PropertyChanged;

        public AppState(StorageCoordinator? storage = null)
        {
            _storage = storage ?? new StorageCoordinator();
            AgerbotSettingsStore = new AgerbotSettingsStore();
            _agerbotCapabilityService = new AgerbotCapabilityService();
            _agerbotRuntimeClient = new AgerbotRuntimeClient();
            _agerbotRuntimeReleaseService = new AgerbotRuntimeReleaseService();
            _agerbotDownloads = new VerifiedDownloadService();
            _agerbotManagedRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MISIL",
                "Agerbot");
            _agerbotRuntimeInstaller = new AgerbotRuntimeInstallationManager(
                _agerbotManagedRoot,
                _agerbotDownloads,
                new AgerbotStorageQuotaService(_agerbotManagedRoot),
                AgerbotSettingsStore);
            AgerbotProcessManager = new AgerbotProcessManager(_agerbotRuntimeClient);
            AgerbotActivationGate = new AgerbotActivationGate();
            AgerbotConversationStore = new AgerbotConversationStore(
                _agerbotRuntimeClient,
                AgerbotProcessManager,
                AgerbotSettingsStore,
                activationGate: AgerbotActivationGate);
            var currentStore = new AgerbotCurrentModelStore(Path.Combine(_agerbotManagedRoot, "current-model.json"));
            var failedStore = new AgerbotFailedVersionStore(Path.Combine(_agerbotManagedRoot, "update-state.json"));
            var activation = new AgerbotModelActivationService(AgerbotActivationGate, currentStore, failedStore);
            AgerbotModelUpdates = new AgerbotModelUpdateController(
                _agerbotManagedRoot,
                new AgerbotModelReleaseService(),
                new AgerbotModelDownloadService(
                    _agerbotManagedRoot,
                    _agerbotDownloads,
                    new AgerbotStorageQuotaService(_agerbotManagedRoot),
                    AgerbotSettingsStore),
                new AgerbotModelInstallationManager(_agerbotManagedRoot),
                new AgerbotCandidateValidator(),
                AgerbotSettingsStore,
                currentStore,
                failedStore,
                activation,
                new AgerbotManagedRuntimeActivator(AgerbotProcessManager, AgerbotSettingsStore));
            _misilUpdatesRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MISIL",
                "updates");
            Version appVersion = typeof(AppState).Assembly.GetName().Version ?? new Version(0, 3, 0);
            MisilUpdates = new MisilUpdateController(
                $"{appVersion.Major}.{appVersion.Minor}.{Math.Max(0, appVersion.Build)}",
                _misilUpdatesRoot);
            _diagnostics = new DiagnosticLogService(Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MISIL",
                "logs"));
            AgerbotProcessManager.PropertyChanged += (_, args) =>
            {
                if (args.PropertyName == nameof(AgerbotProcessManager.State))
                    _diagnostics.Write("agerbot.runtime", AgerbotProcessManager.State.Status.ToString());
            };
            AgerbotModelUpdates.PropertyChanged += (_, args) =>
            {
                if (args.PropertyName == nameof(AgerbotModelUpdateController.State))
                    _diagnostics.Write("agerbot.model-update", AgerbotModelUpdates.State.Status.ToString());
            };
            MisilUpdates.PropertyChanged += (_, args) =>
            {
                if (args.PropertyName == nameof(MisilUpdateController.State))
                    _diagnostics.Write("misil.update", MisilUpdates.State.Status.ToString());
            };
        }

        public AgerbotSettingsStore AgerbotSettingsStore { get; }
        public AgerbotProcessManager AgerbotProcessManager { get; }
        public AgerbotConversationStore AgerbotConversationStore { get; }
        public AgerbotActivationGate AgerbotActivationGate { get; }
        public AgerbotModelUpdateController AgerbotModelUpdates { get; }
        public MisilUpdateController MisilUpdates { get; }
        public string AgerbotInstallationFolder => _agerbotManagedRoot;
        public AgerbotStorageSnapshot? AgerbotStorageUsage
        {
            get => _agerbotStorageUsage;
            private set { _agerbotStorageUsage = value; OnPropertyChanged(); }
        }
        public AgerbotHardwareCapabilities? AgerbotHardware
        {
            get => _agerbotHardware;
            private set { _agerbotHardware = value; OnPropertyChanged(); OnPropertyChanged(nameof(AgerbotRecommendation)); }
        }
        public AgerbotHardwareRecommendation? AgerbotRecommendation => AgerbotHardware == null
            ? null
            : AgerbotHardwareRecommender.Recommend(AgerbotHardware, _cudaRuntimeAvailable);

        public bool IsInstallingAgerbot
        {
            get => _isInstallingAgerbot;
            private set { _isInstallingAgerbot = value; OnPropertyChanged(); }
        }

        public double AgerbotInstallProgress
        {
            get => _agerbotInstallProgress;
            private set { _agerbotInstallProgress = value; OnPropertyChanged(); }
        }

        public string AgerbotInstallStatus
        {
            get => _agerbotInstallStatus;
            private set { _agerbotInstallStatus = value; OnPropertyChanged(); }
        }

        public AppConfiguration? Configuration
        {
            get => _configuration;
            private set
            {
                _configuration = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(HasCompletedOnboarding));
                OnPropertyChanged(nameof(SharesStorage));
            }
        }

        public StorageSnapshot StorageSnapshot
        {
            get => _storageSnapshot;
            private set { _storageSnapshot = value; OnPropertyChanged(); }
        }

        public SetupProgress SetupProgress
        {
            get => _setupProgress;
            private set { _setupProgress = value; OnPropertyChanged(); }
        }

        public bool IsLoading
        {
            get => _isLoading;
            private set { _isLoading = value; OnPropertyChanged(); }
        }

        public bool IsPreparing
        {
            get => _isPreparing;
            private set { _isPreparing = value; OnPropertyChanged(); }
        }

        public AppRoute CurrentRoute
        {
            get => _currentRoute;
            set { _currentRoute = value; OnPropertyChanged(); }
        }

        public string? PresentationError
        {
            get => _presentationError;
            set { _presentationError = value; OnPropertyChanged(); }
        }

        public bool HasCompletedOnboarding => Configuration?.OnboardingCompleted == true;

        public bool SharesStorage => Configuration?.SharesStorage == true;

        public async Task LoadAsync()
        {
            Configuration = _storage.LoadConfiguration();
            StorageSnapshot = _storage.Snapshot(Configuration);
            AgerbotHardware = await _agerbotCapabilityService.DetectAsync();
            _cudaRuntimeAvailable = File.Exists(AgerbotSettingsStore.Settings.CudaRuntimeExecutablePath);
            OnPropertyChanged(nameof(AgerbotRecommendation));
            RefreshAgerbotStorageUsage();
            await DiscoverInstalledAgerbotModelAsync();
            IsLoading = false;
            if (AgerbotSettingsStore.Settings.StartWithMisil)
            {
                try { await AgerbotProcessManager.StartAsync(AgerbotSettingsStore.Settings); }
                catch (OperationCanceledException) { }
            }
            if (!string.IsNullOrWhiteSpace(AgerbotSettingsStore.Settings.RuntimeVersion)
                && AgerbotSettingsStore.Settings.AutomaticModelUpdates)
            {
                _ = AgerbotModelUpdates.CheckForUpdatesAsync(
                    force: false,
                    installAutomatically: true,
                    diskAvailableBytes: AgerbotHardware.DiskAvailableBytes);
            }
            _ = MisilUpdates.CheckAsync(
                allowPrerelease: false,
                windowsVersion: Environment.OSVersion.Version);
        }

        public ulong AvailableDiskBytes()
        {
            return _storage.DiskAvailableBytes();
        }

        public async Task<bool> FinishOnboardingAsync(bool sharesStorage, int quotaGiB = 0)
        {
            IsPreparing = true;
            PresentationError = null;

            try
            {
                var config = await _storage.PrepareAsync(
                    sharesStorage,
                    quotaGiB,
                    async (progress) =>
                    {
                        SetupProgress = progress;
                        await Task.Delay(200);
                    }
                );

                Configuration = config;
                StorageSnapshot = _storage.Snapshot(config);
                await Task.Delay(350);

                IsPreparing = false;
                CurrentRoute = sharesStorage ? AppRoute.Dashboard : AppRoute.Chats;
                return true;
            }
            catch (Exception ex)
            {
                IsPreparing = false;
                PresentationError = ex.Message;
                return false;
            }
        }

        public Task RefreshStorageAsync()
        {
            StorageSnapshot = _storage.Snapshot(Configuration);
            return Task.CompletedTask;
        }

        public async Task InstallAgerbotRuntimeAsync()
        {
            if (IsInstallingAgerbot || AgerbotHardware == null) return;
            _agerbotInstallCancellation = new CancellationTokenSource();
            IsInstallingAgerbot = true;
            AgerbotInstallProgress = 0;
            AgerbotInstallStatus = "Buscando un runtime estable para Windows…";
            try
            {
                string? accelerationWarning = null;
                bool runtimeMissing = !File.Exists(AgerbotSettingsStore.Settings.RuntimeExecutablePath);
                AgerbotRemoteRuntimeCandidate? candidate = null;
                try
                {
                    int windowsBuild = Environment.OSVersion.Version.Build;
                    candidate = await _agerbotRuntimeReleaseService.LatestCompatibleAsync(
                        installedVersion: runtimeMissing ? null : AgerbotSettingsStore.Settings.RuntimeVersion,
                        allowPrerelease: false,
                        windowsBuild: windowsBuild,
                        cancellationToken: _agerbotInstallCancellation.Token);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception exception) when (!runtimeMissing)
                {
                    candidate = null;
                    accelerationWarning = $"No se cambió el runtime ({exception.Message}).";
                }
                if (candidate != null)
                {
                    _cudaRuntimeAvailable = candidate.Packages.ContainsKey(AgerbotRuntimeVariant.Cuda);
                    OnPropertyChanged(nameof(AgerbotRecommendation));
                    var recommendation = AgerbotHardwareRecommender.Recommend(AgerbotHardware, _cudaRuntimeAvailable);
                    var cpu = candidate.Packages[AgerbotRuntimeVariant.Cpu];
                    AgerbotInstallStatus = "Descargando runtime CPU de respaldo…";
                    var cpuProgress = new Progress<double>(value =>
                    {
                        AgerbotInstallProgress = value * 0.2;
                        AgerbotInstallStatus = $"Descargando runtime CPU… {value:P0}";
                    });
                    await _agerbotRuntimeInstaller.InstallAsync(
                        candidate.Manifest,
                        cpu.Package,
                        cpu.Url,
                        AgerbotHardware.DiskAvailableBytes,
                        candidateModelBytes: 0,
                        progress: cpuProgress,
                        cancellationToken: _agerbotInstallCancellation.Token);
                    if (recommendation.Variant == AgerbotRuntimeVariant.Cuda
                        && candidate.Packages.TryGetValue(AgerbotRuntimeVariant.Cuda, out var cuda))
                    {
                        try
                        {
                            AgerbotInstallStatus = "Descargando aceleración CUDA…";
                            var cudaProgress = new Progress<double>(value =>
                            {
                                AgerbotInstallProgress = 0.2 + value * 0.2;
                                AgerbotInstallStatus = $"Descargando runtime CUDA… {value:P0}";
                            });
                            await _agerbotRuntimeInstaller.InstallAsync(
                                candidate.Manifest,
                                cuda.Package,
                                cuda.Url,
                                AgerbotHardware.DiskAvailableBytes,
                                candidateModelBytes: 0,
                                progress: cudaProgress,
                                cancellationToken: _agerbotInstallCancellation.Token);
                        }
                        catch (OperationCanceledException) { throw; }
                        catch (Exception exception)
                        {
                            _cudaRuntimeAvailable = false;
                            accelerationWarning = $"CUDA no pudo instalarse ({exception.Message}). Se usará CPU.";
                            AgerbotSettingsStore.Update(settings =>
                            {
                                settings.RuntimeExecutablePath = settings.CpuRuntimeExecutablePath;
                                settings.RequestedDevice = "cpu";
                            });
                            OnPropertyChanged(nameof(AgerbotRecommendation));
                        }
                    }
                    if (!runtimeMissing
                        && !string.IsNullOrWhiteSpace(AgerbotSettingsStore.Settings.CheckpointPath)
                        && !string.IsNullOrWhiteSpace(AgerbotSettingsStore.Settings.ActiveModelVersion))
                    {
                        var validator = new AgerbotCandidateValidator();
                        bool runtimeValid = await validator.ValidateAsync(
                            AgerbotSettingsStore.Settings.RuntimeExecutablePath,
                            AgerbotSettingsStore.Settings.CheckpointPath,
                            AgerbotSettingsStore.Settings.ActiveModelVersion,
                            AgerbotSettingsStore.Settings.RequestedDevice,
                            _agerbotInstallCancellation.Token);
                        if (!runtimeValid
                            && !string.IsNullOrWhiteSpace(AgerbotSettingsStore.Settings.CpuRuntimeExecutablePath))
                        {
                            runtimeValid = await validator.ValidateAsync(
                                AgerbotSettingsStore.Settings.CpuRuntimeExecutablePath,
                                AgerbotSettingsStore.Settings.CheckpointPath,
                                AgerbotSettingsStore.Settings.ActiveModelVersion,
                                "cpu",
                                _agerbotInstallCancellation.Token);
                        }
                        if (!runtimeValid && _agerbotRuntimeInstaller.RollbackRuntime())
                        {
                            _cudaRuntimeAvailable = File.Exists(AgerbotSettingsStore.Settings.CudaRuntimeExecutablePath);
                            accelerationWarning = "El runtime nuevo falló la validación y MISIL restauró el anterior.";
                            OnPropertyChanged(nameof(AgerbotRecommendation));
                        }
                    }
                }
                AgerbotInstallStatus = "Buscando el modelo Agerbot compatible…";
                await AgerbotModelUpdates.CheckForUpdatesAsync(
                    force: true,
                    installAutomatically: false,
                    diskAvailableBytes: AgerbotHardware.DiskAvailableBytes,
                    cancellationToken: _agerbotInstallCancellation.Token);
                if (AgerbotModelUpdates.HasAvailableUpdate)
                    await AgerbotModelUpdates.InstallAvailableAsync(AgerbotHardware.DiskAvailableBytes, _agerbotInstallCancellation.Token);
                if (AgerbotModelUpdates.State.Status == AgerbotModelUpdateStatus.Installed)
                {
                    AgerbotInstallProgress = 1;
                    AgerbotInstallStatus = accelerationWarning == null
                        ? AgerbotModelUpdates.State.Detail
                        : $"{AgerbotModelUpdates.State.Detail} {accelerationWarning}";
                }
                else
                {
                    AgerbotInstallStatus = accelerationWarning == null
                        ? AgerbotModelUpdates.State.Detail
                        : $"{AgerbotModelUpdates.State.Detail} {accelerationWarning}";
                }
                RefreshAgerbotStorageUsage();
            }
            catch (OperationCanceledException)
            {
                AgerbotInstallStatus = "Instalación cancelada; la descarga parcial se conservará para reanudarla.";
            }
            catch (Exception exception)
            {
                AgerbotInstallStatus = exception.Message;
            }
            finally
            {
                IsInstallingAgerbot = false;
                _agerbotInstallCancellation.Dispose();
                _agerbotInstallCancellation = null;
            }
        }

        public void CancelAgerbotInstallation() => _agerbotInstallCancellation?.Cancel();

        public async Task UninstallAgerbotAsync()
        {
            CancelAgerbotInstallation();
            await AgerbotConversationStore.CancelAsync();
            await AgerbotProcessManager.StopAsync();
            _agerbotRuntimeInstaller.UninstallRuntimeAndModels();
            _cudaRuntimeAvailable = false;
            AgerbotInstallProgress = 0;
            AgerbotInstallStatus = "Agerbot se desinstaló; la conversación local se conservó.";
            RefreshAgerbotStorageUsage();
            OnPropertyChanged(nameof(AgerbotRecommendation));
        }

        public void NotifySystemSuspending() => _agerbotWasRunningBeforeSuspend = AgerbotProcessManager.State.IsReady;

        public async Task RecoverAfterSystemResumeAsync()
        {
            if (!_agerbotWasRunningBeforeSuspend && !AgerbotSettingsStore.Settings.StartWithMisil) return;
            _agerbotWasRunningBeforeSuspend = false;
            try { await AgerbotProcessManager.StartAsync(AgerbotSettingsStore.Settings); }
            catch (OperationCanceledException) { }
        }

        public int LaunchMisilUpdateInstaller()
        {
            if (AgerbotConversationStore.IsGenerating)
                throw new InvalidOperationException("Cancela o espera la respuesta activa antes de actualizar MISIL.");
            string relaunch = Environment.ProcessPath
                ?? throw new InvalidOperationException("MISIL no pudo determinar su ejecutable instalado.");
            string installDirectory = AppContext.BaseDirectory;
            string updater = Path.Combine(installDirectory, "MISIL.Updater.exe");
            var plan = MisilUpdates.CreateLaunchPlan(Environment.ProcessId, installDirectory, relaunch);
            return MisilExternalUpdaterLauncher.Launch(updater, _misilUpdatesRoot, plan);
        }

        public void RefreshAgerbotStorageUsage()
        {
            ulong available = AgerbotHardware?.DiskAvailableBytes ?? _storage.DiskAvailableBytes();
            AgerbotStorageUsage = new AgerbotStorageQuotaService(_agerbotManagedRoot)
                .Snapshot(AgerbotSettingsStore.Settings.StorageQuotaBytes, available);
        }

        private async Task DiscoverInstalledAgerbotModelAsync()
        {
            string? runtimeVersion = AgerbotSettingsStore.Settings.RuntimeVersion;
            if (string.IsNullOrWhiteSpace(runtimeVersion)) return;
            var discovery = new AgerbotModelDiscoveryService(runtimeVersion);
            var candidates = await discovery.DiscoverAsync(_agerbotManagedRoot);
            var selected = discovery.Select(
                candidates,
                AgerbotSettingsStore.Settings.PinnedModelVersion,
                AgerbotSettingsStore.Settings.AutomaticModelUpdates,
                AgerbotSettingsStore.Settings.AllowPrereleaseModels);
            if (selected == null) return;
            if (!File.Exists(AgerbotSettingsStore.Settings.CheckpointPath))
            {
                AgerbotSettingsStore.Update(settings =>
                {
                    settings.CheckpointPath = selected.CheckpointPath;
                    settings.ActiveModelVersion = selected.Manifest.Model.Version;
                });
            }
        }

        public Task ResetOnboardingForTestingAsync()
        {
            _storage.ResetConfiguration();
            Configuration = null;
            StorageSnapshot = new StorageSnapshot(0, 0, _storage.DiskAvailableBytes());
            SetupProgress = SetupProgress.Idle;
            CurrentRoute = AppRoute.Chats;
            return Task.CompletedTask;
        }

        public async Task ShutdownAsync()
        {
            CancelAgerbotInstallation();
            AgerbotModelUpdates.Cancel();
            MisilUpdates.Cancel();
            for (int attempt = 0; IsInstallingAgerbot && attempt < 100; attempt++)
                await Task.Delay(50);
            for (int attempt = 0; AgerbotModelUpdates.IsBusy && attempt < 100; attempt++)
                await Task.Delay(50);
            for (int attempt = 0; MisilUpdates.IsBusy && attempt < 100; attempt++)
                await Task.Delay(50);
            await AgerbotConversationStore.CancelAsync();
            await AgerbotProcessManager.StopAsync();
            AgerbotModelUpdates.Dispose();
            MisilUpdates.Dispose();
            _agerbotDownloads.Dispose();
            _agerbotRuntimeReleaseService.Dispose();
            _agerbotRuntimeClient.Dispose();
        }

        protected void OnPropertyChanged([CallerMemberName] string? name = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }
    }
}
