using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using MISILNative.Models;
using MISILNative.Services;
using MISILNative.ViewModels;

namespace MISILNative.Views
{
    public partial class OnboardingView : UserControl
    {
        private AppState? _appState;
        private int _selectedGiB = StoragePolicy.MinimumGiB;
        private ulong _availableBytes = 0;
        private int _currentStep = 0; // 0: Welcome, 1: Choice, 2: Amount, 3: Security, 4: Preparing

        public OnboardingView()
        {
            InitializeComponent();
            Loaded += OnLoaded;
        }

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (DataContext is AppState state)
            {
                _appState = state;
                _availableBytes = _appState.AvailableDiskBytes();
                UpdateDiskAvailableText();
                SelectPreset(10);
            }
        }

        private void SetStep(int step)
        {
            _currentStep = step;
            PanelWelcome.Visibility = step == 0 ? Visibility.Visible : Visibility.Collapsed;
            PanelChoice.Visibility = step == 1 ? Visibility.Visible : Visibility.Collapsed;
            PanelAmount.Visibility = step == 2 ? Visibility.Visible : Visibility.Collapsed;
            PanelSecurity.Visibility = step == 3 ? Visibility.Visible : Visibility.Collapsed;
            PanelPreparing.Visibility = step == 4 ? Visibility.Visible : Visibility.Collapsed;

            StepIndicatorText.Text = step switch
            {
                0 => "Inicio",
                1 => "Almacenamiento",
                2 => "Cuota",
                3 => "Seguridad",
                4 => "Preparación",
                _ => ""
            };
        }

        private void OnWelcomeContinueClick(object sender, RoutedEventArgs e) => SetStep(1);

        private void OnBackToWelcomeClick(object sender, RoutedEventArgs e) => SetStep(0);

        private void OnChoiceShareClick(object sender, MouseButtonEventArgs e) => SetStep(2);

        private async void OnChoiceSkipClick(object sender, MouseButtonEventArgs e)
        {
            if (_appState == null) return;
            SetStep(4);
            bool success = await _appState.FinishOnboardingAsync(sharesStorage: false);
            if (!success)
            {
                MessageBox.Show(_appState.PresentationError ?? "Error al preparar MISIL.", "MISIL", MessageBoxButton.OK, MessageBoxImage.Error);
                SetStep(1);
            }
        }

        private void OnBackToChoiceClick(object sender, RoutedEventArgs e) => SetStep(1);

        private void OnBackToAmountClick(object sender, RoutedEventArgs e) => SetStep(2);

        private void OnPresetClick(object sender, MouseButtonEventArgs e)
        {
            if (sender is Border border && border.Tag is string tagStr && int.TryParse(tagStr, out int gib))
            {
                TxtCustomQuota.Text = "";
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

            BtnPrepareAmount.Content = $"Preparar {_selectedGiB} GB";
            ValidateAmount();
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

        private void OnCustomQuotaChanged(object sender, TextChangedEventArgs e)
        {
            string text = TxtCustomQuota.Text.Trim();
            if (int.TryParse(text, out int customGiB))
            {
                _selectedGiB = customGiB;
                HighlightPreset(Preset10, false);
                HighlightPreset(Preset50, false);
                HighlightPreset(Preset100, false);
                HighlightPreset(Preset500, false);
                BtnPrepareAmount.Content = $"Preparar {_selectedGiB} GB";
            }
            ValidateAmount();
        }

        private void ValidateAmount()
        {
            int maxShareable = StoragePolicy.MaxShareableGiB(_availableBytes);
            if (_selectedGiB < StoragePolicy.MinimumGiB)
            {
                TxtAmountError.Text = $"La cantidad mínima es de {StoragePolicy.MinimumGiB} GB.";
                TxtAmountError.Visibility = Visibility.Visible;
                BtnPrepareAmount.IsEnabled = false;
            }
            else if (_selectedGiB > maxShareable)
            {
                TxtAmountError.Text = "La cantidad supera el espacio libre disponible en Windows.";
                TxtAmountError.Visibility = Visibility.Visible;
                BtnPrepareAmount.IsEnabled = false;
            }
            else
            {
                TxtAmountError.Visibility = Visibility.Collapsed;
                BtnPrepareAmount.IsEnabled = true;
            }
        }

        private void UpdateDiskAvailableText()
        {
            int maxShareable = StoragePolicy.MaxShareableGiB(_availableBytes);
            ulong maxBytes = StoragePolicy.BytesForGiB(maxShareable);
            TxtDiskAvailable.Text = $"Disponible para compartir en este PC: hasta {FormatUtils.FormatByteSize(maxBytes)}. MISIL conserva 5 GB como margen de seguridad.";
        }

        private void OnAmountContinueClick(object sender, RoutedEventArgs e) => SetStep(3);

        private async void OnSecurityAuthorizeClick(object sender, RoutedEventArgs e)
        {
            if (_appState == null) return;
            SetStep(4);

            _appState.PropertyChanged += (s, args) =>
            {
                if (args.PropertyName == nameof(_appState.SetupProgress))
                {
                    Dispatcher.Invoke(() =>
                    {
                        var progress = _appState.SetupProgress;
                        TxtProgressTitle.Text = progress.Title;
                        TxtProgressDetail.Text = progress.Detail;
                        ProgressIndicator.Value = progress.Fraction * 100;
                        TxtProgressPercent.Text = $"{(int)(progress.Fraction * 100)} %";
                    });
                }
            };

            bool success = await _appState.FinishOnboardingAsync(sharesStorage: true, quotaGiB: _selectedGiB);
            if (!success)
            {
                MessageBox.Show(_appState.PresentationError ?? "Error al inicializar el almacenamiento.", "MISIL", MessageBoxButton.OK, MessageBoxImage.Error);
                SetStep(2);
            }
        }
    }
}
