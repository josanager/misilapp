using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using MISILNative.Models;

namespace MISILNative.Services
{
    public sealed class NetworkPresenceService
    {
        public const string DefaultBaseUrl = "https://misil-web.pages.dev";
        private static readonly HttpClient HttpClient = new() { Timeout = TimeSpan.FromSeconds(8) };
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        private readonly NetworkNodeIdentity _identity;
        private bool _registered;

        public NetworkPresenceService(NetworkNodeIdentity? identity = null)
        {
            _identity = identity ?? CredentialService.LoadOrCreateNetworkIdentity();
        }

        public string NodeId => _identity.NodeId;

        public async Task<NetworkCapacitySnapshot> HeartbeatAsync(
            string baseUrl,
            StorageSnapshot storage,
            bool storageHealthy,
            CancellationToken cancellationToken)
        {
            string normalized = NormalizeBaseUrl(baseUrl);
            await EnsureRegisteredAsync(normalized, cancellationToken);

            var body = new
            {
                nodeId = _identity.NodeId,
                platform = "windows",
                appVersion = AppVersion,
                quotaBytes = storage.QuotaBytes,
                usedBytes = Math.Min(storage.UsedBytes, storage.QuotaBytes),
                storageHealthy
            };

            string json = await SendAsync(
                normalized,
                "/api/network/presence",
                HttpMethod.Put,
                body,
                authorized: true,
                cancellationToken
            );

            return JsonSerializer.Deserialize<NetworkCapacitySnapshot>(json, JsonOptions)
                ?? throw new InvalidOperationException("El relay devolvió una capacidad de red no válida.");
        }

        public async Task<NetworkCapacitySnapshot> FetchCapacityAsync(
            string baseUrl,
            CancellationToken cancellationToken)
        {
            string json = await SendAsync(
                NormalizeBaseUrl(baseUrl),
                "/api/network/capacity",
                HttpMethod.Get,
                body: null,
                authorized: false,
                cancellationToken
            );
            return JsonSerializer.Deserialize<NetworkCapacitySnapshot>(json, JsonOptions)
                ?? throw new InvalidOperationException("El relay devolvió una capacidad de red no válida.");
        }

        public async Task GoOfflineAsync(string baseUrl, CancellationToken cancellationToken)
        {
            if (!_registered) return;
            await SendAsync(
                NormalizeBaseUrl(baseUrl),
                "/api/network/presence",
                HttpMethod.Delete,
                new { nodeId = _identity.NodeId },
                authorized: true,
                cancellationToken
            );
        }

        private async Task EnsureRegisteredAsync(string baseUrl, CancellationToken cancellationToken)
        {
            if (_registered) return;

            var body = new
            {
                nodeId = _identity.NodeId,
                tokenHash = ComputeSha256Hex(_identity.AccessToken),
                platform = "windows",
                appVersion = AppVersion
            };

            await SendAsync(
                baseUrl,
                "/api/network/nodes",
                HttpMethod.Post,
                body,
                authorized: false,
                cancellationToken
            );
            _registered = true;
        }

        private async Task<string> SendAsync(
            string baseUrl,
            string path,
            HttpMethod method,
            object? body,
            bool authorized,
            CancellationToken cancellationToken)
        {
            using var request = new HttpRequestMessage(method, baseUrl + path);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            request.Headers.Add("X-MISIL-Protocol", "presence-v1");
            if (authorized)
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _identity.AccessToken);
            }
            if (body != null)
            {
                request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            }

            using var response = await HttpClient.SendAsync(request, cancellationToken);
            string responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                try
                {
                    var failure = JsonSerializer.Deserialize<RelayFailure>(responseBody, JsonOptions);
                    if (!string.IsNullOrWhiteSpace(failure?.Error))
                    {
                        throw new InvalidOperationException(failure.Error);
                    }
                }
                catch (JsonException) { }
                throw new InvalidOperationException($"La red MISIL respondió con error HTTP {(int)response.StatusCode}.");
            }
            return responseBody;
        }

        private static string NormalizeBaseUrl(string value)
        {
            string candidate = Environment.GetEnvironmentVariable("MISIL_RELAY_URL") ?? value;
            string trimmed = string.IsNullOrWhiteSpace(candidate) ? DefaultBaseUrl : candidate.Trim().TrimEnd('/');
            if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)
                || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                throw new InvalidOperationException("La dirección de la red MISIL no es válida.");
            }
            return trimmed;
        }

        private static string ComputeSha256Hex(string value)
        {
            return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
        }

        private static string AppVersion =>
            Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.2.0";
    }
}
