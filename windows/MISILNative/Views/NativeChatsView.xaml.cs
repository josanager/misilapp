using System.Collections.Specialized;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using MISILNative.ViewModels;

namespace MISILNative.Views
{
    public partial class NativeChatsView : UserControl
    {
        private readonly NativeConversationStore _store;

        public NativeChatsView()
        {
            InitializeComponent();
            _store = new NativeConversationStore();
            DataContext = _store;

            MessagesList.ItemsSource = _store.Messages;
            _store.Messages.CollectionChanged += OnMessagesCollectionChanged;
            _store.PropertyChanged += OnStorePropertyChanged;

            UpdateRelayUI();
            UpdateMessagesUI();
        }

        private void OnMessagesCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
        {
            UpdateMessagesUI();
        }

        private void OnStorePropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(_store.IsRelayConnected))
            {
                Dispatcher.Invoke(UpdateRelayUI);
            }
            if (e.PropertyName == nameof(_store.RelayError))
            {
                Dispatcher.Invoke(() =>
                {
                    if (string.IsNullOrEmpty(_store.RelayError))
                    {
                        TxtRelayError.Visibility = Visibility.Collapsed;
                    }
                    else
                    {
                        TxtRelayError.Text = _store.RelayError;
                        TxtRelayError.Visibility = Visibility.Visible;
                    }
                });
            }
        }

        private void UpdateRelayUI()
        {
            if (_store.IsRelayConnected)
            {
                TxtRelayIcon.Text = "🛡️";
                TxtRelayStatus.Text = "MISIL Web conectado";
                TxtConversationSubtitle.Text = "General · sincronizado con MISIL Web";
            }
            else
            {
                TxtRelayIcon.Text = "🌐";
                TxtRelayStatus.Text = "Conectar MISIL Web";
                TxtConversationSubtitle.Text = "General · sólo en este PC";
            }
        }

        private void UpdateMessagesUI()
        {
            Dispatcher.Invoke(() =>
            {
                EmptyStatePanel.Visibility = _store.Messages.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
                var last = _store.Messages.LastOrDefault();
                TxtLastMessagePreview.Text = last != null ? last.Content : "Sin mensajes";
                MessagesScrollViewer.ScrollToEnd();
            });
        }

        private async void OnSendMessageClick(object sender, RoutedEventArgs e)
        {
            await SendCurrentMessage();
        }

        private async void OnMessageInputKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                await SendCurrentMessage();
            }
        }

        private async System.Threading.Tasks.Task SendCurrentMessage()
        {
            string text = TxtMessageInput.Text.Trim();
            if (string.IsNullOrEmpty(text)) return;

            TxtMessageInput.Text = "";
            await _store.SendAsync(text);
        }

        private void OnRelaySetupClick(object sender, MouseButtonEventArgs e)
        {
            var dialog = new RelaySetupDialog(_store)
            {
                Owner = Window.GetWindow(this)
            };
            dialog.ShowDialog();
            UpdateRelayUI();
        }
    }
}
