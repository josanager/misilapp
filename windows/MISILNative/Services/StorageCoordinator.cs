using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using MISILNative.Models;

namespace MISILNative.Services
{
    public class StorageCoordinator
    {
        private readonly string _rootDirectory;
        private readonly string _configurationPath;
        private readonly string _blobsDirectory;
        private readonly string _temporaryDirectory;

        public StorageCoordinator(string? rootDirectory = null)
        {
            _rootDirectory = rootDirectory ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MISIL"
            );
            _configurationPath = Path.Combine(_rootDirectory, "configuration.json");
            _blobsDirectory = Path.Combine(_rootDirectory, "Storage", "Blobs");
            _temporaryDirectory = Path.Combine(_rootDirectory, "Storage", "Temporary");
        }

        public AppConfiguration? LoadConfiguration()
        {
            if (!File.Exists(_configurationPath)) return null;
            try
            {
                var json = File.ReadAllText(_configurationPath);
                return JsonSerializer.Deserialize<AppConfiguration>(json);
            }
            catch
            {
                return null;
            }
        }

        public ulong DiskAvailableBytes()
        {
            try
            {
                var path = Path.GetPathRoot(_rootDirectory) ?? "C:\\";
                var driveInfo = new DriveInfo(path);
                if (driveInfo.IsReady)
                {
                    return (ulong)Math.Max(0, driveInfo.AvailableFreeSpace);
                }
            }
            catch { }
            return 0;
        }

        public async Task<AppConfiguration> PrepareAsync(
            bool sharesStorage,
            int quotaGiB,
            Func<SetupProgress, Task> progress)
        {
            await progress(new SetupProgress(
                0.12,
                "Comprobando el disco",
                "Reservando un margen seguro para Windows"
            ));

            if (sharesStorage)
            {
                StoragePolicy.Validate(quotaGiB, DiskAvailableBytes());
            }

            await progress(new SetupProgress(
                0.34,
                "Creando el nodo local",
                "Preparando directorios privados en AppData"
            ));

            try
            {
                Directory.CreateDirectory(_blobsDirectory);
                Directory.CreateDirectory(_temporaryDirectory);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"No se pudieron crear los directorios de almacenamiento: {ex.Message}");
            }

            if (sharesStorage)
            {
                await progress(new SetupProgress(
                    0.58,
                    "Protegiendo el almacenamiento",
                    "Guardando una clave de 256 bits con Windows DPAPI"
                ));

                _ = CredentialService.LoadOrCreateMasterKey();

                await progress(new SetupProgress(
                    0.76,
                    "Verificando escritura",
                    "Probando integridad del directorio local"
                ));

                string probePath = Path.Combine(_temporaryDirectory, "integrity-probe.bin");
                try
                {
                    byte[] probeData = new byte[1024 * 1024]; // 1 MiB
                    new Random().NextBytes(probeData);
                    await File.WriteAllBytesAsync(probePath, probeData);
                    if (File.Exists(probePath))
                    {
                        File.Delete(probePath);
                    }
                }
                catch (Exception ex)
                {
                    if (File.Exists(probePath)) { try { File.Delete(probePath); } catch { } }
                    throw new InvalidOperationException($"Fallo en la prueba de integridad de disco: {ex.Message}");
                }
            }

            await progress(new SetupProgress(
                0.90,
                "Guardando preferencias",
                sharesStorage ? "Aplicando la cuota seleccionada" : "Configurando el modo local"
            ));

            var configuration = new AppConfiguration
            {
                OnboardingCompleted = true,
                SharesStorage = sharesStorage,
                QuotaBytes = sharesStorage ? StoragePolicy.BytesForGiB(quotaGiB) : 0,
                StorageDirectory = _blobsDirectory,
                ConfiguredAt = DateTime.UtcNow
            };

            Save(configuration);

            await progress(new SetupProgress(
                1.0,
                "MISIL está listo",
                sharesStorage ? "Tu nodo local en Windows ya puede aportar espacio" : "Puedes activar el almacenamiento más adelante"
            ));

            return configuration;
        }

        public StorageSnapshot Snapshot(AppConfiguration? configuration)
        {
            if (configuration == null || !configuration.SharesStorage)
            {
                return new StorageSnapshot(0, 0, DiskAvailableBytes());
            }

            return new StorageSnapshot(
                configuration.QuotaBytes,
                DirectoryAllocatedSize(_blobsDirectory),
                DiskAvailableBytes()
            );
        }

        public bool IsStorageHealthy(AppConfiguration? configuration)
        {
            if (configuration == null || !configuration.SharesStorage || configuration.QuotaBytes == 0)
            {
                return false;
            }

            try
            {
                return Directory.Exists(configuration.StorageDirectory)
                    && CredentialService.LoadMasterKey()?.Length == 32
                    && DirectoryAllocatedSize(configuration.StorageDirectory) <= configuration.QuotaBytes;
            }
            catch
            {
                return false;
            }
        }

        public void ResetConfiguration()
        {
            try
            {
                if (File.Exists(_configurationPath))
                {
                    File.Delete(_configurationPath);
                }
            }
            catch { }
        }

        private void Save(AppConfiguration configuration)
        {
            Directory.CreateDirectory(_rootDirectory);
            var options = new JsonSerializerOptions { WriteIndented = true };
            var json = JsonSerializer.Serialize(configuration, options);
            File.WriteAllText(_configurationPath, json);
        }

        private ulong DirectoryAllocatedSize(string directoryPath)
        {
            if (!Directory.Exists(directoryPath)) return 0;

            try
            {
                ulong size = 0;
                var dirInfo = new DirectoryInfo(directoryPath);
                foreach (var file in dirInfo.EnumerateFiles("*", SearchOption.AllDirectories))
                {
                    size += (ulong)file.Length;
                }
                return size;
            }
            catch
            {
                return 0;
            }
        }
    }
}
