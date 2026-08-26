using System.IO.Compression;

namespace MISILNative.Core.Distribution;

public static class SafeZipExtractor
{
    public static void Extract(string archivePath, string destination, ulong maximumExpandedBytes)
    {
        string root = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
        Directory.CreateDirectory(root);
        ulong expanded = 0;
        using var archive = ZipFile.OpenRead(archivePath);
        foreach (var entry in archive.Entries)
        {
            if (string.IsNullOrWhiteSpace(entry.FullName)) continue;
            string target = Path.GetFullPath(Path.Combine(root, entry.FullName));
            if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("El paquete intenta escribir fuera de la instalación de Agerbot.");
            expanded = checked(expanded + (ulong)entry.Length);
            if (expanded > maximumExpandedBytes)
                throw new InvalidDataException("El paquete expandido supera el tamaño declarado.");
            if (entry.FullName.EndsWith('/') || entry.FullName.EndsWith('\\'))
            {
                Directory.CreateDirectory(target);
                continue;
            }
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            entry.ExtractToFile(target, overwrite: false);
        }
    }
}
