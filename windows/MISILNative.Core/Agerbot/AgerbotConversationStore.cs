using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace MISILNative.Core.Agerbot;

public sealed class AgerbotConversationStore : INotifyPropertyChanged
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    private readonly IAgerbotRuntimeClient _client;
    private readonly IAgerbotProcessManager _processManager;
    private readonly AgerbotSettingsStore _settingsStore;
    private readonly AgerbotActivationGate? _activationGate;
    private readonly string _filePath;
    private readonly SemaphoreSlim _generationLock = new(1, 1);
    private CancellationTokenSource? _generationCancellation;
    private AgerbotConversationStatus _status = AgerbotConversationStatus.Idle;
    private string? _errorMessage;

    public event PropertyChangedEventHandler? PropertyChanged;
    public ObservableCollection<AgerbotLocalMessage> Messages { get; } = [];

    public AgerbotConversationStatus Status
    {
        get => _status;
        private set { _status = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsGenerating)); }
    }

    public string? ErrorMessage
    {
        get => _errorMessage;
        private set { _errorMessage = value; OnPropertyChanged(); }
    }

    public bool IsGenerating => Status is AgerbotConversationStatus.Starting
        or AgerbotConversationStatus.Thinking
        or AgerbotConversationStatus.Cancelling;

    public AgerbotConversationStore(
        IAgerbotRuntimeClient client,
        IAgerbotProcessManager processManager,
        AgerbotSettingsStore settingsStore,
        string? filePath = null,
        AgerbotActivationGate? activationGate = null)
    {
        _client = client;
        _processManager = processManager;
        _settingsStore = settingsStore;
        _activationGate = activationGate;
        string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MISIL");
        _filePath = filePath ?? Path.Combine(root, "agerbot-conversation.json");
        Load();
    }

    public async Task SendAsync(string content, CancellationToken cancellationToken = default)
    {
        string message = content.Trim();
        if (string.IsNullOrEmpty(message) || !_generationLock.Wait(0)) return;
        _activationGate?.BeginGeneration();
        try
        {
            ErrorMessage = null;
            var history = Messages.TakeLast(16).Select(item => new AgerbotHistoryItem
            {
                Role = item.Role == AgerbotMessageRole.User ? "user" : "assistant",
                Content = item.Content
            }).ToList();
            Append(new AgerbotLocalMessage
            {
                Role = AgerbotMessageRole.User,
                Content = message,
                CreatedAt = DateTimeOffset.UtcNow
            });

            _generationCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            if (!_processManager.State.IsReady)
            {
                Status = AgerbotConversationStatus.Starting;
                await _processManager.StartAsync(_settingsStore.Settings, _generationCancellation.Token);
            }
            if (!_processManager.State.IsReady)
            {
                Status = AgerbotConversationStatus.Unavailable;
                ErrorMessage = _processManager.State.Detail;
                return;
            }

            Status = AgerbotConversationStatus.Thinking;
            var response = await _client.ChatAsync(new AgerbotChatRequest
            {
                ConversationId = AgerbotConstants.ReservedConversationId,
                Message = message,
                History = history,
                Generation = _settingsStore.Settings.Generation
            }, _generationCancellation.Token);
            Append(new AgerbotLocalMessage
            {
                Role = AgerbotMessageRole.Assistant,
                Content = response.Message.Content,
                CreatedAt = DateTimeOffset.UtcNow
            });
            Status = AgerbotConversationStatus.Idle;
        }
        catch (OperationCanceledException)
        {
            Status = AgerbotConversationStatus.Idle;
        }
        catch (AgerbotClientException exception)
        {
            Status = exception.Code == "unavailable"
                ? AgerbotConversationStatus.Unavailable
                : AgerbotConversationStatus.Failed;
            ErrorMessage = exception.Message;
        }
        catch (Exception exception)
        {
            Status = AgerbotConversationStatus.Failed;
            ErrorMessage = exception.Message;
        }
        finally
        {
            _generationCancellation?.Dispose();
            _generationCancellation = null;
            _generationLock.Release();
            _activationGate?.EndGeneration();
        }
    }

    public async Task CancelAsync()
    {
        if (!IsGenerating) return;
        Status = AgerbotConversationStatus.Cancelling;
        _generationCancellation?.Cancel();
        try { await _client.CancelAsync(); }
        catch (AgerbotClientException) { }
    }

    public async Task RetryRuntimeAsync(CancellationToken cancellationToken = default)
    {
        if (IsGenerating) return;
        Status = AgerbotConversationStatus.Starting;
        ErrorMessage = null;
        await _processManager.StartAsync(_settingsStore.Settings, cancellationToken);
        if (_processManager.State.IsReady)
        {
            Status = AgerbotConversationStatus.Idle;
        }
        else
        {
            Status = AgerbotConversationStatus.Unavailable;
            ErrorMessage = _processManager.State.Detail;
        }
    }

    private void Append(AgerbotLocalMessage message)
    {
        Messages.Add(message);
        Save();
        OnPropertyChanged(nameof(Messages));
    }

    private void Load()
    {
        try
        {
            if (!File.Exists(_filePath)) return;
            var messages = JsonSerializer.Deserialize<List<AgerbotLocalMessage>>(File.ReadAllText(_filePath), JsonOptions);
            if (messages == null) return;
            foreach (var message in messages.OrderBy(item => item.CreatedAt)) Messages.Add(message);
        }
        catch (JsonException) { }
        catch (IOException) { }
    }

    private void Save()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
            string temporary = _filePath + ".tmp";
            File.WriteAllText(temporary, JsonSerializer.Serialize(Messages.ToList(), JsonOptions));
            File.Move(temporary, _filePath, overwrite: true);
        }
        catch (IOException)
        {
            Status = AgerbotConversationStatus.Failed;
            ErrorMessage = "MISIL no pudo guardar la conversación local de Agerbot.";
        }
    }

    private void OnPropertyChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
