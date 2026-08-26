using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using MISILNative.Models;
using MISILNative.Services;

namespace MISILNative.ViewModels
{
    public sealed class NativeConversationStore : INotifyPropertyChanged, IDisposable
    {
        private readonly string _filePath;
        private readonly InternetMessagingService _messaging;
        private MessagingConnectionStatus _connectionStatus = MessagingConnectionStatus.Connecting;
        private string? _activeRecipient;
        private string? _messagingError;

        public event PropertyChangedEventHandler? PropertyChanged;
        public ObservableCollection<NativeMessage> Messages { get; } = new();
        public MessagingIdentity Identity { get; }
        public string PersonalLink => Identity.PersonalLink;

        public MessagingConnectionStatus ConnectionStatus
        {
            get => _connectionStatus;
            private set { _connectionStatus = value; OnPropertyChanged(); }
        }

        public string? ActiveRecipient
        {
            get => _activeRecipient;
            private set { _activeRecipient = value; OnPropertyChanged(); }
        }

        public string? MessagingError
        {
            get => _messagingError;
            private set { _messagingError = value; OnPropertyChanged(); }
        }

        public NativeConversationStore()
        {
            string directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MISIL");
            Directory.CreateDirectory(directory);
            _filePath = Path.Combine(directory, "internet-messages.json");
            Identity = MessagingIdentityStore.LoadOrCreate();
            LoadMessages();

            _messaging = new InternetMessagingService(Identity);
            _messaging.StatusChanged += status => RunOnUI(() => ConnectionStatus = status);
            _messaging.ErrorChanged += error => RunOnUI(() => MessagingError = error);
            _messaging.MessageReceived += message => RunOnUI(() => AppendIncoming(message));
            _messaging.Start();
        }

        public bool SelectRecipient(string value)
        {
            string candidate = value.Trim();
            if (Uri.TryCreate(candidate, UriKind.Absolute, out var uri)
                && uri.Scheme == "misil" && uri.Host == "contacto")
            {
                candidate = uri.AbsolutePath.Trim('/').Split('/')[0];
            }
            candidate = candidate.TrimStart('@').ToLowerInvariant();
            if (!Regex.IsMatch(candidate, "^[a-z0-9][a-z0-9_-]{2,31}$"))
            {
                MessagingError = "Pega un enlace MISIL válido o escribe un nombre de usuario.";
                return false;
            }
            ActiveRecipient = candidate;
            MessagingError = null;
            return true;
        }

        public async Task SendAsync(string content)
        {
            string trimmed = content.Trim();
            if (string.IsNullOrEmpty(trimmed)) return;
            if (string.IsNullOrWhiteSpace(ActiveRecipient))
            {
                MessagingError = "Primero conecta un contacto mediante su enlace personal.";
                return;
            }

            var message = new NativeMessage
            {
                Id = Guid.NewGuid(),
                Content = trimmed,
                CreatedAt = DateTime.UtcNow,
                SenderId = Guid.TryParse(Identity.DeviceId, out var ownId) ? ownId : null,
                SenderName = Identity.DisplayName,
                PeerUsername = ActiveRecipient,
                IsOutgoing = true
            };
            try
            {
                await _messaging.SendAsync(ActiveRecipient, trimmed, message.Id, message.CreatedAt);
                Append(message);
                MessagingError = null;
            }
            catch (Exception ex) { MessagingError = ex.Message; }
        }

        private void AppendIncoming(HubMessage hubMessage)
        {
            if (!Guid.TryParse(hubMessage.Id, out var id) || Messages.Any(item => item.Id == id)) return;
            DateTime.TryParse(hubMessage.CreatedAt, out var createdAt);
            var message = new NativeMessage
            {
                Id = id,
                Content = hubMessage.Content,
                CreatedAt = createdAt == default ? DateTime.UtcNow : createdAt,
                SenderName = hubMessage.SenderDisplayName,
                PeerUsername = hubMessage.SenderUsername,
                IsOutgoing = false
            };
            if (string.IsNullOrWhiteSpace(ActiveRecipient)) ActiveRecipient = hubMessage.SenderUsername;
            Append(message);
        }

        private void Append(NativeMessage message)
        {
            if (!Messages.Any(item => item.Id == message.Id)) Messages.Add(message);
            SaveMessages();
        }

        private void LoadMessages()
        {
            if (!File.Exists(_filePath)) return;
            try
            {
                var items = JsonSerializer.Deserialize<List<NativeMessage>>(File.ReadAllText(_filePath));
                if (items == null) return;
                foreach (var item in items.OrderBy(item => item.CreatedAt)) Messages.Add(item);
                ActiveRecipient = items.LastOrDefault()?.PeerUsername;
            }
            catch { }
        }

        private void SaveMessages()
        {
            try { File.WriteAllText(_filePath, JsonSerializer.Serialize(Messages.ToList(), new JsonSerializerOptions { WriteIndented = true })); }
            catch { }
        }

        private static void RunOnUI(Action action)
        {
            var dispatcher = Application.Current?.Dispatcher;
            if (dispatcher != null && !dispatcher.CheckAccess()) dispatcher.BeginInvoke(action);
            else action();
        }

        private void OnPropertyChanged([CallerMemberName] string? name = null) =>
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

        public void Dispose() => _messaging.Dispose();
    }
}
