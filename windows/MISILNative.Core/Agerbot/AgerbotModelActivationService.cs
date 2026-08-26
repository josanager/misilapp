using System.Text.Json;

namespace MISILNative.Core.Agerbot;

public sealed class AgerbotActivationGate
{
    private readonly object _sync = new();
    private int _activeGenerations;
    private TaskCompletionSource _idle = NewIdleSource(completed: true);

    public void BeginGeneration()
    {
        lock (_sync)
        {
            if (_activeGenerations++ == 0) _idle = NewIdleSource(completed: false);
        }
    }

    public void EndGeneration()
    {
        TaskCompletionSource? completion = null;
        lock (_sync)
        {
            _activeGenerations = Math.Max(0, _activeGenerations - 1);
            if (_activeGenerations == 0) completion = _idle;
        }
        completion?.TrySetResult();
    }

    public Task WaitUntilIdleAsync(CancellationToken cancellationToken = default)
    {
        Task task;
        lock (_sync) task = _idle.Task;
        return task.WaitAsync(cancellationToken);
    }

    public bool IsBusy
    {
        get { lock (_sync) return _activeGenerations > 0; }
    }

    private static TaskCompletionSource NewIdleSource(bool completed)
    {
        var source = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        if (completed) source.SetResult();
        return source;
    }
}

public sealed class AgerbotCurrentModelStore
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly string _filePath;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public AgerbotCurrentModelStore(string filePath) => _filePath = filePath;

    public async Task<AgerbotCurrentModelRecord?> LoadAsync(CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            if (!File.Exists(_filePath)) return null;
            await using var stream = File.OpenRead(_filePath);
            return await JsonSerializer.DeserializeAsync<AgerbotCurrentModelRecord>(stream, Options, cancellationToken);
        }
        catch (JsonException) { return null; }
        catch (IOException) { return null; }
        finally { _lock.Release(); }
    }

    public async Task WriteAsync(AgerbotCurrentModelRecord record, CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
            string temporary = _filePath + ".tmp";
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(record, Options), cancellationToken);
            File.Move(temporary, _filePath, overwrite: true);
        }
        finally { _lock.Release(); }
    }

    public async Task DeleteAsync(CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken);
        try { if (File.Exists(_filePath)) File.Delete(_filePath); }
        finally { _lock.Release(); }
    }
}

public sealed class AgerbotFailedVersionStore
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly string _filePath;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public AgerbotFailedVersionStore(string filePath) => _filePath = filePath;

    public async Task<bool> ContainsAsync(string version, CancellationToken cancellationToken = default) =>
        (await LoadAsync(cancellationToken)).FailedVersions.ContainsKey(version);

    public async Task MarkFailedAsync(string version, string reason, CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            var state = await LoadUnsafeAsync(cancellationToken);
            state.FailedVersions[version] = reason;
            state.UpdatedAt = DateTimeOffset.UtcNow;
            Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
            string temporary = _filePath + ".tmp";
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(state, Options), cancellationToken);
            File.Move(temporary, _filePath, overwrite: true);
        }
        finally { _lock.Release(); }
    }

    private async Task<AgerbotPersistedUpdateState> LoadAsync(CancellationToken cancellationToken)
    {
        await _lock.WaitAsync(cancellationToken);
        try { return await LoadUnsafeAsync(cancellationToken); }
        finally { _lock.Release(); }
    }

    private async Task<AgerbotPersistedUpdateState> LoadUnsafeAsync(CancellationToken cancellationToken)
    {
        try
        {
            if (!File.Exists(_filePath)) return new();
            await using var stream = File.OpenRead(_filePath);
            return await JsonSerializer.DeserializeAsync<AgerbotPersistedUpdateState>(stream, Options, cancellationToken) ?? new();
        }
        catch (JsonException) { return new(); }
        catch (IOException) { return new(); }
    }
}

public interface IAgerbotModelRuntimeActivator
{
    Task<bool> ActivateAsync(AgerbotCurrentModelRecord record, CancellationToken cancellationToken = default);
    Task DeactivateAsync(CancellationToken cancellationToken = default);
}

public sealed class AgerbotModelActivationService
{
    private readonly AgerbotActivationGate _gate;
    private readonly AgerbotCurrentModelStore _currentStore;
    private readonly AgerbotFailedVersionStore _failedStore;

    public AgerbotModelActivationService(
        AgerbotActivationGate gate,
        AgerbotCurrentModelStore currentStore,
        AgerbotFailedVersionStore failedStore)
    {
        _gate = gate;
        _currentStore = currentStore;
        _failedStore = failedStore;
    }

    public async Task<bool> ActivateAsync(
        AgerbotCurrentModelRecord candidate,
        AgerbotCurrentModelRecord? previous,
        IAgerbotModelRuntimeActivator runtime,
        CancellationToken cancellationToken = default)
    {
        await _gate.WaitUntilIdleAsync(cancellationToken);
        await _currentStore.WriteAsync(candidate, cancellationToken);
        if (await runtime.ActivateAsync(candidate, cancellationToken)) return true;
        await _failedStore.MarkFailedAsync(
            candidate.ActiveVersion,
            "El runtime no confirmó la versión después de activarla.",
            cancellationToken);
        if (previous == null)
        {
            await _currentStore.DeleteAsync(cancellationToken);
            await runtime.DeactivateAsync(cancellationToken);
            return false;
        }
        await _currentStore.WriteAsync(previous, cancellationToken);
        await runtime.ActivateAsync(previous, cancellationToken);
        return false;
    }
}
