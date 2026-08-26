using System;
using System.Text.Json.Serialization;

namespace MISILNative.Models
{
    public enum AppRoute
    {
        Chats,
        Dashboard,
        Settings
    }

    public enum MessagingConnectionStatus
    {
        Connecting,
        Online,
        Offline
    }

    public class MessagingIdentity
    {
        [JsonPropertyName("deviceId")]
        public string DeviceId { get; set; } = string.Empty;

        [JsonPropertyName("deviceKey")]
        public string DeviceKey { get; set; } = string.Empty;

        [JsonPropertyName("username")]
        public string Username { get; set; } = string.Empty;

        [JsonPropertyName("displayName")]
        public string DisplayName { get; set; } = string.Empty;

        [JsonPropertyName("hubUrl")]
        public string HubUrl { get; set; } = "ws://127.0.0.1:4320/v1/connect";

        [JsonIgnore]
        public string PersonalLink => $"misil://contacto/{Username}/{DeviceId}";
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

        [JsonPropertyName("peerUsername")]
        public string? PeerUsername { get; set; }

        [JsonPropertyName("isOutgoing")]
        public bool IsOutgoing { get; set; } = true;

        public string FormattedTime => CreatedAt.ToLocalTime().ToString("HH:mm");
    }

    public class HubMessage
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("senderUsername")]
        public string SenderUsername { get; set; } = string.Empty;

        [JsonPropertyName("senderDisplayName")]
        public string SenderDisplayName { get; set; } = string.Empty;

        [JsonPropertyName("recipientUsername")]
        public string RecipientUsername { get; set; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;

        [JsonPropertyName("createdAt")]
        public string CreatedAt { get; set; } = string.Empty;
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
