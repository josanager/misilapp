namespace MISILNative.Core.Distribution;

public static class MisilUpdateTransaction
{
    public static async Task ValidateInstallerAsync(MisilUpdaterLaunchPlan plan, CancellationToken cancellationToken = default)
    {
        if (plan.WaitForProcessId <= 0
            || plan.ExpectedSizeBytes == 0
            || plan.ExpectedSha256.Length != 64
            || !File.Exists(plan.InstallerPath)
            || !File.Exists(plan.RelaunchExecutable)
            || !Directory.Exists(plan.InstallDirectory))
            throw new InvalidDataException("El plan de actualización de MISIL no es válido.");
        string installer = Path.GetFullPath(plan.InstallerPath);
        string install = Path.GetFullPath(plan.InstallDirectory) + Path.DirectorySeparatorChar;
        string relaunch = Path.GetFullPath(plan.RelaunchExecutable);
        if (!relaunch.StartsWith(install, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("El ejecutable de reapertura no pertenece a la instalación de MISIL.");
        if ((ulong)new FileInfo(installer).Length != plan.ExpectedSizeBytes)
            throw new InvalidDataException("El instalador de MISIL está truncado.");
        string digest = await VerifiedDownloadService.Sha256Async(installer, cancellationToken);
        if (!digest.Equals(plan.ExpectedSha256, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("El instalador de MISIL no coincide con el SHA-256 esperado.");
    }

    public static void BackupDirectory(string source, string backup)
    {
        string sourceRoot = Path.GetFullPath(source);
        string backupRoot = Path.GetFullPath(backup);
        if (!Directory.Exists(sourceRoot)) throw new DirectoryNotFoundException(sourceRoot);
        if (backupRoot.StartsWith(sourceRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("El respaldo no puede crearse dentro de la aplicación instalada.");
        if (Directory.Exists(backupRoot)) Directory.Delete(backupRoot, recursive: true);
        CopyTree(sourceRoot, backupRoot);
    }

    public static void RestoreDirectory(string backup, string destination)
    {
        string backupRoot = Path.GetFullPath(backup);
        string destinationRoot = Path.GetFullPath(destination);
        if (!Directory.Exists(backupRoot)) throw new DirectoryNotFoundException(backupRoot);
        if (Directory.Exists(destinationRoot)) Directory.Delete(destinationRoot, recursive: true);
        CopyTree(backupRoot, destinationRoot);
    }

    private static void CopyTree(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (string directory in Directory.EnumerateDirectories(source, "*", SearchOption.AllDirectories))
            Directory.CreateDirectory(Path.Combine(destination, Path.GetRelativePath(source, directory)));
        foreach (string file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            string target = Path.Combine(destination, Path.GetRelativePath(source, file));
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(file, target, overwrite: true);
        }
    }
}
