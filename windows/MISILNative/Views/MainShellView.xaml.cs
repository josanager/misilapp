using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using MISILNative.Models;
using MISILNative.ViewModels;

namespace MISILNative.Views
{
    public partial class MainShellView : UserControl
    {
        private AppState? _appState;
        private NativeChatsView? _chatsView;
        private DashboardView? _dashboardView;
        private SettingsView? _settingsView;

        public MainShellView()
        {
            InitializeComponent();
            Loaded += OnLoaded;
        }

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (DataContext is AppState state)
            {
                _appState = state;
                _appState.PropertyChanged += (s, args) =>
                {
                    if (args.PropertyName == nameof(_appState.CurrentRoute))
                    {
                        UpdateView();
                    }
                    if (args.PropertyName == nameof(_appState.StorageSnapshot)
                        || args.PropertyName == nameof(_appState.SharesStorage)
                        || args.PropertyName == nameof(_appState.NetworkSnapshot)
                        || args.PropertyName == nameof(_appState.NetworkStatus))
                    {
                        UpdateFooter();
                    }
                };

                _chatsView = new NativeChatsView();
                _dashboardView = new DashboardView();
                _settingsView = new SettingsView();

                UpdateView();
                UpdateFooter();
            }
        }

        private void UpdateView()
        {
            if (_appState == null) return;

            HighlightNav(NavChats, _appState.CurrentRoute == AppRoute.Chats);
            HighlightNav(NavDashboard, _appState.CurrentRoute == AppRoute.Dashboard);
            HighlightNav(NavSettings, _appState.CurrentRoute == AppRoute.Settings);

            ContentHost.Children.Clear();
            switch (_appState.CurrentRoute)
            {
                case AppRoute.Chats:
                    if (_chatsView != null)
                    {
                        ContentHost.Children.Add(_chatsView);
                    }
                    break;
                case AppRoute.Dashboard:
                    if (_dashboardView != null)
                    {
                        _dashboardView.DataContext = _appState;
                        ContentHost.Children.Add(_dashboardView);
                    }
                    break;
                case AppRoute.Settings:
                    if (_settingsView != null)
                    {
                        _settingsView.DataContext = _appState;
                        ContentHost.Children.Add(_settingsView);
                    }
                    break;
            }
        }

        private void HighlightNav(Border navBorder, bool isSelected)
        {
            navBorder.Background = isSelected
                ? (SolidColorBrush)FindResource("BrushBgActive")
                : Brushes.Transparent;

            if (navBorder.Child is StackPanel sp && sp.Children.Count >= 2 && sp.Children[1] is TextBlock tb)
            {
                tb.Foreground = isSelected
                    ? (SolidColorBrush)FindResource("BrushTextPrimary")
                    : (SolidColorBrush)FindResource("BrushTextSecondary");
            }
        }

        private void UpdateFooter()
        {
            if (_appState == null) return;

            if (_appState.NetworkStatus == NetworkConnectionStatus.Online)
            {
                NodeStatusDot.Background = (SolidColorBrush)FindResource("BrushSuccess");
                TxtNodeStatusTitle.Text = "Red en línea";
                TxtNodeStatusDetail.Text = $"{_appState.NetworkSnapshot.OnlineNodes} nodos · {FormatUtils.FormatByteSize(_appState.NetworkSnapshot.TotalQuotaBytes)}";
            }
            else if (_appState.NetworkStatus == NetworkConnectionStatus.Connecting)
            {
                NodeStatusDot.Background = (SolidColorBrush)FindResource("BrushAccent");
                TxtNodeStatusTitle.Text = "Sincronizando";
                TxtNodeStatusDetail.Text = _appState.SharesStorage
                    ? $"Este PC aporta {FormatUtils.FormatByteSize(_appState.StorageSnapshot.QuotaBytes)}"
                    : "Comprobando capacidad";
            }
            else
            {
                NodeStatusDot.Background = (SolidColorBrush)FindResource("BrushTextMuted");
                TxtNodeStatusTitle.Text = "Sin conexión";
                TxtNodeStatusDetail.Text = "Reintento automático";
            }
        }

        private void OnNavChatsClick(object sender, MouseButtonEventArgs e)
        {
            if (_appState != null) _appState.CurrentRoute = AppRoute.Chats;
        }

        private void OnNavDashboardClick(object sender, MouseButtonEventArgs e)
        {
            if (_appState != null) _appState.CurrentRoute = AppRoute.Dashboard;
        }

        private void OnNavSettingsClick(object sender, MouseButtonEventArgs e)
        {
            if (_appState != null) _appState.CurrentRoute = AppRoute.Settings;
        }
    }
}
