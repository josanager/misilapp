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
            _appState = state;
            _appState.PropertyChanged += OnAppStateChanged;
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
            if (e.PropertyName is nameof(AppState.StorageSnapshot) or nameof(AppState.Configuration)
                or nameof(AppState.StoragePeers) or nameof(AppState.StorageNetworkStatus))
                Dispatcher.Invoke(UpdateUI);
        }

        private void UpdateUI()
        {
            if (_appState == null) return;
            var storage = _appState.StorageSnapshot;
            bool active = _appState.SharesStorage;
            string quota = active ? FormatUtils.FormatByteSize(_appState.NetworkQuotaBytes) : "0 B";
            string used = FormatUtils.FormatByteSize(_appState.NetworkUsedBytes);
            string free = active ? FormatUtils.FormatByteSize(_appState.NetworkAvailableBytes) : "0 B";

            TxtQuota.Text = quota;
            TxtQuotaMetric.Text = quota;
            TxtUsed.Text = $"{used} utilizados";
            TxtUsedMetric.Text = used;
            TxtAvailable.Text = $"{free} libres";
            TxtFreeMetric.Text = free;
            UsageProgress.Value = _appState.NetworkQuotaBytes == 0 ? 0 : Math.Min(100, (double)_appState.NetworkUsedBytes / _appState.NetworkQuotaBytes * 100);
            TxtStorageDirectory.Text = _appState.Configuration?.StorageDirectory ?? string.Empty;
            LocalStatusDot.Fill = (SolidColorBrush)FindResource(active ? "BrushSuccess" : "BrushTextMuted");
            TxtLocalStatus.Text = active ? "ACTIVO" : "INACTIVO";
            PanelActive.Visibility = active ? Visibility.Visible : Visibility.Collapsed;
            PanelInactive.Visibility = active ? Visibility.Collapsed : Visibility.Visible;
            BtnOpenFolder.IsEnabled = active;
            TxtNetworkStatus.Text = _appState.StorageNetworkStatus;
            TxtPeers.Text = _appState.StoragePeers.Count == 0
                ? "Este PC · esperando otro nodo"
                : "Este PC · " + string.Join(" · ", _appState.StoragePeers.Select(peer => $"{peer.DisplayName} ({peer.Platform})"));
            BtnTestStorage.IsEnabled = active && _appState.StoragePeers.Count > 0;
        }

        private async void OnTestStorageClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            BtnTestStorage.IsEnabled = false;
            await _appState.TestSharedStorageAsync();
            UpdateUI();
        }

        private void OnOpenFolderClick(object sender, RoutedEventArgs e)
        {
            string? directory = _appState?.Configuration?.StorageDirectory;
            if (string.IsNullOrWhiteSpace(directory) || !Directory.Exists(directory)) return;
            Process.Start(new ProcessStartInfo("explorer.exe", directory) { UseShellExecute = true });
        }

        private void OnShareStorageClick(object sender, RoutedEventArgs e)
        {
            _appState?.ResetOnboardingForTestingAsync();
        }
    }
}
