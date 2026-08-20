using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using MISILNative.Models;

namespace MISILNative.Services
{
    public class RelayService
    {
        private static readonly HttpClient HttpClient = new() { Timeout = TimeSpan.FromSeconds(20) };

        public async Task<NativeRelayIdentity> CreateRoomAsync(string displayName, string baseUrl)
        {
            string normalizedUrl = NormalizeBaseUrl(baseUrl);
            var identity = new NativeRelayIdentity
            {
                Version = 1,
                BaseUrl = normalizedUrl,
                RoomId = Guid.NewGuid().ToString().ToLowerInvariant(),
                AccessToken = RandomSecretBase64Url(32),
                EncryptionKey = RandomSecretBase64Url(32),
                DeviceId = Guid.NewGuid().ToString().ToLowerInvariant(),
                DisplayName = displayName.Trim(),
                CreatedAt = DateTime.UtcNow.ToString("o")
            };

            var body = new RoomRegistration
            {
                RoomId = identity.RoomId,
                TokenHash = ComputeSha256Hex(identity.AccessToken)
            };

            await SendRequestAsync(identity, "/api/relay/rooms", HttpMethod.Post, body, authorized: false);
            return identity;
        }

        public async Task<NativeRelayIdentity> JoinRoomAsync(string code, string displayName, string baseUrl)
        {
            var secretBytes = Base64UrlDecode(code.Trim());
            var secretJson = Encoding.UTF8.GetString(secretBytes);
            var secret = JsonSerializer.Deserialize<SharedRoomSecret>(secretJson);

            if (secret == null || secret.V != 1 || Base64UrlDecode(secret.K).Length != 32)
            {
                throw new InvalidOperationException("El código privado no es válido o está incompleto.");
            }

            var identity = new NativeRelayIdentity
            {
                Version = 1,
                BaseUrl = NormalizeBaseUrl(baseUrl),
                RoomId = secret.R,
                AccessToken = secret.T,
                EncryptionKey = secret.K,
                DeviceId = Guid.NewGuid().ToString().ToLowerInvariant(),
                DisplayName = displayName.Trim(),
                CreatedAt = DateTime.UtcNow.ToString("o")
            };

            // Test fetching messages to verify room and credentials
            await FetchMessagesAsync(identity);
            return identity;
        }

        public async Task<NativeMessage> SendAsync(string content, NativeRelayIdentity identity)
        {
            var messageId = Guid.NewGuid();
            var createdAt = DateTime.UtcNow.ToString("o");
            Guid senderId = Guid.TryParse(identity.DeviceId, out var sid) ? sid : Guid.NewGuid();

            var payload = new RelayPayload
            {
                Id = messageId.ToString().ToLowerInvariant(),
                Content = content,
                CreatedAt = createdAt,
                Sender = new RelaySender
                {
                    Id = senderId.ToString().ToLowerInvariant(),
                    DisplayName = identity.DisplayName
                }
            };

            byte[] plainBytes = JsonSerializer.SerializeToUtf8Bytes(payload);
            byte[] keyBytes = Base64UrlDecode(identity.EncryptionKey);

            byte[] nonce = new byte[12]; // 96-bit standard nonce for AES-GCM
            RandomNumberGenerator.Fill(nonce);

            byte[] ciphertext = new byte[plainBytes.Length];
            byte[] tag = new byte[16]; // 128-bit authentication tag

            using (var aesGcm = new AesGcm(keyBytes, 16))
            {
                aesGcm.Encrypt(nonce, plainBytes, ciphertext, tag);
            }

            byte[] combinedCiphertext = new byte[ciphertext.Length + tag.Length];
            Buffer.BlockCopy(ciphertext, 0, combinedCiphertext, 0, ciphertext.Length);
            Buffer.BlockCopy(tag, 0, combinedCiphertext, ciphertext.Length, tag.Length);

            var envelope = new OutgoingEnvelope
            {
                RoomId = identity.RoomId,
                Id = payload.Id,
                Ciphertext = Base64UrlEncode(combinedCiphertext),
                Iv = Base64UrlEncode(nonce),
                CreatedAt = createdAt
            };

            await SendRequestAsync(identity, "/api/relay/messages", HttpMethod.Post, envelope, authorized: true);

            return new NativeMessage
            {
                Id = messageId,
                Content = content,
                CreatedAt = DateTime.UtcNow,
                SenderId = senderId,
                SenderName = identity.DisplayName
            };
        }

        public async Task<List<NativeMessage>> FetchMessagesAsync(NativeRelayIdentity identity)
        {
            string path = $"/api/relay/messages?roomId={Uri.EscapeDataString(identity.RoomId)}";
            string responseJson = await SendRequestAsync(identity, path, HttpMethod.Get, (object?)null, authorized: true);

            var envelopeList = JsonSerializer.Deserialize<EnvelopeList>(responseJson);
            if (envelopeList?.Messages == null) return new List<NativeMessage>();

            byte[] keyBytes = Base64UrlDecode(identity.EncryptionKey);
            var result = new List<NativeMessage>();

            foreach (var envelope in envelopeList.Messages)
            {
                try
                {
                    byte[] combinedCipher = Base64UrlDecode(envelope.Ciphertext);
                    if (combinedCipher.Length <= 16) continue;

                    byte[] nonce = Base64UrlDecode(envelope.Iv);
                    if (nonce.Length != 12) continue;

                    int cipherLen = combinedCipher.Length - 16;
                    byte[] ciphertext = new byte[cipherLen];
                    byte[] tag = new byte[16];
                    Buffer.BlockCopy(combinedCipher, 0, ciphertext, 0, cipherLen);
                    Buffer.BlockCopy(combinedCipher, cipherLen, tag, 0, 16);

                    byte[] decryptedPlain = new byte[cipherLen];
                    using (var aesGcm = new AesGcm(keyBytes, 16))
                    {
                        aesGcm.Decrypt(nonce, ciphertext, tag, decryptedPlain);
                    }

                    var payload = JsonSerializer.Deserialize<RelayPayload>(decryptedPlain);
                    if (payload != null && Guid.TryParse(payload.Id, out var id))
                    {
                        Guid? sId = Guid.TryParse(payload.Sender.Id, out var sid) ? sid : null;
                        DateTime.TryParse(payload.CreatedAt, out var dt);

                        result.Add(new NativeMessage
                        {
                            Id = id,
                            Content = payload.Content,
                            CreatedAt = dt != default ? dt : DateTime.UtcNow,
                            SenderId = sId,
                            SenderName = payload.Sender.DisplayName
                        });
                    }
                }
                catch { }
            }

            return result.OrderBy(m => m.CreatedAt).ToList();
        }

        private async Task<string> SendRequestAsync(
            NativeRelayIdentity identity,
            string path,
            HttpMethod method,
            object? body,
            bool authorized)
        {
            var url = $"{identity.BaseUrl}{path}";
            using var request = new HttpRequestMessage(method, url);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            if (authorized)
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", identity.AccessToken);
            }

            if (body != null)
            {
                var json = JsonSerializer.Serialize(body);
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");
            }

            using var response = await HttpClient.SendAsync(request);
            string responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                try
                {
                    var failure = JsonSerializer.Deserialize<RelayFailure>(responseBody);
                    if (!string.IsNullOrEmpty(failure?.Error))
                    {
                        throw new InvalidOperationException(failure.Error);
                    }
                }
                catch (JsonException) { }

                throw new InvalidOperationException($"El relay respondió con error HTTP {(int)response.StatusCode}.");
            }

            return responseBody;
        }

        private string NormalizeBaseUrl(string value)
        {
            string trimmed = value.Trim().TrimEnd('/');
            if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) ||
                (uri.Scheme != "http" && uri.Scheme != "https"))
            {
                throw new InvalidOperationException("La dirección URL del relay no es válida.");
            }
            return trimmed;
        }

        private string RandomSecretBase64Url(int size = 32)
        {
            byte[] bytes = new byte[size];
            RandomNumberGenerator.Fill(bytes);
            return Base64UrlEncode(bytes);
        }

        private string ComputeSha256Hex(string input)
        {
            byte[] inputBytes = Encoding.UTF8.GetBytes(input);
            byte[] hash = SHA256.HashData(inputBytes);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        private string Base64UrlEncode(byte[] bytes)
        {
            return Convert.ToBase64String(bytes)
                .Replace("+", "-")
                .Replace("/", "_")
                .TrimEnd('=');
        }

        private byte[] Base64UrlDecode(string value)
        {
            string incoming = value.Replace("-", "+").Replace("_", "/");
            switch (incoming.Length % 4)
            {
                case 2: incoming += "=="; break;
                case 3: incoming += "="; break;
            }
            return Convert.FromBase64String(incoming);
        }
    }
}
