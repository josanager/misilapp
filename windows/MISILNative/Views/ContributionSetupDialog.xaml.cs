using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using MISILNative.Models;
using MISILNative.Services;
using MISILNative.ViewModels;

namespace MISILNative.Views
{
    public partial class ContributionSetupDialog : Window
    {
        private readonly AppState _appState;
        private int _selectedGiB = StoragePolicy.MinimumGiB;
        private readonly ulong _availableBytes;

        public ContributionSetupDialog(AppState appState)
        {
            InitializeComponent();
            _appState = appState;
            _availableBytes = _appState.AvailableDiskBytes();

            int maxShareable = StoragePolicy.MaxShareableGiB(_availableBytes);
            ulong maxBytes = StoragePolicy.BytesForGiB(maxShareable);
            TxtAvailableDisk.Text = $"Disponible para compartir en este PC: hasta {FormatUtils.FormatByteSize(maxBytes)}. MISIL conserva 5 GB como margen de seguridad.";

            int initial = _appState.Configuration?.SharesStorage == true
                ? (int)(_appState.Configuration.QuotaBytes / StoragePolicy.BytesPerGiB)
                : 10;

            SelectPreset(initial > 0 ? initial : 10);
        }

        private void OnPresetClick(object sender, MouseButtonEventArgs e)
        {
            if (sender is Border border && border.Tag is string tagStr && int.TryParse(tagStr, out int gib))
            {
                TxtCustom.Text = "";
                SelectPreset(gib);
            }
        }

        private void SelectPreset(int gib)
        {
            _selectedGiB = gib;
            HighlightPreset(Preset10, gib == 10);
            HighlightPreset(Preset50, gib == 50);
            HighlightPreset(Preset100, gib == 100);
            HighlightPreset(Preset500, gib == 500);
            BtnSave.Content = $"Aplicar {_selectedGiB} GB";
            Validate();
        }

        private void HighlightPreset(Border border, bool isSelected)
        {
            border.BorderBrush = isSelected
                ? (SolidColorBrush)FindResource("BrushAccent")
                : (SolidColorBrush)FindResource("BrushBorder");
            border.Background = isSelected
                ? (SolidColorBrush)FindResource("BrushBgActive")
                : (SolidColorBrush)FindResource("BrushBgSurface");
        }

        private void OnCustomChanged(object sender, TextChangedEventArgs e)
        {
            string text = TxtCustom.Text.Trim();
            if (int.TryParse(text, out int customGiB))
            {
                _selectedGiB = customGiB;
                HighlightPreset(Preset10, false);
                HighlightPreset(Preset50, false);
                HighlightPreset(Preset100, false);
                HighlightPreset(Preset500, false);
                BtnSave.Content = $"Aplicar {_selectedGiB} GB";
            }
            Validate();
        }

        private void Validate()
        {
            int maxShareable = StoragePolicy.MaxShareableGiB(_availableBytes);
            if (_selectedGiB < StoragePolicy.MinimumGiB)
            {
                TxtError.Text = $"La cantidad mínima es de {StoragePolicy.MinimumGiB} GB.";
                TxtError.Visibility = Visibility.Visible;
                BtnSave.IsEnabled = false;
            }
            else if (_selectedGiB > maxShareable)
            {
                TxtError.Text = "La cantidad supera el espacio libre disponible en Windows.";
                TxtError.Visibility = Visibility.Visible;
                BtnSave.IsEnabled = false;
            }
            else
            {
                TxtError.Visibility = Visibility.Collapsed;
                BtnSave.IsEnabled = true;
            }
        }

        private async void OnSaveClick(object sender, RoutedEventArgs e)
        {
            PanelForm.Visibility = Visibility.Collapsed;
            PanelPreparing.Visibility = Visibility.Visible;

            bool success = await _appState.FinishOnboardingAsync(sharesStorage: true, quotaGiB: _selectedGiB);
            if (success)
            {
                DialogResult = true;
                Close();
            }
            else
            {
                MessageBox.Show(_appState.PresentationError ?? "Error al configurar cuota.", "MISIL", MessageBoxButton.OK, MessageBoxImage.Error);
                PanelPreparing.Visibility = Visibility.Collapsed;
                PanelForm.Visibility = Visibility.Visible;
            }
        }

        private void OnCancelClick(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }
    }
}
