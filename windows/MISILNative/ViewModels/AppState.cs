using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using MISILNative.Models;
using MISILNative.Services;

namespace MISILNative.ViewModels
{
    public class AppState : INotifyPropertyChanged
    {
        private readonly StorageCoordinator _storage;
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
            IsLoading = false;
            await Task.CompletedTask;
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

        public async Task RefreshStorageAsync()
        {
            StorageSnapshot = _storage.Snapshot(Configuration);
            await Task.CompletedTask;
        }

        public async Task ResetOnboardingForTestingAsync()
        {
            _storage.ResetConfiguration();
            Configuration = null;
            StorageSnapshot = new StorageSnapshot(0, 0, _storage.DiskAvailableBytes());
            SetupProgress = SetupProgress.Idle;
            CurrentRoute = AppRoute.Chats;
            await Task.CompletedTask;
        }

        protected void OnPropertyChanged([CallerMemberName] string? name = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }
    }
}
