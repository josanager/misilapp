using System.Windows;
using MISILNative.ViewModels;

namespace MISILNative
{
    public partial class MainWindow : Window
    {
        private readonly AppState _appState;

        public MainWindow()
        {
            InitializeComponent();
            _appState = new AppState();
            DataContext = _appState;
            Loaded += OnLoaded;
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
