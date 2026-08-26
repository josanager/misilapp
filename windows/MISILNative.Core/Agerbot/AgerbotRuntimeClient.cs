using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace MISILNative.Core.Agerbot;

public interface IAgerbotRuntimeClient
{
    Task<AgerbotHealthResponse> HealthAsync(CancellationToken cancellationToken = default);
    Task<AgerbotCapabilitiesResponse> CapabilitiesAsync(CancellationToken cancellationToken = default);
    Task<AgerbotChatResponse> ChatAsync(AgerbotChatRequest request, CancellationToken cancellationToken = default);
    Task<AgerbotCancelResponse> CancelAsync(string conversationId = AgerbotConstants.ReservedConversationId, CancellationToken cancellationToken = default);
    Task<bool> HasHttpServiceOnRuntimePortAsync(CancellationToken cancellationToken = default);
}

public sealed class AgerbotRuntimeClient : IAgerbotRuntimeClient, IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient;
    private readonly bool _ownsClient;

    public AgerbotRuntimeClient(Uri? baseUri = null, HttpMessageHandler? handler = null)
    {
        _ownsClient = true;
        _httpClient = handler == null ? new HttpClient() : new HttpClient(handler, disposeHandler: true);
        _httpClient.BaseAddress = baseUri ?? AgerbotConstants.DefaultBaseUri;
        _httpClient.Timeout = Timeout.InfiniteTimeSpan;
    }

    public AgerbotRuntimeClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _ownsClient = false;
        _httpClient.BaseAddress ??= AgerbotConstants.DefaultBaseUri;
    }

    public Task<AgerbotHealthResponse> HealthAsync(CancellationToken cancellationToken = default) =>
        SendAsync<AgerbotHealthResponse>(HttpMethod.Get, "v1/health", null, TimeSpan.FromSeconds(3), cancellationToken);

    public Task<AgerbotCapabilitiesResponse> CapabilitiesAsync(CancellationToken cancellationToken = default) =>
        SendAsync<AgerbotCapabilitiesResponse>(HttpMethod.Get, "v1/capabilities", null, TimeSpan.FromSeconds(5), cancellationToken);

    public Task<AgerbotChatResponse> ChatAsync(AgerbotChatRequest request, CancellationToken cancellationToken = default) =>
        SendAsync<AgerbotChatResponse>(HttpMethod.Post, "v1/chat", request, TimeSpan.FromSeconds(180), cancellationToken);

    public Task<AgerbotCancelResponse> CancelAsync(
        string conversationId = AgerbotConstants.ReservedConversationId,
        CancellationToken cancellationToken = default) =>
        SendAsync<AgerbotCancelResponse>(
            HttpMethod.Post,
            "v1/chat/cancel",
            new { conversationId },
            TimeSpan.FromSeconds(3),
            cancellationToken);

    public async Task<bool> HasHttpServiceOnRuntimePortAsync(CancellationToken cancellationToken = default)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(1));
        try
        {
            using var response = await _httpClient.GetAsync("v1/health", timeout.Token);
            return true;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return false;
        }
        catch (HttpRequestException)
        {
            return false;
        }
    }

    private async Task<T> SendAsync<T>(
        HttpMethod method,
        string path,
        object? body,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body != null) request.Content = JsonContent.Create(body, options: JsonOptions);
        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutSource.CancelAfter(timeout);
        try
        {
            using var response = await _httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                timeoutSource.Token);
            await using var stream = await response.Content.ReadAsStreamAsync(timeoutSource.Token);
            if (!response.IsSuccessStatusCode)
            {
                AgerbotApiErrorEnvelope? envelope = null;
                try { envelope = await JsonSerializer.DeserializeAsync<AgerbotApiErrorEnvelope>(stream, JsonOptions, timeoutSource.Token); }
                catch (JsonException) { }
                if (envelope?.Error != null && !string.IsNullOrWhiteSpace(envelope.Error.Code))
                {
                    throw new AgerbotClientException(envelope.Error.Code, envelope.Error.Message, envelope.Error.Retryable);
                }
                throw new AgerbotClientException("invalid_response", $"Agerbot respondió HTTP {(int)response.StatusCode}.");
            }
            var payload = await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions, timeoutSource.Token);
            return payload ?? throw new AgerbotClientException("invalid_response", "Agerbot devolvió una respuesta vacía.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new AgerbotClientException("timeout", "Agerbot tardó demasiado en responder.");
        }
        catch (HttpRequestException exception)
        {
            throw new AgerbotClientException("unavailable", "El runtime local de Agerbot no está disponible.", inner: exception);
        }
    }

    public void Dispose()
    {
        if (_ownsClient) _httpClient.Dispose();
    }
}
