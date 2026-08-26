using System.Collections.Specialized;
using System.ComponentModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using MISILNative.Core.Agerbot;
using MISILNative.Models;
using MISILNative.ViewModels;

namespace MISILNative.Views
{
    public partial class NativeChatsView : UserControl
    {
        private readonly NativeConversationStore _humanStore;
        private AppState? _appState;
        private AgerbotConversationStore? _agerbotStore;
        private bool _agerbotSelected;

        public NativeChatsView()
        {
            InitializeComponent();
            _humanStore = new NativeConversationStore();
            Loaded += OnLoaded;
            _humanStore.Messages.CollectionChanged += OnMessagesCollectionChanged;
            _humanStore.PropertyChanged += OnHumanStorePropertyChanged;
            TxtPersonalLink.Text = _humanStore.PersonalLink;
            UpdateConnectionUI();
            UpdateMessagesUI();
        }

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (DataContext is not AppState state || ReferenceEquals(_appState, state)) return;
            if (_agerbotStore != null)
            {
                _agerbotStore.Messages.CollectionChanged -= OnMessagesCollectionChanged;
                _agerbotStore.PropertyChanged -= OnAgerbotStorePropertyChanged;
            }
            if (_appState != null) _appState.AgerbotProcessManager.PropertyChanged -= OnAgerbotProcessChanged;
            _appState = state;
            _agerbotStore = state.AgerbotConversationStore;
            _agerbotStore.Messages.CollectionChanged += OnMessagesCollectionChanged;
            _agerbotStore.PropertyChanged += OnAgerbotStorePropertyChanged;
            state.AgerbotProcessManager.PropertyChanged += OnAgerbotProcessChanged;
            UpdateAgerbotUI();
            UpdateMessagesUI();
        }

        private void OnHumanStorePropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                if (e.PropertyName is nameof(_humanStore.ConnectionStatus) or nameof(_humanStore.ActiveRecipient) or nameof(_humanStore.MessagingError))
                    UpdateConnectionUI();
            });
        }

        private void OnAgerbotStorePropertyChanged(object? sender, PropertyChangedEventArgs e) =>
            Dispatcher.Invoke(() => { UpdateAgerbotUI(); UpdateMessagesUI(); });

        private void OnAgerbotProcessChanged(object? sender, PropertyChangedEventArgs e) =>
            Dispatcher.Invoke(UpdateAgerbotUI);

        private void UpdateConnectionUI()
        {
            ConnectionDot.Fill = (SolidColorBrush)FindResource(_humanStore.ConnectionStatus switch
            {
                MessagingConnectionStatus.Online => "BrushSuccess",
                MessagingConnectionStatus.Connecting => "BrushAccent",
                _ => "BrushTextMuted"
            });
            TxtConnectionStatus.Text = _humanStore.ConnectionStatus switch
            {
                MessagingConnectionStatus.Online => "INTERNET CONECTADO",
                MessagingConnectionStatus.Connecting => "CONECTANDO",
                _ => "SIN CONEXIÓN"
            };
            TxtActiveContact.Text = string.IsNullOrWhiteSpace(_humanStore.ActiveRecipient)
                ? "Nuevo contacto"
                : $"@{_humanStore.ActiveRecipient}";
            if (!_agerbotSelected)
            {
                TxtConversationSubtitle.Text = string.IsNullOrWhiteSpace(_humanStore.ActiveRecipient)
                    ? "Pega el enlace personal de otro equipo"
                    : $"Conversación con @{_humanStore.ActiveRecipient}";
                ShowError(_humanStore.MessagingError);
            }
        }

        private void UpdateAgerbotUI()
        {
            if (_appState == null || _agerbotStore == null) return;
            var runtime = _appState.AgerbotProcessManager.State;
            AgerbotStatusDot.Fill = (SolidColorBrush)FindResource(runtime.Status switch
            {
                AgerbotRuntimeStatus.Ready => "BrushSuccess",
                AgerbotRuntimeStatus.Starting or AgerbotRuntimeStatus.Loading or AgerbotRuntimeStatus.Stopping => "BrushAccent",
                AgerbotRuntimeStatus.Failed or AgerbotRuntimeStatus.PortConflict or AgerbotRuntimeStatus.Unavailable => "BrushDanger",
                _ => "BrushTextMuted"
            });
            TxtAgerbotPreview.Text = _agerbotStore.IsGenerating
                ? "Pensando…"
                : _agerbotStore.Messages.LastOrDefault()?.Content ?? runtime.Detail;
            if (!_agerbotSelected) return;
            TxtConversationTitle.Text = "Agerbot";
            TxtConversationSubtitle.Text = runtime.IsReady
                ? $"Modelo local · Listo · {runtime.Health!.Model.Device.ToUpperInvariant()} · No usa MISIL Hub"
                : $"Modelo local · {runtime.Detail} · No usa MISIL Hub";
            BtnCancelGeneration.Visibility = _agerbotStore.IsGenerating ? Visibility.Visible : Visibility.Collapsed;
            ThinkingBubble.Visibility = _agerbotStore.IsGenerating ? Visibility.Visible : Visibility.Collapsed;
            TxtThinking.Text = _agerbotStore.Status switch
            {
                AgerbotConversationStatus.Starting => "Iniciando el runtime local…",
                AgerbotConversationStatus.Cancelling => "Cancelando generación…",
                _ => "Agerbot está pensando…"
            };
            TxtMessageInput.IsEnabled = !_agerbotStore.IsGenerating;
            BtnSend.IsEnabled = !_agerbotStore.IsGenerating;
            BtnStartAgerbot.Visibility = !runtime.IsReady && _agerbotStore.Messages.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
            ShowError(_agerbotStore.ErrorMessage);
        }

        private void OnMessagesCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e) =>
            Dispatcher.Invoke(UpdateMessagesUI);

        private void UpdateMessagesUI()
        {
            if (_agerbotSelected && _agerbotStore != null)
            {
                MessagesList.ItemsSource = _agerbotStore.Messages;
                EmptyStatePanel.Visibility = _agerbotStore.Messages.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
                TxtEmptyIcon.Text = "AI";
                TxtEmptyTitle.Text = "Habla con Agerbot";
                TxtEmptyDetail.Text = "Modelo experimental en este equipo. La conversación permanece local y nunca se envía a MISIL Hub.";
                TxtAgerbotWarning.Visibility = Visibility.Visible;
            }
            else
            {
                MessagesList.ItemsSource = _humanStore.Messages;
                EmptyStatePanel.Visibility = _humanStore.Messages.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
                TxtEmptyIcon.Text = "✦";
                TxtEmptyTitle.Text = "Conecta tu primer equipo";
                TxtEmptyDetail.Text = "Pega su enlace MISIL para enviar mensajes por Internet.";
                TxtAgerbotWarning.Visibility = Visibility.Collapsed;
                TxtLastMessagePreview.Text = _humanStore.Messages.LastOrDefault()?.Content ?? "Sin mensajes";
            }
            MessagesScrollViewer.ScrollToEnd();
        }

        private async Task SendCurrentMessageAsync()
        {
            string text = TxtMessageInput.Text.Trim();
            if (string.IsNullOrEmpty(text)) return;
            TxtMessageInput.Text = string.Empty;
            if (_agerbotSelected && _agerbotStore != null) await _agerbotStore.SendAsync(text);
            else await _humanStore.SendAsync(text);
        }

        private async void OnSendMessageClick(object sender, RoutedEventArgs e) => await SendCurrentMessageAsync();

        private async void OnMessageInputKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key != Key.Enter) return;
            e.Handled = true;
            await SendCurrentMessageAsync();
        }

        private void OnAgerbotContactClick(object sender, MouseButtonEventArgs e)
        {
            _agerbotSelected = true;
            AgerbotContact.Background = (SolidColorBrush)FindResource("BrushBgActive");
            HumanContact.Background = Brushes.Transparent;
            TxtMessageInput.Text = string.Empty;
            UpdateAgerbotUI();
            UpdateMessagesUI();
        }

        private void OnHumanContactClick(object sender, MouseButtonEventArgs e)
        {
            _agerbotSelected = false;
            AgerbotContact.Background = Brushes.Transparent;
            HumanContact.Background = (SolidColorBrush)FindResource("BrushBgActive");
            TxtConversationTitle.Text = "Mensajes";
            BtnCancelGeneration.Visibility = Visibility.Collapsed;
            ThinkingBubble.Visibility = Visibility.Collapsed;
            TxtMessageInput.IsEnabled = true;
            BtnSend.IsEnabled = true;
            BtnStartAgerbot.Visibility = Visibility.Collapsed;
            UpdateConnectionUI();
            UpdateMessagesUI();
        }

        private async void OnCancelGenerationClick(object sender, RoutedEventArgs e)
        {
            if (_agerbotStore != null) await _agerbotStore.CancelAsync();
        }

        private async void OnStartAgerbotClick(object sender, RoutedEventArgs e)
        {
            if (_agerbotStore != null) await _agerbotStore.RetryRuntimeAsync();
        }

        private void ShowError(string? error)
        {
            TxtMessagingError.Text = error ?? string.Empty;
            TxtMessagingError.Visibility = string.IsNullOrWhiteSpace(error) ? Visibility.Collapsed : Visibility.Visible;
        }

        private void OnCopyLinkClick(object sender, RoutedEventArgs e) => Clipboard.SetText(_humanStore.PersonalLink);

        private void OnConnectContactClick(object sender, RoutedEventArgs e)
        {
            if (_humanStore.SelectRecipient(TxtContactInput.Text)) TxtContactInput.Text = string.Empty;
        }
    }
}
