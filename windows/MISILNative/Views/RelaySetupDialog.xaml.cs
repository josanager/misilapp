using System;
using System.Windows;
using System.Windows.Media;
using MISILNative.ViewModels;

namespace MISILNative.Views
{
    public partial class RelaySetupDialog : Window
    {
        private readonly NativeConversationStore _store;
        private int _mode = 0; // 0: Create, 1: Join

        public RelaySetupDialog(NativeConversationStore store)
        {
            InitializeComponent();
            _store = store;
            UpdateUI();
        }

        private void UpdateUI()
        {
            if (_store.IsRelayConnected)
            {
                PanelConnected.Visibility = Visibility.Visible;
                PanelDisconnected.Visibility = Visibility.Collapsed;
                TxtAccessCode.Text = _store.AccessCode;
            }
            else
            {
                PanelConnected.Visibility = Visibility.Collapsed;
                PanelDisconnected.Visibility = Visibility.Visible;
            }
        }

        private void OnModeCreateClick(object sender, RoutedEventArgs e)
        {
            _mode = 0;
            BtnModeCreate.Style = (Style)FindResource("MISILPrimaryButton");
            BtnModeJoin.Style = (Style)FindResource("MISILSecondaryButton");
            PanelJoinCode.Visibility = Visibility.Collapsed;
            BtnAction.Content = "Crear espacio cifrado";
            TxtError.Visibility = Visibility.Collapsed;
        }

        private void OnModeJoinClick(object sender, RoutedEventArgs e)
        {
            _mode = 1;
            BtnModeCreate.Style = (Style)FindResource("MISILSecondaryButton");
            BtnModeJoin.Style = (Style)FindResource("MISILPrimaryButton");
            PanelJoinCode.Visibility = Visibility.Visible;
            BtnAction.Content = "Conectar con código";
            TxtError.Visibility = Visibility.Collapsed;
        }

        private async void OnActionClick(object sender, RoutedEventArgs e)
        {
            string name = TxtDisplayName.Text.Trim();
            string url = TxtBaseUrl.Text.Trim();

            if (string.IsNullOrEmpty(name))
            {
                ShowError("Por favor ingresa un nombre visible.");
                return;
            }

            BtnAction.IsEnabled = false;
            BtnAction.Content = "Conectando...";

            bool success;
            if (_mode == 0)
            {
                success = await _store.CreateRelayAsync(name, url);
            }
            else
            {
                string code = TxtJoinCode.Text.Trim();
                if (string.IsNullOrEmpty(code))
                {
                    ShowError("Por favor introduce el código privado del espacio.");
                    BtnAction.IsEnabled = true;
                    BtnAction.Content = "Conectar con código";
                    return;
                }
                success = await _store.JoinRelayAsync(code, name, url);
            }

            if (success)
            {
                DialogResult = true;
                Close();
            }
            else
            {
                ShowError(_store.RelayError ?? "Error al conectar con el relay.");
                BtnAction.IsEnabled = true;
                BtnAction.Content = _mode == 0 ? "Crear espacio cifrado" : "Conectar con código";
            }
        }

        private void ShowError(string message)
        {
            TxtError.Text = message;
            TxtError.Visibility = Visibility.Visible;
        }

        private void OnCopyCodeClick(object sender, RoutedEventArgs e)
        {
            try
            {
                Clipboard.SetText(_store.AccessCode);
                BtnCopyCode.Content = "¡Copiado!";
            }
            catch { }
        }

        private void OnDisconnectClick(object sender, RoutedEventArgs e)
        {
            var result = MessageBox.Show(
                "¿Deseas desconectar este PC del espacio web?",
                "Desconectar MISIL Web",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question
            );

            if (result == MessageBoxResult.Yes)
            {
                _store.DisconnectRelay();
                UpdateUI();
            }
        }

        private void OnCloseClick(object sender, RoutedEventArgs e)
        {
            Close();
        }
    }
}
