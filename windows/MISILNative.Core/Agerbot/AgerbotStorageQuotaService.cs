namespace MISILNative.Core.Agerbot;

public sealed class AgerbotStorageQuotaService
{
    public const ulong BytesPerGiB = 1024UL * 1024 * 1024;
    public const ulong MinimumOperationalReserveBytes = 256UL * 1024 * 1024;
    public static readonly int[] PresetsGiB = [1, 2, 5, 10];

    private readonly string _root;

    public AgerbotStorageQuotaService(string root) => _root = Path.GetFullPath(root);

    public AgerbotStorageSnapshot Snapshot(ulong quotaBytes, ulong diskAvailableBytes) => new()
    {
        QuotaBytes = quotaBytes,
        UsedBytes = DirectorySize(_root),
        DiskAvailableBytes = diskAvailableBytes,
        ReservedForOperationBytes = MinimumOperationalReserveBytes
    };

    public AgerbotStorageDecision CanInstall(AgerbotStorageSnapshot snapshot, AgerbotStorageRequirement requirement)
    {
        ulong required;
        try { required = checked(requirement.TotalAdditionalBytes + MinimumOperationalReserveBytes); }
        catch (OverflowException) { return new(false, ulong.MaxValue, "El tamaño declarado no es válido."); }
        if (snapshot.AvailableWithinQuota < required)
        {
            return new(false, required, "La cuota de Agerbot es insuficiente para runtime, candidato, temporales y rollback.");
        }
        if (snapshot.DiskAvailableBytes < required)
        {
            return new(false, required, "Windows no tiene espacio libre suficiente para completar la instalación con seguridad.");
        }
        return new(true, required, "Hay espacio suficiente dentro de la cuota y en el disco.");
    }

    public int CleanOldPartialDownloads(TimeSpan maximumAge)
    {
        string downloads = Path.Combine(_root, "downloads");
        if (!Directory.Exists(downloads)) return 0;
        int deleted = 0;
        DateTime threshold = DateTime.UtcNow - maximumAge;
        foreach (string file in Directory.EnumerateFiles(downloads, "*.partial", SearchOption.TopDirectoryOnly))
        {
            try
            {
                if (File.GetLastWriteTimeUtc(file) >= threshold) continue;
                File.Delete(file);
                deleted++;
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
        return deleted;
    }

    private static ulong DirectorySize(string directory)
    {
        if (!Directory.Exists(directory)) return 0;
        try
        {
            ulong total = 0;
            foreach (string file in Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories))
                total = checked(total + (ulong)new FileInfo(file).Length);
            return total;
        }
        catch { return 0; }
    }
}
