using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using MISILNative.Core.Agerbot;

namespace MISILNative.Services
{
    public sealed class AgerbotCapabilityService
    {
        public async Task<AgerbotHardwareCapabilities> DetectAsync(CancellationToken cancellationToken = default)
        {
            var capabilities = new AgerbotHardwareCapabilities
            {
                WindowsVersion = RuntimeInformation.OSDescription,
                Architecture = RuntimeInformation.OSArchitecture.ToString().ToLowerInvariant(),
                CpuName = DetectCpuName(),
                LogicalCores = Environment.ProcessorCount,
                TotalMemoryBytes = DetectMemoryBytes(),
                DiskAvailableBytes = DetectDiskAvailableBytes(),
                DirectMlSystemLibraryAvailable = OperatingSystem.IsWindows()
                    && File.Exists(Path.Combine(Environment.SystemDirectory, "DirectML.dll"))
            };
            var nvidia = await DetectNvidiaAsync(cancellationToken);
            if (nvidia != null)
            {
                capabilities.GpuName = nvidia.Value.Name;
                capabilities.VramBytes = nvidia.Value.VramBytes;
                capabilities.NvidiaDriverVersion = nvidia.Value.DriverVersion;
                capabilities.NvidiaSmiAvailable = true;
            }
            return capabilities;
        }

        private static string DetectCpuName()
        {
            if (!OperatingSystem.IsWindows()) return RuntimeInformation.ProcessArchitecture.ToString();
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0");
                return key?.GetValue("ProcessorNameString")?.ToString()?.Trim() ?? "CPU Windows";
            }
            catch { return "CPU Windows"; }
        }

        private static ulong DetectMemoryBytes()
        {
            if (!OperatingSystem.IsWindows()) return (ulong)Math.Max(0, GC.GetGCMemoryInfo().TotalAvailableMemoryBytes);
            var status = new MemoryStatus { Length = (uint)Marshal.SizeOf<MemoryStatus>() };
            return GlobalMemoryStatusEx(ref status) ? status.TotalPhysical : 0;
        }

        private static ulong DetectDiskAvailableBytes()
        {
            try
            {
                string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string root = Path.GetPathRoot(local) ?? "C:\\";
                return (ulong)Math.Max(0, new DriveInfo(root).AvailableFreeSpace);
            }
            catch { return 0; }
        }

        private static async Task<(string Name, ulong VramBytes, string DriverVersion)?> DetectNvidiaAsync(CancellationToken cancellationToken)
        {
            if (!OperatingSystem.IsWindows()) return null;
            try
            {
                var startInfo = new ProcessStartInfo("nvidia-smi.exe")
                {
                    Arguments = "--query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                using var process = Process.Start(startInfo);
                if (process == null) return null;
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(4));
                string output = await process.StandardOutput.ReadToEndAsync(timeout.Token);
                await process.WaitForExitAsync(timeout.Token);
                if (process.ExitCode != 0) return null;
                string[] fields = output.Split('\n', StringSplitOptions.RemoveEmptyEntries)[0].Split(',');
                if (fields.Length < 3 || !double.TryParse(fields[1].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out double mib)) return null;
                return (fields[0].Trim(), (ulong)(mib * 1024 * 1024), fields[2].Trim());
            }
            catch { return null; }
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private struct MemoryStatus
        {
            public uint Length;
            public uint MemoryLoad;
            public ulong TotalPhysical;
            public ulong AvailablePhysical;
            public ulong TotalPageFile;
            public ulong AvailablePageFile;
            public ulong TotalVirtual;
            public ulong AvailableVirtual;
            public ulong AvailableExtendedVirtual;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool GlobalMemoryStatusEx(ref MemoryStatus buffer);
    }
}
