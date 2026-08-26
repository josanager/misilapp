using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MISILNative.Core.Distribution;

public sealed class NoUpdateAvailableException : Exception
{
    public NoUpdateAvailableException(string message) : base(message) { }
}

public sealed class GitHubReleaseAsset
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("size")]
    public ulong Size { get; set; }

    [JsonPropertyName("browser_download_url")]
    public Uri BrowserDownloadUrl { get; set; } = new("https://github.com");
}

public sealed class GitHubRelease
{
    [JsonPropertyName("tag_name")]
    public string TagName { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("draft")]
    public bool Draft { get; set; }

    [JsonPropertyName("prerelease")]
    public bool Prerelease { get; set; }

    [JsonPropertyName("published_at")]
    public DateTimeOffset? PublishedAt { get; set; }

    [JsonPropertyName("body")]
    public string? Body { get; set; }

    [JsonPropertyName("assets")]
    public List<GitHubReleaseAsset> Assets { get; set; } = [];
}

public interface IGitHubApiTransport
{
    Task<(byte[] Data, int StatusCode)> GetAsync(Uri uri, string accept, CancellationToken cancellationToken = default);
}

public sealed class GitHubApiTransport : IGitHubApiTransport, IDisposable
{
    private readonly HttpClient _client;
    private readonly bool _ownsClient;

    public GitHubApiTransport(HttpClient? client = null)
    {
        _ownsClient = client == null;
        _client = client ?? new HttpClient();
        _client.Timeout = TimeSpan.FromSeconds(20);
        _client.DefaultRequestHeaders.UserAgent.ParseAdd("MISIL-Windows/0.3.0");
        _client.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
    }

    public async Task<(byte[] Data, int StatusCode)> GetAsync(Uri uri, string accept, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(accept));
        using var response = await _client.SendAsync(request, cancellationToken);
        return (await response.Content.ReadAsByteArrayAsync(cancellationToken), (int)response.StatusCode);
    }

    public void Dispose()
    {
        if (_ownsClient) _client.Dispose();
    }
}

public static class GitHubJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };
}
