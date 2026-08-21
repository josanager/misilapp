using System.Windows;
using System.Windows.Controls;
using System.ComponentModel;
using System.Windows.Media;
using MISILNative.Models;
using MISILNative.ViewModels;

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
                UpdateUI();
            }
        }

        private void OnUnloaded(object sender, RoutedEventArgs e)
        {
            if (_appState != null) _appState.PropertyChanged -= OnAppStateChanged;
        }

        private void OnAppStateChanged(object? sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName is nameof(AppState.NetworkStatus) or nameof(AppState.NetworkSnapshot))
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

            switch (_appState.NetworkStatus)
            {
                case NetworkConnectionStatus.Online:
                    NetworkSettingDot.Fill = (SolidColorBrush)FindResource("BrushSuccess");
                    TxtNetworkSettingStatus.Text = $"En línea · {_appState.NetworkSnapshot.OnlineNodes} nodos disponibles";
                    break;
                case NetworkConnectionStatus.Connecting:
                    NetworkSettingDot.Fill = (SolidColorBrush)FindResource("BrushAccent");
                    TxtNetworkSettingStatus.Text = "Sincronizando con la red MISIL";
                    break;
                default:
                    NetworkSettingDot.Fill = (SolidColorBrush)FindResource("BrushTextMuted");
                    TxtNetworkSettingStatus.Text = "Sin conexión · reintento automático";
                    break;
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
