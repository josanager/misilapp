using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

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
    }
}
