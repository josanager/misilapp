using System.Windows;
using System.Windows.Controls;
using System.ComponentModel;
using MISILNative.Models;
using MISILNative.ViewModels;
using MISILNative.Services;
using System;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows.Media;
using MISILNative.Core.Agerbot;

namespace MISILNative.Views
{
    public partial class SettingsView : UserControl
    {
        private AppState? _appState;

        public SettingsView()
        {
            InitializeComponent();
            Loaded += OnLoaded;
            Unloaded += OnUnloaded;
        }

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (DataContext is AppState state)
            {
                _appState = state;
                _appState.PropertyChanged -= OnAppStateChanged;
                _appState.PropertyChanged += OnAppStateChanged;
                _appState.AgerbotProcessManager.PropertyChanged -= OnAgerbotProcessChanged;
                _appState.AgerbotProcessManager.PropertyChanged += OnAgerbotProcessChanged;
                _appState.AgerbotModelUpdates.PropertyChanged -= OnAgerbotModelUpdateChanged;
                _appState.AgerbotModelUpdates.PropertyChanged += OnAgerbotModelUpdateChanged;
                _appState.MisilUpdates.PropertyChanged -= OnMisilUpdateChanged;
                _appState.MisilUpdates.PropertyChanged += OnMisilUpdateChanged;
                var identity = MessagingIdentityStore.LoadOrCreate();
                TxtMessagingUsername.Text = identity.Username;
                TxtHubUrl.Text = identity.HubUrl;
                UpdateUI();
            }
        }

        private void OnSaveHubClick(object sender, RoutedEventArgs e)
        {
            string username = TxtMessagingUsername.Text.Trim().ToLowerInvariant();
            string hubUrl = TxtHubUrl.Text.Trim();
            if (!Regex.IsMatch(username, "^[a-z0-9][a-z0-9_-]{2,31}$"))
            {
                TxtHubSaveStatus.Text = "El usuario debe tener entre 3 y 32 caracteres.";
                return;
            }
            if (!Uri.TryCreate(hubUrl, UriKind.Absolute, out var uri) || (uri.Scheme != "ws" && uri.Scheme != "wss"))
            {
                TxtHubSaveStatus.Text = "La dirección debe comenzar por ws:// o wss://.";
                return;
            }
            var identity = MessagingIdentityStore.LoadOrCreate();
            identity.Username = username;
            identity.HubUrl = hubUrl;
            MessagingIdentityStore.Save(identity);
            TxtHubSaveStatus.Text = "Guardado. Reinicia MISIL para conectar con este Hub.";
        }

        private void OnUnloaded(object sender, RoutedEventArgs e)
        {
            if (_appState != null)
            {
                _appState.PropertyChanged -= OnAppStateChanged;
                _appState.AgerbotProcessManager.PropertyChanged -= OnAgerbotProcessChanged;
                _appState.AgerbotModelUpdates.PropertyChanged -= OnAgerbotModelUpdateChanged;
                _appState.MisilUpdates.PropertyChanged -= OnMisilUpdateChanged;
            }
        }

        private void OnAgerbotProcessChanged(object? sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(AgerbotProcessManager.State)) Dispatcher.Invoke(UpdateAgerbotUI);
        }

        private void OnAgerbotModelUpdateChanged(object? sender, PropertyChangedEventArgs e) => Dispatcher.Invoke(UpdateAgerbotUI);

        private void OnMisilUpdateChanged(object? sender, PropertyChangedEventArgs e) => Dispatcher.Invoke(UpdateMisilUpdateUI);

        private void OnAppStateChanged(object? sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName is nameof(AppState.StorageSnapshot)
                or nameof(AppState.Configuration)
                or nameof(AppState.AgerbotHardware)
                or nameof(AppState.AgerbotRecommendation)
                or nameof(AppState.IsInstallingAgerbot)
                or nameof(AppState.AgerbotInstallProgress)
                or nameof(AppState.AgerbotInstallStatus)
                or nameof(AppState.AgerbotStorageUsage))
            {
                Dispatcher.Invoke(UpdateUI);
            }
        }

        private void UpdateUI()
        {
            if (_appState == null) return;

            if (_appState.SharesStorage)
            {
                TxtQuotaStatus.Text = $"{FormatUtils.FormatByteSize(_appState.StorageSnapshot.QuotaBytes)} aportados";
                BtnChangeQuota.Content = "Cambiar";
            }
            else
            {
                TxtQuotaStatus.Text = "No estás compartiendo espacio";
                BtnChangeQuota.Content = "Configurar";
            }
            UpdateAgerbotUI();
            UpdateMisilUpdateUI();
        }

        private void UpdateMisilUpdateUI()
        {
            if (_appState == null) return;
            var state = _appState.MisilUpdates.State;
            TxtMisilInstalledVersion.Text = _appState.MisilUpdates.InstalledVersion;
            TxtMisilAvailableVersion.Text = state.AvailableVersion ?? "Ninguna";
            TxtMisilUpdateSize.Text = state.SizeBytes is ulong size ? FormatUtils.FormatByteSize(size) : "—";
            TxtMisilUpdateStatus.Text = state.Detail;
            TxtMisilReleaseNotes.Text = _appState.MisilUpdates.ReleaseNotes;
            TxtMisilReleaseNotes.Visibility = string.IsNullOrWhiteSpace(_appState.MisilUpdates.ReleaseNotes)
                ? Visibility.Collapsed
                : Visibility.Visible;
            MisilUpdateProgress.Visibility = state.Status == MISILNative.Core.Distribution.MisilUpdateStatus.Downloading
                ? Visibility.Visible
                : Visibility.Collapsed;
            MisilUpdateProgress.Value = state.Progress;
            BtnCheckMisilUpdate.IsEnabled = !_appState.MisilUpdates.IsBusy;
            BtnDownloadMisilUpdate.IsEnabled = state.Status == MISILNative.Core.Distribution.MisilUpdateStatus.Available;
            BtnCancelMisilUpdate.IsEnabled = _appState.MisilUpdates.IsBusy;
            BtnInstallMisilUpdate.IsEnabled = state.Status == MISILNative.Core.Distribution.MisilUpdateStatus.ReadyToInstall
                && !_appState.AgerbotConversationStore.IsGenerating;
        }

        private void UpdateAgerbotUI()
        {
            if (_appState == null) return;
            var state = _appState.AgerbotProcessManager.State;
            var health = state.Health;
            AgerbotSettingsStatusDot.Fill = (SolidColorBrush)FindResource(state.Status switch
            {
                AgerbotRuntimeStatus.Ready => "BrushSuccess",
                AgerbotRuntimeStatus.Starting or AgerbotRuntimeStatus.Loading or AgerbotRuntimeStatus.Stopping => "BrushAccent",
                AgerbotRuntimeStatus.Failed or AgerbotRuntimeStatus.PortConflict or AgerbotRuntimeStatus.Unavailable => "BrushDanger",
                _ => "BrushTextMuted"
            });
            TxtAgerbotStatus.Text = state.Status switch
            {
                AgerbotRuntimeStatus.Ready => $"LISTO · {health?.Model.Device.ToUpperInvariant()}",
                AgerbotRuntimeStatus.Starting => "INICIANDO",
                AgerbotRuntimeStatus.Loading => "VERIFICANDO",
                AgerbotRuntimeStatus.Stopping => "DETENIENDO",
                AgerbotRuntimeStatus.PortConflict => "PUERTO OCUPADO",
                AgerbotRuntimeStatus.Failed => "ERROR",
                AgerbotRuntimeStatus.Unavailable => "NO DISPONIBLE",
                AgerbotRuntimeStatus.Stopped => "DETENIDO",
                _ when !string.IsNullOrWhiteSpace(_appState.AgerbotSettingsStore.Settings.RuntimeExecutablePath) => "RUNTIME INSTALADO · SIN MODELO",
                _ => "NO INSTALADO"
            };
            TxtAgerbotRuntimeVersion.Text = health?.RuntimeVersion ?? _appState.AgerbotSettingsStore.Settings.RuntimeVersion ?? "No disponible";
            TxtAgerbotModelVersion.Text = health?.Model.Version ?? _appState.AgerbotSettingsStore.Settings.ActiveModelVersion ?? "Ninguno";
            TxtAgerbotPreviousVersion.Text = _appState.AgerbotSettingsStore.Settings.PreviousModelVersion ?? "Ninguna";
            TxtAgerbotTokenizer.Text = health?.Model.Tokenizer ?? "—";
            TxtAgerbotParameters.Text = (health?.Model.ParameterCount ?? health?.Model.Parameters)?.ToString("N0") ?? "—";
            TxtAgerbotContext.Text = health?.Model.ContextLength?.ToString() ?? "—";
            TxtAgerbotDevice.Text = health?.Model.Device.ToUpperInvariant() ?? "—";
            var hardware = _appState.AgerbotHardware;
            TxtAgerbotWindows.Text = hardware?.WindowsVersion ?? "Detectando…";
            TxtAgerbotArchitecture.Text = hardware?.Architecture.ToUpperInvariant() ?? "—";
            TxtAgerbotCpu.Text = hardware == null ? "Detectando…" : $"{hardware.CpuName} · {hardware.LogicalCores} hilos";
            TxtAgerbotRam.Text = hardware == null ? "—" : FormatUtils.FormatByteSize(hardware.TotalMemoryBytes);
            TxtAgerbotGpu.Text = hardware?.GpuName ?? "No se detectó NVIDIA compatible";
            TxtAgerbotVram.Text = hardware?.VramBytes is ulong vram ? FormatUtils.FormatByteSize(vram) : "—";
            TxtAgerbotDirectMl.Text = hardware?.DirectMlSystemLibraryAvailable == true
                ? "Disponible · runtime aún no publicado"
                : "No detectado";
            TxtAgerbotDisk.Text = hardware == null ? "—" : FormatUtils.FormatByteSize(hardware.DiskAvailableBytes);
            var storage = _appState.AgerbotStorageUsage;
            TxtAgerbotUsed.Text = storage == null ? "—" : FormatUtils.FormatByteSize(storage.UsedBytes);
            TxtAgerbotQuotaAvailable.Text = storage == null ? "—" : FormatUtils.FormatByteSize(storage.AvailableWithinQuota);
            TxtAgerbotFolder.Text = _appState.AgerbotInstallationFolder;
            TxtAgerbotFolder.ToolTip = _appState.AgerbotInstallationFolder;
            TxtAgerbotRecommendation.Text = _appState.AgerbotRecommendation?.Summary ?? "Calculando recomendación…";
            if (!AgerbotQuotaPicker.IsKeyboardFocusWithin)
            {
                ulong quotaGiB = Math.Max(1, _appState.AgerbotSettingsStore.Settings.StorageQuotaBytes / AgerbotStorageQuotaService.BytesPerGiB);
                AgerbotQuotaPicker.Text = quotaGiB.ToString();
            }
            ChkStartAgerbot.IsChecked = _appState.AgerbotSettingsStore.Settings.StartWithMisil;
            ChkAutomaticModelUpdates.IsChecked = _appState.AgerbotSettingsStore.Settings.AutomaticModelUpdates;
            bool installed = !string.IsNullOrWhiteSpace(_appState.AgerbotSettingsStore.Settings.RuntimeExecutablePath);
            bool installing = _appState.IsInstallingAgerbot;
            BtnInstallAgerbot.IsEnabled = !installing;
            BtnInstallAgerbot.Content = installed ? "Actualizar Agerbot" : "Instalar Agerbot";
            BtnCancelAgerbotInstall.Visibility = installing ? Visibility.Visible : Visibility.Collapsed;
            AgerbotInstallProgress.Visibility = installing ? Visibility.Visible : Visibility.Collapsed;
            AgerbotInstallProgress.Value = _appState.AgerbotInstallProgress;
            TxtAgerbotInstallStatus.Text = _appState.AgerbotInstallStatus;
            TxtAgerbotInstallStatus.Visibility = string.IsNullOrWhiteSpace(_appState.AgerbotInstallStatus) ? Visibility.Collapsed : Visibility.Visible;
            var update = _appState.AgerbotModelUpdates.State;
            TxtAgerbotModelUpdateStatus.Text = update.Detail;
            bool modelProgressVisible = update.Status is AgerbotModelUpdateStatus.Downloading
                or AgerbotModelUpdateStatus.Verifying
                or AgerbotModelUpdateStatus.Activating
                or AgerbotModelUpdateStatus.WaitingForConversation;
            AgerbotModelUpdateProgress.Visibility = modelProgressVisible ? Visibility.Visible : Visibility.Collapsed;
            AgerbotModelUpdateProgress.IsIndeterminate = modelProgressVisible && update.Status != AgerbotModelUpdateStatus.Downloading;
            AgerbotModelUpdateProgress.Value = update.Progress;
            BtnUninstallAgerbot.IsEnabled = installed && !installing;
            bool hasModel = File.Exists(_appState.AgerbotSettingsStore.Settings.CheckpointPath);
            BtnStartAgerbot.IsEnabled = installed && hasModel && !installing && state.Status is not AgerbotRuntimeStatus.Ready and not AgerbotRuntimeStatus.Starting and not AgerbotRuntimeStatus.Loading;
            BtnStopAgerbot.IsEnabled = state.Status is AgerbotRuntimeStatus.Ready or AgerbotRuntimeStatus.Starting or AgerbotRuntimeStatus.Loading;
            bool modelBusy = _appState.AgerbotModelUpdates.IsBusy;
            BtnCheckAgerbotUpdates.IsEnabled = installed && !modelBusy && !installing;
            BtnUpdateAgerbotModel.IsEnabled = _appState.AgerbotModelUpdates.HasAvailableUpdate && !modelBusy && !installing;
            BtnCancelModelUpdate.IsEnabled = modelBusy;
            BtnRollbackAgerbot.IsEnabled = !string.IsNullOrWhiteSpace(_appState.AgerbotSettingsStore.Settings.PreviousModelVersion) && !modelBusy && !installing;
            BtnRepairAgerbot.IsEnabled = installed && hasModel && !modelBusy && !installing;
            bool runtimeError = state.Status is AgerbotRuntimeStatus.Failed or AgerbotRuntimeStatus.PortConflict or AgerbotRuntimeStatus.Unavailable;
            bool modelError = update.Status == AgerbotModelUpdateStatus.Failed;
            bool error = runtimeError || modelError;
            TxtAgerbotError.Text = runtimeError ? state.Detail : modelError ? update.Detail : string.Empty;
            TxtAgerbotError.Visibility = error ? Visibility.Visible : Visibility.Collapsed;
        }

        private async void OnInstallAgerbotClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            await _appState.InstallAgerbotRuntimeAsync();
            UpdateAgerbotUI();
        }

        private void OnCancelAgerbotInstallClick(object sender, RoutedEventArgs e) => _appState?.CancelAgerbotInstallation();

        private async void OnUninstallAgerbotClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            var result = MessageBox.Show(
                "Se eliminarán el runtime y los modelos administrados por MISIL. La conversación local se conservará. ¿Continuar?",
                "Desinstalar Agerbot",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);
            if (result != MessageBoxResult.Yes) return;
            await _appState.UninstallAgerbotAsync();
            UpdateAgerbotUI();
        }

        private async void OnStartAgerbotClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            await _appState.AgerbotProcessManager.StartAsync(_appState.AgerbotSettingsStore.Settings);
            UpdateAgerbotUI();
        }

        private async void OnStopAgerbotClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            await _appState.AgerbotConversationStore.CancelAsync();
            await _appState.AgerbotProcessManager.StopAsync();
            UpdateAgerbotUI();
        }

        private void OnStartAgerbotSettingChanged(object sender, RoutedEventArgs e)
        {
            if (_appState == null || ChkStartAgerbot.IsChecked == null) return;
            _appState.AgerbotSettingsStore.Update(settings => settings.StartWithMisil = ChkStartAgerbot.IsChecked == true);
        }

        private void OnAutomaticModelUpdatesChanged(object sender, RoutedEventArgs e)
        {
            if (_appState == null || ChkAutomaticModelUpdates.IsChecked == null) return;
            _appState.AgerbotSettingsStore.Update(settings =>
                settings.AutomaticModelUpdates = ChkAutomaticModelUpdates.IsChecked == true);
        }

        private void OnApplyAgerbotQuotaClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null || !int.TryParse(AgerbotQuotaPicker.Text.Trim(), out int gib) || gib < 1)
            {
                TxtAgerbotError.Text = "La cuota de Agerbot debe ser al menos 1 GB.";
                TxtAgerbotError.Visibility = Visibility.Visible;
                return;
            }
            ulong bytes = AgerbotStorageQuotaService.BytesPerGiB * (ulong)gib;
            if (_appState.AgerbotHardware?.DiskAvailableBytes is ulong available
                && available < bytes + AgerbotStorageQuotaService.MinimumOperationalReserveBytes)
            {
                TxtAgerbotError.Text = "El disco no tiene espacio suficiente para esa cuota y el margen operativo.";
                TxtAgerbotError.Visibility = Visibility.Visible;
                return;
            }
            _appState.AgerbotSettingsStore.Update(settings => settings.StorageQuotaBytes = bytes);
            _appState.RefreshAgerbotStorageUsage();
            TxtAgerbotError.Visibility = Visibility.Collapsed;
        }

        private async void OnCheckAgerbotUpdatesClick(object sender, RoutedEventArgs e)
        {
            if (_appState?.AgerbotHardware == null) return;
            await _appState.AgerbotModelUpdates.CheckForUpdatesAsync(
                force: true,
                installAutomatically: false,
                diskAvailableBytes: _appState.AgerbotHardware.DiskAvailableBytes);
            UpdateAgerbotUI();
        }

        private async void OnUpdateAgerbotModelClick(object sender, RoutedEventArgs e)
        {
            if (_appState?.AgerbotHardware == null) return;
            await _appState.AgerbotModelUpdates.InstallAvailableAsync(_appState.AgerbotHardware.DiskAvailableBytes);
            _appState.RefreshAgerbotStorageUsage();
            UpdateAgerbotUI();
        }

        private void OnCancelModelUpdateClick(object sender, RoutedEventArgs e) => _appState?.AgerbotModelUpdates.Cancel();

        private async void OnRollbackAgerbotClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            await _appState.AgerbotModelUpdates.RollbackAsync();
            UpdateAgerbotUI();
        }

        private async void OnRepairAgerbotClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            await _appState.AgerbotModelUpdates.RepairAsync();
            UpdateAgerbotUI();
        }

        private async void OnCheckMisilUpdateClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            await _appState.MisilUpdates.CheckAsync(false, Environment.OSVersion.Version);
            UpdateMisilUpdateUI();
        }

        private async void OnDownloadMisilUpdateClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            await _appState.MisilUpdates.DownloadAsync();
            UpdateMisilUpdateUI();
        }

        private void OnCancelMisilUpdateClick(object sender, RoutedEventArgs e) => _appState?.MisilUpdates.Cancel();

        private void OnInstallMisilUpdateClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            try
            {
                _appState.LaunchMisilUpdateInstaller();
                Window.GetWindow(this)?.Close();
            }
            catch (Exception exception)
            {
                MessageBox.Show(exception.Message, "No se pudo actualizar MISIL", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void OnChangeQuotaClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            var dialog = new ContributionSetupDialog(_appState)
            {
                Owner = Window.GetWindow(this)
            };
            dialog.ShowDialog();
            UpdateUI();
        }

        private async void OnResetOnboardingClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;

            var result = MessageBox.Show(
                "¿Deseas repetir la configuración inicial?\nLos mensajes y archivos locales existentes no se eliminarán.",
                "Restablecer configuración",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question
            );

            if (result == MessageBoxResult.Yes)
            {
                await _appState.ResetOnboardingForTestingAsync();
            }
        }
    }
}
