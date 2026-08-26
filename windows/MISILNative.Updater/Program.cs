using System.Diagnostics;
using System.Text.Json;
using MISILNative.Core.Distribution;

return await UpdaterProgram.RunAsync(args);

internal static class UpdaterProgram
{
    public static async Task<int> RunAsync(string[] args)
    {
        string? planPath = Argument(args, "--plan");
        if (string.IsNullOrWhiteSpace(planPath) || !File.Exists(planPath)) return 10;
        string updatesRoot = Path.GetFullPath(Path.GetDirectoryName(planPath)!);
        string backup = Path.Combine(updatesRoot, $"rollback-{Guid.NewGuid():N}");
        string resultPath = Path.Combine(updatesRoot, "update-result.json");
        MisilUpdaterLaunchPlan? plan = null;
        try
        {
            plan = JsonSerializer.Deserialize<MisilUpdaterLaunchPlan>(
                await File.ReadAllTextAsync(planPath),
                new JsonSerializerOptions(JsonSerializerDefaults.Web));
            if (plan == null) return 11;
            await MisilUpdateTransaction.ValidateInstallerAsync(plan);
            await WaitForProcessExitAsync(plan.WaitForProcessId, TimeSpan.FromMinutes(2));
            MisilUpdateTransaction.BackupDirectory(plan.InstallDirectory, backup);
            int installerExit = await RunInstallerAsync(plan.InstallerPath);
            if (installerExit != 0)
            {
                RestoreAndRelaunch(plan, backup);
                await WriteResultAsync(resultPath, false, $"El instalador terminó con código {installerExit}; se restauró la versión anterior.");
                return 20;
            }
            using var relaunched = Process.Start(new ProcessStartInfo(plan.RelaunchExecutable) { UseShellExecute = true });
            if (relaunched == null)
            {
                RestoreAndRelaunch(plan, backup);
                await WriteResultAsync(resultPath, false, "No se pudo reabrir MISIL; se restauró la versión anterior.");
                return 21;
            }
            await Task.Delay(TimeSpan.FromSeconds(5));
            if (relaunched.HasExited)
            {
                RestoreAndRelaunch(plan, backup);
                await WriteResultAsync(resultPath, false, "La nueva versión se cerró durante la comprobación; se restauró la anterior.");
                return 22;
            }
            try { Directory.Delete(backup, recursive: true); }
            catch { }
            await WriteResultAsync(resultPath, true, "MISIL se actualizó y volvió a abrirse correctamente.");
            return 0;
        }
        catch (Exception exception)
        {
            if (plan != null && Directory.Exists(backup))
            {
                try { RestoreAndRelaunch(plan, backup); }
                catch { }
            }
            await WriteResultAsync(resultPath, false, exception.Message);
            return 30;
        }
    }

    private static async Task WaitForProcessExitAsync(int processId, TimeSpan timeout)
    {
        try
        {
            using var process = Process.GetProcessById(processId);
            using var cancellation = new CancellationTokenSource(timeout);
            await process.WaitForExitAsync(cancellation.Token);
        }
        catch (ArgumentException) { }
    }

    private static async Task<int> RunInstallerAsync(string installer)
    {
        var startInfo = new ProcessStartInfo(installer)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };
        foreach (string argument in new[] { "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/CLOSEAPPLICATIONS" })
            startInfo.ArgumentList.Add(argument);
        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Windows no pudo iniciar el instalador verificado.");
        await process.WaitForExitAsync();
        return process.ExitCode;
    }

    private static void RestoreAndRelaunch(MisilUpdaterLaunchPlan plan, string backup)
    {
        MisilUpdateTransaction.RestoreDirectory(backup, plan.InstallDirectory);
        Process.Start(new ProcessStartInfo(plan.RelaunchExecutable) { UseShellExecute = true });
    }

    private static Task WriteResultAsync(string path, bool success, string detail) =>
        File.WriteAllTextAsync(path, JsonSerializer.Serialize(new
        {
            success,
            detail,
            completedAt = DateTimeOffset.UtcNow
        }, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true }));

    private static string? Argument(string[] args, string name)
    {
        int index = Array.IndexOf(args, name);
        return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
    }
}
