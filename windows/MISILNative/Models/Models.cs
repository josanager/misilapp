using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MISILNative.Models
{
    public enum AppRoute
    {
        Chats,
        Dashboard,
        Settings
    }

    public enum NetworkConnectionStatus
    {
        Connecting,
        Online,
        Offline
    }

    public class AppConfiguration
    {
        public const int CurrentSchemaVersion = 2;

        [JsonPropertyName("schemaVersion")]
        public int SchemaVersion { get; set; } = CurrentSchemaVersion;

        [JsonPropertyName("onboardingCompleted")]
        public bool OnboardingCompleted { get; set; }

        [JsonPropertyName("sharesStorage")]
        public bool SharesStorage { get; set; }

        [JsonPropertyName("quotaBytes")]
        public ulong QuotaBytes { get; set; }

        [JsonPropertyName("storageDirectory")]
        public string StorageDirectory { get; set; } = string.Empty;

        [JsonPropertyName("configuredAt")]
        public DateTime ConfiguredAt { get; set; } = DateTime.UtcNow;

        [JsonPropertyName("networkBaseUrl")]
        public string NetworkBaseUrl { get; set; } = "https://misil-web.pages.dev";
    }

    public class StorageSnapshot
    {
        public ulong QuotaBytes { get; set; }
        public ulong UsedBytes { get; set; }
        public ulong DiskAvailableBytes { get; set; }

        public ulong AvailableWithinQuota =>
            QuotaBytes > UsedBytes ? QuotaBytes - UsedBytes : 0;

        public StorageSnapshot(ulong quotaBytes, ulong usedBytes, ulong diskAvailableBytes)
        {
            QuotaBytes = quotaBytes;
            UsedBytes = usedBytes;
            DiskAvailableBytes = diskAvailableBytes;
        }
    }

    public class NetworkNodeIdentity
    {
        [JsonPropertyName("version")]
        public int Version { get; set; } = 1;

        [JsonPropertyName("nodeId")]
        public string NodeId { get; set; } = string.Empty;

        [JsonPropertyName("accessToken")]
        public string AccessToken { get; set; } = string.Empty;

        [JsonPropertyName("createdAt")]
        public string CreatedAt { get; set; } = string.Empty;
    }

    public class PlatformCapacity
    {
        [JsonPropertyName("platform")]
        public string Platform { get; set; } = string.Empty;

        [JsonPropertyName("onlineNodes")]
        public int OnlineNodes { get; set; }

        [JsonPropertyName("quotaBytes")]
        public ulong QuotaBytes { get; set; }
    }

    public class NetworkCapacitySnapshot
    {
        [JsonPropertyName("protocolVersion")]
        public int ProtocolVersion { get; set; } = 1;

        [JsonPropertyName("generatedAt")]
        public string GeneratedAt { get; set; } = string.Empty;

        [JsonPropertyName("heartbeatIntervalSeconds")]
        public int HeartbeatIntervalSeconds { get; set; } = 10;

        [JsonPropertyName("offlineAfterSeconds")]
        public int OfflineAfterSeconds { get; set; } = 35;

        [JsonPropertyName("onlineNodes")]
        public int OnlineNodes { get; set; }

        [JsonPropertyName("totalQuotaBytes")]
        public ulong TotalQuotaBytes { get; set; }

        [JsonPropertyName("totalUsedBytes")]
        public ulong TotalUsedBytes { get; set; }

        [JsonPropertyName("availableBytes")]
        public ulong AvailableBytes { get; set; }

        [JsonPropertyName("platforms")]
        public List<PlatformCapacity> Platforms { get; set; } = new();

        [JsonIgnore]
        public int WindowsNodes => Platforms.Find(item => item.Platform == "windows")?.OnlineNodes ?? 0;

        [JsonIgnore]
        public int MacNodes => Platforms.Find(item => item.Platform == "macos")?.OnlineNodes ?? 0;

        public static NetworkCapacitySnapshot Empty => new();
    }

    public class SetupProgress
    {
        public double Fraction { get; set; }
        public string Title { get; set; }
        public string Detail { get; set; }

        public SetupProgress(double fraction, string title, string detail)
        {
            Fraction = fraction;
            Title = title;
            Detail = detail;
        }

        public static SetupProgress Idle => new(0, "Preparando MISIL", "Comprobando este equipo Windows");
    }

    public class NativeMessage
    {
        [JsonPropertyName("id")]
        public Guid Id { get; set; }

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;

        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [JsonPropertyName("senderID")]
        public Guid? SenderId { get; set; }

        [JsonPropertyName("senderName")]
        public string? SenderName { get; set; }

        public string FormattedTime => CreatedAt.ToLocalTime().ToString("HH:mm");
    }

    public class NativeRelayIdentity
    {
        [JsonPropertyName("version")]
        public int Version { get; set; } = 1;

        [JsonPropertyName("baseURL")]
        public string BaseUrl { get; set; } = string.Empty;

        [JsonPropertyName("roomID")]
        public string RoomId { get; set; } = string.Empty;

        [JsonPropertyName("accessToken")]
        public string AccessToken { get; set; } = string.Empty;

        [JsonPropertyName("encryptionKey")]
        public string EncryptionKey { get; set; } = string.Empty;

        [JsonPropertyName("deviceID")]
        public string DeviceId { get; set; } = string.Empty;

        [JsonPropertyName("displayName")]
        public string DisplayName { get; set; } = string.Empty;

        [JsonPropertyName("createdAt")]
        public string CreatedAt { get; set; } = string.Empty;

        [JsonIgnore]
        public string AccessCode
        {
            get
            {
                var secret = new SharedRoomSecret
                {
                    V = 1,
                    R = RoomId,
                    T = AccessToken,
                    K = EncryptionKey
                };
                var json = JsonSerializer.Serialize(secret);
                var bytes = System.Text.Encoding.UTF8.GetBytes(json);
                return Convert.ToBase64String(bytes)
                    .Replace("+", "-")
                    .Replace("/", "_")
                    .TrimEnd('=');
            }
        }
    }

    public class SharedRoomSecret
    {
        [JsonPropertyName("v")]
        public int V { get; set; } = 1;

        [JsonPropertyName("r")]
        public string R { get; set; } = string.Empty;

        [JsonPropertyName("t")]
        public string T { get; set; } = string.Empty;

        [JsonPropertyName("k")]
        public string K { get; set; } = string.Empty;
    }

    public class RoomRegistration
    {
        [JsonPropertyName("roomId")]
        public string RoomId { get; set; } = string.Empty;

        [JsonPropertyName("tokenHash")]
        public string TokenHash { get; set; } = string.Empty;
    }

    public class OutgoingEnvelope
    {
        [JsonPropertyName("roomId")]
        public string RoomId { get; set; } = string.Empty;

        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("ciphertext")]
        public string Ciphertext { get; set; } = string.Empty;

        [JsonPropertyName("iv")]
        public string Iv { get; set; } = string.Empty;

        [JsonPropertyName("createdAt")]
        public string CreatedAt { get; set; } = string.Empty;
    }

    public class EnvelopeList
    {
        [JsonPropertyName("messages")]
        public List<IncomingEnvelope> Messages { get; set; } = new();
    }

    public class IncomingEnvelope
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("ciphertext")]
        public string Ciphertext { get; set; } = string.Empty;

        [JsonPropertyName("iv")]
        public string Iv { get; set; } = string.Empty;

        [JsonPropertyName("createdAt")]
        public string CreatedAt { get; set; } = string.Empty;
    }

    public class RelayPayload
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;

        [JsonPropertyName("createdAt")]
        public string CreatedAt { get; set; } = string.Empty;

        [JsonPropertyName("sender")]
        public RelaySender Sender { get; set; } = new();
    }

    public class RelaySender
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("displayName")]
        public string DisplayName { get; set; } = string.Empty;
    }

    public class RelayFailure
    {
        [JsonPropertyName("error")]
        public string? Error { get; set; }
    }

    public static class FormatUtils
    {
        public static string FormatByteSize(ulong byteCount)
        {
            string[] suf = { "B", "KB", "MB", "GB", "TB", "PB" };
            if (byteCount == 0)
                return "0 B";
            long bytes = (long)byteCount;
            int place = Convert.ToInt32(Math.Floor(Math.Log(bytes, 1024)));
            if (place >= suf.Length) place = suf.Length - 1;
            double num = Math.Round(bytes / Math.Pow(1024, place), 1);
            return $"{num} {suf[place]}";
        }
    }
}
