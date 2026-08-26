using System;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using MISILNative.Models;

namespace MISILNative.Services
{
    public static class MessagingIdentityStore
    {
        private static readonly string IdentityPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "MISIL",
            "messaging-identity.json"
        );

        public static MessagingIdentity LoadOrCreate()
        {
            try
            {
                if (File.Exists(IdentityPath))
                {
                    var existing = JsonSerializer.Deserialize<MessagingIdentity>(File.ReadAllText(IdentityPath));
                    if (existing != null && Guid.TryParse(existing.DeviceId, out _) && existing.DeviceKey.Length >= 32)
                        return existing;
                }
            }
            catch { }

            byte[] key = RandomNumberGenerator.GetBytes(32);
            string machine = Regex.Replace(Environment.MachineName.ToLowerInvariant(), "[^a-z0-9_-]", "-").Trim('-');
            if (machine.Length > 16) machine = machine[..16];
            if (machine.Length < 3) machine = "equipo";
            string suffix = Convert.ToHexString(RandomNumberGenerator.GetBytes(3)).ToLowerInvariant();
            var identity = new MessagingIdentity
            {
                DeviceId = Guid.NewGuid().ToString().ToLowerInvariant(),
                DeviceKey = Convert.ToBase64String(key).Replace("+", "-").Replace("/", "_").TrimEnd('='),
                Username = $"{machine}-{suffix}",
                DisplayName = Environment.MachineName,
                HubUrl = Environment.GetEnvironmentVariable("MISIL_HUB_URL") ?? "ws://127.0.0.1:4320/v1/connect"
            };
            Save(identity);
            return identity;
        }

        public static void Save(MessagingIdentity identity)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(IdentityPath)!);
            File.WriteAllText(IdentityPath, JsonSerializer.Serialize(identity, new JsonSerializerOptions { WriteIndented = true }));
        }
    }
}
