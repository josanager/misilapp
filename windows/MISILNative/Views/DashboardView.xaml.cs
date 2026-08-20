using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
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
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (DataContext is AppState state)
            {
                _appState = state;
                await _appState.RefreshStorageAsync();
                UpdateUI();
            }
        }

        private void UpdateUI()
        {
            if (_appState == null) return;

            if (_appState.SharesStorage)
            {
                PanelActive.Visibility = Visibility.Visible;
                PanelInactive.Visibility = Visibility.Collapsed;
                TxtDashboardSubtitle.Text = "Nodo local activo";

                var snapshot = _appState.StorageSnapshot;
                TxtSharedQuota.Text = FormatUtils.FormatByteSize(snapshot.QuotaBytes);
                TxtUsedStorage.Text = FormatUtils.FormatByteSize(snapshot.UsedBytes);
                TxtAvailableQuota.Text = FormatUtils.FormatByteSize(snapshot.AvailableWithinQuota);

                string dir = _appState.Configuration?.StorageDirectory ?? "";
                TxtStorageDirectory.Text = !string.IsNullOrEmpty(dir) ? dir : "No configurado";
            }
            else
            {
                PanelActive.Visibility = Visibility.Collapsed;
                PanelInactive.Visibility = Visibility.Visible;
                TxtDashboardSubtitle.Text = "Almacenamiento no configurado";
            }
        }

        private void OnOpenFolderClick(object sender, RoutedEventArgs e)
        {
            string path = _appState?.Configuration?.StorageDirectory ?? "";
            if (!string.IsNullOrEmpty(path))
            {
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
