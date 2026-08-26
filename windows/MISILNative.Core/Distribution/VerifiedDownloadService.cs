using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;

namespace MISILNative.Core.Distribution;

public sealed class VerifiedDownloadService : IDisposable
{
    private readonly HttpClient _client;
    private readonly bool _ownsClient;

    public VerifiedDownloadService(HttpClient? client = null)
    {
        _ownsClient = client == null;
        _client = client ?? new HttpClient();
        _client.Timeout = Timeout.InfiniteTimeSpan;
    }

    public async Task<string> DownloadAsync(
        Uri source,
        string destination,
        ulong expectedSize,
        IProgress<double>? progress = null,
        CancellationToken cancellationToken = default)
    {
        if (!source.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
            && !source.IsLoopback)
            throw new InvalidOperationException("Las descargas de MISIL requieren HTTPS.");
        Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
        string partial = destination + ".partial";
        long existing = File.Exists(partial) ? new FileInfo(partial).Length : 0;
        if ((ulong)Math.Max(0, existing) > expectedSize)
        {
            File.Delete(partial);
            existing = 0;
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, source);
        if (existing > 0) request.Headers.Range = new RangeHeaderValue(existing, null);
        using var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (response.StatusCode != HttpStatusCode.OK && response.StatusCode != HttpStatusCode.PartialContent)
            throw new HttpRequestException($"La descarga respondió HTTP {(int)response.StatusCode}.");
        if (existing > 0 && response.StatusCode == HttpStatusCode.OK) existing = 0;

        await using var output = new FileStream(
            partial,
            existing > 0 ? FileMode.Append : FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            1024 * 1024,
            useAsync: true);
        await using var input = await response.Content.ReadAsStreamAsync(cancellationToken);
        byte[] buffer = new byte[1024 * 1024];
        long written = existing;
        while (true)
        {
            int read = await input.ReadAsync(buffer, cancellationToken);
            if (read == 0) break;
            written = checked(written + read);
            if ((ulong)written > expectedSize) throw new InvalidDataException("La descarga supera el tamaño declarado.");
            await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            progress?.Report(expectedSize == 0 ? 0 : Math.Min(1, (double)(ulong)written / expectedSize));
        }
        await output.FlushAsync(cancellationToken);
        if ((ulong)written != expectedSize) throw new InvalidDataException("La descarga está truncada.");
        File.Move(partial, destination, overwrite: true);
        progress?.Report(1);
        return destination;
    }

    public static async Task<string> Sha256Async(string path, CancellationToken cancellationToken = default)
    {
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 1024 * 1024, useAsync: true);
        byte[] digest = await SHA256.HashDataAsync(stream, cancellationToken);
        return Convert.ToHexString(digest).ToLowerInvariant();
    }

    public void Dispose()
    {
        if (_ownsClient) _client.Dispose();
    }
}
