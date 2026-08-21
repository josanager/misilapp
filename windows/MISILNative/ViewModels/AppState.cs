using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using MISILNative.Models;
using MISILNative.Services;

namespace MISILNative.ViewModels
{
    public class AppState : INotifyPropertyChanged
    {
        private readonly StorageCoordinator _storage;
        private readonly NetworkPresenceService _network;
        private AppConfiguration? _configuration;
        private StorageSnapshot _storageSnapshot = new(0, 0, 0);
        private NetworkCapacitySnapshot _networkSnapshot = NetworkCapacitySnapshot.Empty;
        private NetworkConnectionStatus _networkStatus = NetworkConnectionStatus.Connecting;
        private DateTime? _lastNetworkUpdate;
        private string? _networkError;
        private SetupProgress _setupProgress = SetupProgress.Idle;
        private bool _isLoading = true;
        private bool _isPreparing;
        private AppRoute _currentRoute = AppRoute.Chats;
        private string? _presentationError;
        private CancellationTokenSource? _networkCancellation;
        private Task? _networkLoop;

        public event PropertyChangedEventHandler? PropertyChanged;

        public AppState(StorageCoordinator? storage = null, NetworkPresenceService? network = null)
        {
            _storage = storage ?? new StorageCoordinator();
            _network = network ?? new NetworkPresenceService();
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

        public NetworkCapacitySnapshot NetworkSnapshot
        {
            get => _networkSnapshot;
            private set { _networkSnapshot = value; OnPropertyChanged(); }
        }

        public NetworkConnectionStatus NetworkStatus
        {
            get => _networkStatus;
            private set { _networkStatus = value; OnPropertyChanged(); }
        }

        public DateTime? LastNetworkUpdate
        {
            get => _lastNetworkUpdate;
            private set { _lastNetworkUpdate = value; OnPropertyChanged(); }
        }

        public string? NetworkError
        {
            get => _networkError;
            private set { _networkError = value; OnPropertyChanged(); }
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
            IsLoading = false;
            await RestartNetworkSyncAsync();
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
                await RestartNetworkSyncAsync();
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

        public async Task ResetOnboardingForTestingAsync()
        {
            await StopNetworkSyncAsync(sendOffline: true);
            _storage.ResetConfiguration();
            Configuration = null;
            StorageSnapshot = new StorageSnapshot(0, 0, _storage.DiskAvailableBytes());
            NetworkSnapshot = NetworkCapacitySnapshot.Empty;
            NetworkStatus = NetworkConnectionStatus.Offline;
            SetupProgress = SetupProgress.Idle;
            CurrentRoute = AppRoute.Chats;
        }

        public async Task ShutdownAsync()
        {
            await StopNetworkSyncAsync(sendOffline: true);
        }

        private async Task RestartNetworkSyncAsync()
        {
            await StopNetworkSyncAsync(sendOffline: false);
            _networkCancellation = new CancellationTokenSource();
            _networkLoop = RunNetworkLoopAsync(_networkCancellation.Token);
        }

        private async Task StopNetworkSyncAsync(bool sendOffline)
        {
            var cancellation = _networkCancellation;
            var loop = _networkLoop;
            _networkCancellation = null;
            _networkLoop = null;

            cancellation?.Cancel();
            if (loop != null)
            {
                try { await loop; }
                catch (OperationCanceledException) { }
            }
            cancellation?.Dispose();

            if (sendOffline && SharesStorage)
            {
                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                try
                {
                    await _network.GoOfflineAsync(NetworkBaseUrl, timeout.Token);
                }
                catch { }
            }
        }

        private async Task RunNetworkLoopAsync(CancellationToken cancellationToken)
        {
            int delaySeconds = 5;
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    var configuration = Configuration;
                    var localSnapshot = _storage.Snapshot(configuration);
                    NetworkCapacitySnapshot networkSnapshot;

                    RunOnUiThread(() =>
                    {
                        StorageSnapshot = localSnapshot;
                        if (!LastNetworkUpdate.HasValue || NetworkStatus == NetworkConnectionStatus.Offline)
                        {
                            NetworkStatus = NetworkConnectionStatus.Connecting;
                        }
                    });

                    if (configuration?.SharesStorage == true)
                    {
                        networkSnapshot = await _network.HeartbeatAsync(
                            NetworkBaseUrl,
                            localSnapshot,
                            _storage.IsStorageHealthy(configuration),
                            cancellationToken
                        );
                    }
                    else
                    {
                        networkSnapshot = await _network.FetchCapacityAsync(NetworkBaseUrl, cancellationToken);
                    }

                    delaySeconds = Math.Clamp(networkSnapshot.HeartbeatIntervalSeconds, 5, 30);
                    RunOnUiThread(() =>
                    {
                        NetworkSnapshot = networkSnapshot;
                        NetworkStatus = NetworkConnectionStatus.Online;
                        LastNetworkUpdate = DateTime.Now;
                        NetworkError = null;
                    });
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    delaySeconds = 5;
                    RunOnUiThread(() =>
                    {
                        NetworkStatus = NetworkConnectionStatus.Offline;
                        NetworkError = ex.Message;
                    });
                }

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(delaySeconds), cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        private string NetworkBaseUrl => Configuration?.NetworkBaseUrl ?? NetworkPresenceService.DefaultBaseUrl;

        private static void RunOnUiThread(Action action)
        {
            var dispatcher = Application.Current?.Dispatcher;
            if (dispatcher != null && !dispatcher.CheckAccess())
            {
                dispatcher.BeginInvoke(action);
                return;
            }
            action();
        }

        protected void OnPropertyChanged([CallerMemberName] string? name = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }
    }
}
