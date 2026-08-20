using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using MISILNative.Models;
using MISILNative.Services;

namespace MISILNative.ViewModels
{
    public class NativeConversationStore : INotifyPropertyChanged, IDisposable
    {
        private readonly string _filePath;
        private readonly RelayService _relay;
        private NativeRelayIdentity? _relayIdentity;
        private bool _isSyncing;
        private string? _relayError;
        private Timer? _pollingTimer;

        public event PropertyChangedEventHandler? PropertyChanged;

        public ObservableCollection<NativeMessage> Messages { get; } = new();

        public NativeRelayIdentity? RelayIdentity
        {
            get => _relayIdentity;
            private set
            {
                _relayIdentity = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(IsRelayConnected));
                OnPropertyChanged(nameof(AccessCode));
            }
        }

        public bool IsRelayConnected => RelayIdentity != null;

        public string AccessCode => RelayIdentity?.AccessCode ?? string.Empty;

        public bool IsSyncing
        {
            get => _isSyncing;
            private set { _isSyncing = value; OnPropertyChanged(); }
        }

        public string? RelayError
        {
            get => _relayError;
            set { _relayError = value; OnPropertyChanged(); }
        }

        public NativeConversationStore()
        {
            _relay = new RelayService();
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MISIL"
            );
            Directory.CreateDirectory(dir);
            _filePath = Path.Combine(dir, "native-messages.json");

            LoadLocalMessages();

            RelayIdentity = CredentialService.LoadRelayIdentity();
            if (RelayIdentity != null)
            {
                _ = SyncAsync();
            }

            // Polling timer every 3 seconds
            _pollingTimer = new Timer(async _ =>
            {
                if (IsRelayConnected && !IsSyncing)
                {
                    await SyncAsync();
                }
            }, null, TimeSpan.FromSeconds(3), TimeSpan.FromSeconds(3));
        }

        public async Task SendAsync(string content)
        {
            string trimmed = content.Trim();
            if (string.IsNullOrEmpty(trimmed)) return;

            if (RelayIdentity != null)
            {
                try
                {
                    var sent = await _relay.SendAsync(trimmed, RelayIdentity);
                    AppendMessage(sent);
                    RelayError = null;
                }
                catch (Exception ex)
                {
                    RelayError = ex.Message;
                }
            }
            else
            {
                var msg = new NativeMessage
                {
                    Id = Guid.NewGuid(),
                    Content = trimmed,
                    CreatedAt = DateTime.UtcNow,
                    SenderId = null,
                    SenderName = null
                };
                AppendMessage(msg);
            }
        }

        public async Task<bool> CreateRelayAsync(string displayName, string baseUrl)
        {
            IsSyncing = true;
            try
            {
                var identity = await _relay.CreateRoomAsync(displayName, baseUrl);
                CredentialService.SaveRelayIdentity(identity);
                RelayIdentity = identity;

                Application.Current.Dispatcher.Invoke(() =>
                {
                    Messages.Clear();
                });
                SaveLocalMessages();

                RelayError = null;
                return true;
            }
            catch (Exception ex)
            {
                RelayError = ex.Message;
                return false;
            }
            finally
            {
                IsSyncing = false;
            }
        }

        public async Task<bool> JoinRelayAsync(string code, string displayName, string baseUrl)
        {
            IsSyncing = true;
            try
            {
                var identity = await _relay.JoinRoomAsync(code, displayName, baseUrl);
                CredentialService.SaveRelayIdentity(identity);
                RelayIdentity = identity;

                await SyncAsync();
                RelayError = null;
                return true;
            }
            catch (Exception ex)
            {
                RelayError = ex.Message;
                return false;
            }
            finally
            {
                IsSyncing = false;
            }
        }

        public async Task SyncAsync()
        {
            if (RelayIdentity == null || IsSyncing) return;

            IsSyncing = true;
            try
            {
                var remoteMessages = await _relay.FetchMessagesAsync(RelayIdentity);
                Application.Current.Dispatcher.Invoke(() =>
                {
                    foreach (var msg in remoteMessages)
                    {
                        if (!Messages.Any(m => m.Id == msg.Id))
                        {
                            Messages.Add(msg);
                        }
                    }
                    var sorted = Messages.OrderBy(m => m.CreatedAt).ToList();
                    for (int i = 0; i < sorted.Count; i++)
                    {
                        int currentIndex = Messages.IndexOf(sorted[i]);
                        if (currentIndex != i)
                        {
                            Messages.Move(currentIndex, i);
                        }
                    }
                });

                SaveLocalMessages();
                RelayError = null;
            }
            catch (Exception ex)
            {
                RelayError = ex.Message;
            }
            finally
            {
                IsSyncing = false;
            }
        }

        public void DisconnectRelay()
        {
            CredentialService.DeleteRelayIdentity();
            RelayIdentity = null;
            Application.Current.Dispatcher.Invoke(() =>
            {
                Messages.Clear();
            });
            SaveLocalMessages();
        }

        private void AppendMessage(NativeMessage message)
        {
            Application.Current.Dispatcher.Invoke(() =>
            {
                if (!Messages.Any(m => m.Id == message.Id))
                {
                    Messages.Add(message);
                }
            });
            SaveLocalMessages();
        }

        private void LoadLocalMessages()
        {
            if (!File.Exists(_filePath)) return;

            try
            {
                var json = File.ReadAllText(_filePath);
                var list = JsonSerializer.Deserialize<List<NativeMessage>>(json);
                if (list != null)
                {
                    foreach (var msg in list.OrderBy(m => m.CreatedAt))
                    {
                        Messages.Add(msg);
                    }
                }
            }
            catch { }
        }

        private void SaveLocalMessages()
        {
            try
            {
                var list = Messages.ToList();
                var json = JsonSerializer.Serialize(list, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_filePath, json);
            }
            catch { }
        }

        protected void OnPropertyChanged([CallerMemberName] string? name = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }

        public void Dispose()
        {
            _pollingTimer?.Dispose();
            _pollingTimer = null;
        }
    }
}
