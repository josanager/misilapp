using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MISILNative.Models;

namespace MISILNative.Services
{
    public static class CredentialService
    {
        private static readonly string SecurityDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "MISIL",
            "Security"
        );

        private static readonly string MasterKeyPath = Path.Combine(SecurityDirectory, "master.key.dat");
        private static readonly string RelayIdentityPath = Path.Combine(SecurityDirectory, "relay.identity.dat");

        static CredentialService()
        {
            try
            {
                if (!Directory.Exists(SecurityDirectory))
                {
                    Directory.CreateDirectory(SecurityDirectory);
                }
            }
            catch { }
        }

        public static byte[] LoadOrCreateMasterKey()
        {
            var existing = LoadMasterKey();
            if (existing != null && existing.Length == 32)
            {
                return existing;
            }

            byte[] keyBytes = new byte[32];
            RandomNumberGenerator.Fill(keyBytes);

            byte[] encrypted = ProtectedData.Protect(
                keyBytes,
                optionalEntropy: Encoding.UTF8.GetBytes("MISIL.Desktop.Storage.v1"),
                scope: DataProtectionScope.CurrentUser
            );

            Directory.CreateDirectory(SecurityDirectory);
            File.WriteAllBytes(MasterKeyPath, encrypted);
            return keyBytes;
        }

        public static byte[]? LoadMasterKey()
        {
            if (!File.Exists(MasterKeyPath)) return null;

            try
            {
                byte[] encrypted = File.ReadAllBytes(MasterKeyPath);
                return ProtectedData.Unprotect(
                    encrypted,
                    optionalEntropy: Encoding.UTF8.GetBytes("MISIL.Desktop.Storage.v1"),
                    scope: DataProtectionScope.CurrentUser
                );
            }
            catch
            {
                return null;
            }
        }

        public static NativeRelayIdentity? LoadRelayIdentity()
        {
            if (!File.Exists(RelayIdentityPath)) return null;

            try
            {
                byte[] encrypted = File.ReadAllBytes(RelayIdentityPath);
                byte[] decrypted = ProtectedData.Unprotect(
                    encrypted,
                    optionalEntropy: Encoding.UTF8.GetBytes("MISIL.Desktop.Relay.v1"),
                    scope: DataProtectionScope.CurrentUser
                );
                string json = Encoding.UTF8.GetString(decrypted);
                return JsonSerializer.Deserialize<NativeRelayIdentity>(json);
            }
            catch
            {
                return null;
            }
        }

        public static void SaveRelayIdentity(NativeRelayIdentity identity)
        {
            string json = JsonSerializer.Serialize(identity);
            byte[] plainBytes = Encoding.UTF8.GetBytes(json);

            byte[] encrypted = ProtectedData.Protect(
                plainBytes,
                optionalEntropy: Encoding.UTF8.GetBytes("MISIL.Desktop.Relay.v1"),
                scope: DataProtectionScope.CurrentUser
            );

            Directory.CreateDirectory(SecurityDirectory);
            File.WriteAllBytes(RelayIdentityPath, encrypted);
        }

        public static void DeleteRelayIdentity()
        {
            try
            {
                if (File.Exists(RelayIdentityPath))
                {
                    File.Delete(RelayIdentityPath);
                }
            }
            catch { }
        }
    }
}
