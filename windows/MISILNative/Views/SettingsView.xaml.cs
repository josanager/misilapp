using System.Windows;
using System.Windows.Controls;
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
        }

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (DataContext is AppState state)
            {
                _appState = state;
                UpdateUI();
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
