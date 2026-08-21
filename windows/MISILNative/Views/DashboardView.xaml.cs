using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using MISILNative.Models;
using MISILNative.ViewModels;

namespace MISILNative.Views
{
    public partial class DashboardView : UserControl
    {
        private AppState? _appState;

        public DashboardView()
        {
            InitializeComponent();
            Loaded += OnLoaded;
            Unloaded += OnUnloaded;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (DataContext is not AppState state) return;
            if (_appState != state)
            {
                if (_appState != null) _appState.PropertyChanged -= OnAppStateChanged;
                _appState = state;
                _appState.PropertyChanged += OnAppStateChanged;
            }
            await _appState.RefreshStorageAsync();
            UpdateUI();
        }

        private void OnUnloaded(object sender, RoutedEventArgs e)
        {
            if (_appState != null) _appState.PropertyChanged -= OnAppStateChanged;
            _appState = null;
        }

        private void OnAppStateChanged(object? sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName is nameof(AppState.StorageSnapshot)
                or nameof(AppState.NetworkSnapshot)
                or nameof(AppState.NetworkStatus)
                or nameof(AppState.LastNetworkUpdate)
                or nameof(AppState.NetworkError)
                or nameof(AppState.Configuration))
            {
                Dispatcher.Invoke(UpdateUI);
            }
        }

        private void UpdateUI()
        {
            if (_appState == null) return;

            var network = _appState.NetworkSnapshot;
            var local = _appState.StorageSnapshot;
            bool hasNetworkData = _appState.LastNetworkUpdate.HasValue;

            TxtNetworkTotal.Text = hasNetworkData
                ? FormatUtils.FormatByteSize(network.TotalQuotaBytes)
                : "—";
            TxtNetworkCaption.Text = hasNetworkData
                ? $"{network.OnlineNodes} {(network.OnlineNodes == 1 ? "nodo disponible" : "nodos disponibles")} ahora"
                : "Esperando la primera actualización";
            TxtOnlineNodes.Text = network.OnlineNodes.ToString();
            TxtWindowsNodes.Text = network.WindowsNodes.ToString();
            TxtMacNodes.Text = network.MacNodes.ToString();
            TxtNetworkUsed.Text = $"{FormatUtils.FormatByteSize(network.TotalUsedBytes)} utilizados";
            TxtNetworkAvailable.Text = $"{FormatUtils.FormatByteSize(network.AvailableBytes)} disponibles";
            NetworkUsageProgress.Value = network.TotalQuotaBytes == 0
                ? 0
                : Math.Min(100, (double)network.TotalUsedBytes / network.TotalQuotaBytes * 100);

            TxtLocalHeroQuota.Text = _appState.SharesStorage
                ? FormatUtils.FormatByteSize(local.QuotaBytes)
                : "0 GB";
            TxtLastUpdate.Text = _appState.LastNetworkUpdate.HasValue
                ? $"Actualizado {_appState.LastNetworkUpdate.Value:HH:mm:ss}"
                : "Todavía sin sincronizar";

            switch (_appState.NetworkStatus)
            {
                case NetworkConnectionStatus.Online:
                    NetworkStatusDot.Fill = (SolidColorBrush)FindResource("BrushSuccess");
                    NetworkStatusPill.BorderBrush = (SolidColorBrush)FindResource("BrushBorder");
                    TxtNetworkStatus.Text = "EN LÍNEA";
                    TxtNetworkStatus.Foreground = (SolidColorBrush)FindResource("BrushTextPrimary");
                    TxtDashboardSubtitle.Text = $"Actualización cada {network.HeartbeatIntervalSeconds} s · baja automática tras {network.OfflineAfterSeconds} s sin señal";
                    break;
                case NetworkConnectionStatus.Connecting:
                    NetworkStatusDot.Fill = (SolidColorBrush)FindResource("BrushAccent");
                    NetworkStatusPill.BorderBrush = (SolidColorBrush)FindResource("BrushAccentBorder");
                    TxtNetworkStatus.Text = "SINCRONIZANDO";
                    TxtNetworkStatus.Foreground = (SolidColorBrush)FindResource("BrushTextPrimary");
                    TxtDashboardSubtitle.Text = "Comprobando nodos disponibles en Internet";
                    break;
                default:
                    NetworkStatusDot.Fill = (SolidColorBrush)FindResource("BrushTextMuted");
                    NetworkStatusPill.BorderBrush = (SolidColorBrush)FindResource("BrushBorder");
                    TxtNetworkStatus.Text = "SIN CONEXIÓN";
                    TxtNetworkStatus.Foreground = (SolidColorBrush)FindResource("BrushTextMuted");
                    TxtDashboardSubtitle.Text = string.IsNullOrWhiteSpace(_appState.NetworkError)
                        ? "La red se reintentará automáticamente"
                        : $"Sin conexión · {_appState.NetworkError}";
                    break;
            }

            PanelActive.Visibility = _appState.SharesStorage ? Visibility.Visible : Visibility.Collapsed;
            PanelInactive.Visibility = _appState.SharesStorage ? Visibility.Collapsed : Visibility.Visible;
            if (_appState.SharesStorage)
            {
                TxtSharedQuota.Text = FormatUtils.FormatByteSize(local.QuotaBytes);
                TxtUsedStorage.Text = FormatUtils.FormatByteSize(local.UsedBytes);
                TxtAvailableQuota.Text = FormatUtils.FormatByteSize(local.AvailableWithinQuota);
                TxtStorageDirectory.Text = string.IsNullOrWhiteSpace(_appState.Configuration?.StorageDirectory)
                    ? "No configurado"
                    : _appState.Configuration.StorageDirectory;
            }
        }

        private void OnOpenFolderClick(object sender, RoutedEventArgs e)
        {
            string path = _appState?.Configuration?.StorageDirectory ?? "";
            if (string.IsNullOrWhiteSpace(path)) return;

            try
            {
                if (!Directory.Exists(path)) Directory.CreateDirectory(path);
                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = $"\"{path}\"",
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                MessageBox.Show($"No se pudo abrir el Explorador de Windows: {ex.Message}", "MISIL", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private void OnShareStorageClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            var dialog = new ContributionSetupDialog(_appState)
            {
                Owner = Window.GetWindow(this)
            };
            dialog.ShowDialog();
            UpdateUI();
        }
    }
}
