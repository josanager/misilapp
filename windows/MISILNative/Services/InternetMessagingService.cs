using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using MISILNative.Models;

namespace MISILNative.Services
{
    public sealed class InternetMessagingService : IDisposable
    {
        private readonly MessagingIdentity _identity;
        private readonly SemaphoreSlim _sendLock = new(1, 1);
        private CancellationTokenSource? _cancellation;
        private ClientWebSocket? _socket;

        public event Action<MessagingConnectionStatus>? StatusChanged;
        public event Action<HubMessage>? MessageReceived;
        public event Action<string?>? ErrorChanged;

        public InternetMessagingService(MessagingIdentity identity) => _identity = identity;

        public void Start()
        {
            if (_cancellation != null) return;
            _cancellation = new CancellationTokenSource();
            _ = RunAsync(_cancellation.Token);
        }

        public async Task SendAsync(string recipientUsername, string content, Guid clientMessageId, DateTime createdAt)
        {
            var socket = _socket;
            if (socket?.State != WebSocketState.Open) throw new InvalidOperationException("MISIL todavía no está conectado al Hub.");
            var payload = JsonSerializer.Serialize(new
            {
                type = "message.send",
                recipientUsername,
                clientMessageId = clientMessageId.ToString().ToLowerInvariant(),
                content,
                createdAt = createdAt.ToUniversalTime().ToString("o")
            });
            var bytes = Encoding.UTF8.GetBytes(payload);
            await _sendLock.WaitAsync();
            try { await socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None); }
            finally { _sendLock.Release(); }
        }

        private async Task RunAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                StatusChanged?.Invoke(MessagingConnectionStatus.Connecting);
                try
                {
                    using var socket = new ClientWebSocket();
                    socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
                    _socket = socket;
                    await socket.ConnectAsync(BuildUri(), cancellationToken);
                    StatusChanged?.Invoke(MessagingConnectionStatus.Online);
                    ErrorChanged?.Invoke(null);
                    await ReceiveLoopAsync(socket, cancellationToken);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { break; }
                catch (Exception ex) { ErrorChanged?.Invoke(ex.Message); }
                finally
                {
                    _socket = null;
                    StatusChanged?.Invoke(MessagingConnectionStatus.Offline);
                }
                try { await Task.Delay(TimeSpan.FromSeconds(3), cancellationToken); }
                catch (OperationCanceledException) { break; }
            }
        }

        private Uri BuildUri()
        {
            var separator = _identity.HubUrl.Contains('?') ? "&" : "?";
            string query = string.Join("&", new Dictionary<string, string>
            {
                ["deviceId"] = _identity.DeviceId,
                ["key"] = _identity.DeviceKey,
                ["username"] = _identity.Username,
                ["displayName"] = _identity.DisplayName,
                ["platform"] = "windows"
            }.Select(pair => $"{pair.Key}={Uri.EscapeDataString(pair.Value)}"));
            return new Uri(_identity.HubUrl + separator + query);
        }

        private async Task ReceiveLoopAsync(ClientWebSocket socket, CancellationToken cancellationToken)
        {
            var buffer = new byte[64 * 1024];
            while (socket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
            {
                using var stream = new MemoryStream();
                WebSocketReceiveResult result;
                do
                {
                    result = await socket.ReceiveAsync(buffer, cancellationToken);
                    if (result.MessageType == WebSocketMessageType.Close) return;
                    stream.Write(buffer, 0, result.Count);
                } while (!result.EndOfMessage);
                HandlePayload(Encoding.UTF8.GetString(stream.ToArray()));
            }
        }

        private void HandlePayload(string json)
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            string type = root.GetProperty("type").GetString() ?? string.Empty;
            if (type == "error")
            {
                ErrorChanged?.Invoke(root.GetProperty("error").GetString());
                return;
            }
            if (type == "message.received" && root.TryGetProperty("message", out var receivedMessage))
                Emit(receivedMessage);
            if (type == "messages.pending" && root.TryGetProperty("messages", out var messages))
                foreach (var pendingMessage in messages.EnumerateArray()) Emit(pendingMessage);
        }

        private void Emit(JsonElement element)
        {
            var message = element.Deserialize<HubMessage>();
            if (message != null) MessageReceived?.Invoke(message);
        }

        public void Dispose()
        {
            _cancellation?.Cancel();
            _cancellation?.Dispose();
            _cancellation = null;
            _socket?.Abort();
            _sendLock.Dispose();
        }
    }
}
