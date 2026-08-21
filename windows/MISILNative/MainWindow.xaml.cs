using System.Windows;
using System.ComponentModel;
using MISILNative.ViewModels;

namespace MISILNative
{
    public partial class MainWindow : Window
    {
        private readonly AppState _appState;
        private bool _shutdownComplete;

        public MainWindow()
        {
            InitializeComponent();
            _appState = new AppState();
            DataContext = _appState;
            Loaded += OnLoaded;
            Closing += OnClosing;
        }

        private async void OnClosing(object? sender, CancelEventArgs e)
        {
            if (_shutdownComplete) return;
            e.Cancel = true;
            IsEnabled = false;
            await _appState.ShutdownAsync();
            _shutdownComplete = true;
            Close();
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            _appState.PropertyChanged += (s, args) =>
            {
                if (args.PropertyName == nameof(_appState.IsLoading) ||
                    args.PropertyName == nameof(_appState.HasCompletedOnboarding))
                {
                    Dispatcher.Invoke(UpdateViewHierarchy);
                }
            };

            await _appState.LoadAsync();
            UpdateViewHierarchy();
        }

        private void UpdateViewHierarchy()
        {
            if (_appState.IsLoading)
            {
                LoadingContainer.Visibility = Visibility.Visible;
                OnboardingContainer.Visibility = Visibility.Collapsed;
                MainShellContainer.Visibility = Visibility.Collapsed;
            }
            else if (!_appState.HasCompletedOnboarding)
            {
                LoadingContainer.Visibility = Visibility.Collapsed;
                OnboardingContainer.DataContext = _appState;
                OnboardingContainer.Visibility = Visibility.Visible;
                MainShellContainer.Visibility = Visibility.Collapsed;
            }
            else
            {
                LoadingContainer.Visibility = Visibility.Collapsed;
                OnboardingContainer.Visibility = Visibility.Collapsed;
                MainShellContainer.DataContext = _appState;
                MainShellContainer.Visibility = Visibility.Visible;
            }
        }
    }
}
