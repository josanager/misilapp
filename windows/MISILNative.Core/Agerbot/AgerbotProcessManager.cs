using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace MISILNative.Core.Agerbot;

public interface IAgerbotManagedProcess : IDisposable
{
    int Id { get; }
    bool HasExited { get; }
    int? ExitCode { get; }
    DateTimeOffset StartedAt { get; }
    event EventHandler? Exited;
    void KillEntireTree();
}

public interface IAgerbotProcessLauncher
{
    IAgerbotManagedProcess Start(ProcessStartInfo startInfo);
}

public sealed class SystemAgerbotProcessLauncher : IAgerbotProcessLauncher
{
    public IAgerbotManagedProcess Start(ProcessStartInfo startInfo)
    {
        var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        if (!process.Start())
        {
            process.Dispose();
            throw new InvalidOperationException("Windows no pudo iniciar el runtime de Agerbot.");
        }
        return new SystemManagedProcess(process);
    }

    private sealed class SystemManagedProcess : IAgerbotManagedProcess
    {
        private readonly Process _process;

        public SystemManagedProcess(Process process)
        {
            _process = process;
            _process.Exited += (_, _) => Exited?.Invoke(this, EventArgs.Empty);
        }

        public int Id => _process.Id;
        public bool HasExited
        {
            get
            {
                try { return _process.HasExited; }
                catch (InvalidOperationException) { return true; }
            }
        }
        public int? ExitCode => HasExited ? _process.ExitCode : null;
        public DateTimeOffset StartedAt => _process.StartTime.ToUniversalTime();
        public event EventHandler? Exited;

        public void KillEntireTree()
        {
            if (!HasExited) _process.Kill(entireProcessTree: true);
        }

        public void Dispose() => _process.Dispose();
    }
}

public sealed class ManagedRuntimeMetadataStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly string _filePath;

    public ManagedRuntimeMetadataStore(string filePath) => _filePath = filePath;

    public ManagedRuntimeMetadata? Load()
    {
        try
        {
            return File.Exists(_filePath)
                ? JsonSerializer.Deserialize<ManagedRuntimeMetadata>(File.ReadAllText(_filePath), JsonOptions)
                : null;
        }
        catch { return null; }
    }

    public void Write(ManagedRuntimeMetadata metadata)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
        string temporary = _filePath + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(metadata, JsonOptions));
        File.Move(temporary, _filePath, overwrite: true);
    }

    public void Clear()
    {
        try { if (File.Exists(_filePath)) File.Delete(_filePath); }
        catch { }
    }

    public bool TryTerminateRecordedOrphan()
    {
        var metadata = Load();
        if (metadata == null || metadata.ProcessId <= 0 || string.IsNullOrWhiteSpace(metadata.ExecutablePath))
        {
            Clear();
            return false;
        }
        try
        {
            using var process = Process.GetProcessById(metadata.ProcessId);
            DateTimeOffset actualStart = process.StartTime.ToUniversalTime();
            if (Math.Abs((actualStart - metadata.StartedAt).TotalSeconds) > 2)
            {
                Clear();
                return false;
            }
            string? actualPath = process.MainModule?.FileName;
            if (string.IsNullOrWhiteSpace(actualPath)
                || !Path.GetFullPath(actualPath).Equals(Path.GetFullPath(metadata.ExecutablePath), StringComparison.OrdinalIgnoreCase))
            {
                Clear();
                return false;
            }
            process.Kill(entireProcessTree: true);
            process.WaitForExit(5_000);
            Clear();
            return true;
        }
        catch
        {
            Clear();
            return false;
        }
    }
}

public interface IAgerbotProcessManager
{
    AgerbotRuntimeState State { get; }
    Task StartAsync(AgerbotSettings settings, CancellationToken cancellationToken = default);
    Task StopAsync(CancellationToken cancellationToken = default);
}

public sealed class AgerbotProcessManager : IAgerbotProcessManager, INotifyPropertyChanged, IAsyncDisposable
{
    private readonly IAgerbotRuntimeClient _client;
    private readonly IAgerbotProcessLauncher _launcher;
    private readonly ManagedRuntimeMetadataStore _metadataStore;
    private readonly int _maximumHealthAttempts;
    private readonly TimeSpan _healthInterval;
    private readonly SemaphoreSlim _lifecycle = new(1, 1);
    private IAgerbotManagedProcess? _managedProcess;
    private AgerbotRuntimeState _state = AgerbotRuntimeState.Stopped;

    public event PropertyChangedEventHandler? PropertyChanged;

    public AgerbotRuntimeState State
    {
        get => _state;
        private set
        {
            _state = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(State)));
        }
    }

    public AgerbotProcessManager(
        IAgerbotRuntimeClient client,
        IAgerbotProcessLauncher? launcher = null,
        ManagedRuntimeMetadataStore? metadataStore = null,
        int maximumHealthAttempts = 80,
        TimeSpan? healthInterval = null)
    {
        _client = client;
        _launcher = launcher ?? new SystemAgerbotProcessLauncher();
        string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MISIL", "Agerbot", "runtime");
        _metadataStore = metadataStore ?? new ManagedRuntimeMetadataStore(Path.Combine(root, "managed-process.json"));
        _maximumHealthAttempts = maximumHealthAttempts;
        _healthInterval = healthInterval ?? TimeSpan.FromMilliseconds(250);
    }

    public async Task StartAsync(AgerbotSettings settings, CancellationToken cancellationToken = default)
    {
        await _lifecycle.WaitAsync(cancellationToken);
        try
        {
            if (State.IsReady)
            {
                var current = await TryHealthAsync(cancellationToken);
                if (current?.Model.Loaded == true)
                {
                    State = new(AgerbotRuntimeStatus.Ready, $"Listo · {current.Model.Device.ToUpperInvariant()}", 1, current);
                    return;
                }
                await StopManagedProcessUnsafeAsync();
            }
            _metadataStore.TryTerminateRecordedOrphan();
            var existingHealth = await TryHealthAsync(cancellationToken);
            if (existingHealth?.Model.Loaded == true)
            {
                State = new(AgerbotRuntimeStatus.Ready, "Runtime local disponible", 1, existingHealth);
                return;
            }
            if (await _client.HasHttpServiceOnRuntimePortAsync(cancellationToken))
            {
                State = new(AgerbotRuntimeStatus.PortConflict, "El puerto 4318 está ocupado por otro servicio.");
                return;
            }
            if (string.IsNullOrWhiteSpace(settings.RuntimeExecutablePath)
                || string.IsNullOrWhiteSpace(settings.CheckpointPath)
                || !File.Exists(settings.RuntimeExecutablePath)
                || !File.Exists(settings.CheckpointPath))
            {
                State = new(AgerbotRuntimeStatus.NotInstalled, "Agerbot todavía no está instalado.");
                return;
            }

            string requestedDevice = string.IsNullOrWhiteSpace(settings.RequestedDevice) ? "auto" : settings.RequestedDevice;
            var firstAttempt = await StartManagedAttemptUnsafeAsync(settings, requestedDevice, cancellationToken);
            if (firstAttempt.Success) return;
            if (!requestedDevice.Equals("cpu", StringComparison.OrdinalIgnoreCase))
            {
                State = new(AgerbotRuntimeStatus.Starting, "CUDA no quedó disponible; reintentando con CPU", 0.12);
                var fallback = await StartManagedAttemptUnsafeAsync(settings, "cpu", cancellationToken);
                if (fallback.Success) return;
                State = new(AgerbotRuntimeStatus.Failed, $"Falló CUDA ({firstAttempt.Failure}) y también CPU ({fallback.Failure}).");
                return;
            }
            State = new(AgerbotRuntimeStatus.Failed, firstAttempt.Failure);
        }
        catch (OperationCanceledException)
        {
            await StopManagedProcessUnsafeAsync();
            State = AgerbotRuntimeState.Stopped;
            throw;
        }
        finally
        {
            _lifecycle.Release();
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken = default)
    {
        await _lifecycle.WaitAsync(cancellationToken);
        try
        {
            State = new(AgerbotRuntimeStatus.Stopping, "Deteniendo Agerbot");
            await StopManagedProcessUnsafeAsync();
            State = AgerbotRuntimeState.Stopped;
        }
        finally
        {
            _lifecycle.Release();
        }
    }

    private async Task<(bool Success, string Failure)> StartManagedAttemptUnsafeAsync(
        AgerbotSettings settings,
        string requestedDevice,
        CancellationToken cancellationToken)
    {
        State = new(AgerbotRuntimeStatus.Starting, requestedDevice == "cpu" ? "Preparando Agerbot en CPU" : "Preparando el runtime local", 0.12);
        string runtimePath = ResolveRuntimePath(settings, requestedDevice);
        var startInfo = BuildStartInfo(settings, runtimePath, requestedDevice);
        try
        {
            _managedProcess = _launcher.Start(startInfo);
            _metadataStore.Write(new ManagedRuntimeMetadata
            {
                ProcessId = _managedProcess.Id,
                StartedAt = _managedProcess.StartedAt,
                ExecutablePath = Path.GetFullPath(runtimePath),
                CheckpointPath = Path.GetFullPath(settings.CheckpointPath)
            });
        }
        catch (Exception exception)
        {
            return (false, $"MISIL no pudo iniciar Agerbot: {exception.Message}");
        }

        for (int attempt = 1; attempt <= _maximumHealthAttempts; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var process = _managedProcess;
            if (process == null || process.HasExited)
            {
                int? exitCode = process?.ExitCode;
                CleanupManagedProcess();
                return (false, $"Agerbot terminó durante el arranque (código {exitCode?.ToString() ?? "desconocido"}).");
            }
            var health = await TryHealthAsync(cancellationToken);
            if (health?.Model.Loaded == true)
            {
                process.Exited += OnManagedProcessExited;
                State = new(AgerbotRuntimeStatus.Ready, $"Listo · {health.Model.Device.ToUpperInvariant()}", 1, health);
                return (true, string.Empty);
            }
            double progress = Math.Min(0.92, 0.28 + (double)attempt / (_maximumHealthAttempts * 1.5));
            State = new(AgerbotRuntimeStatus.Loading, requestedDevice == "cpu" ? "Cargando el modelo en CPU" : "Verificando y cargando el modelo", progress);
            await Task.Delay(_healthInterval, cancellationToken);
        }
        await StopManagedProcessUnsafeAsync();
        return (false, "Agerbot no quedó listo dentro del tiempo permitido.");
    }

    private static string ResolveRuntimePath(AgerbotSettings settings, string requestedDevice)
    {
        if (requestedDevice.Equals("cpu", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(settings.CpuRuntimeExecutablePath))
            return settings.CpuRuntimeExecutablePath;
        if (!requestedDevice.Equals("cpu", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(settings.CudaRuntimeExecutablePath))
            return settings.CudaRuntimeExecutablePath;
        return settings.RuntimeExecutablePath;
    }

    private static ProcessStartInfo BuildStartInfo(AgerbotSettings settings, string runtimeExecutablePath, string requestedDevice)
    {
        string runtimePath = Path.GetFullPath(runtimeExecutablePath);
        var startInfo = new ProcessStartInfo(runtimePath)
        {
            WorkingDirectory = Path.GetDirectoryName(runtimePath)!,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = false,
            RedirectStandardError = false
        };
        startInfo.Environment["AGERBOT_CHECKPOINT"] = Path.GetFullPath(settings.CheckpointPath);
        startInfo.Environment["AGERBOT_HOST"] = "127.0.0.1";
        startInfo.Environment["AGERBOT_PORT"] = "4318";
        startInfo.Environment["AGERBOT_DEVICE"] = requestedDevice;
        startInfo.Environment["PYTHONUNBUFFERED"] = "1";
        return startInfo;
    }

    private async Task<AgerbotHealthResponse?> TryHealthAsync(CancellationToken cancellationToken)
    {
        try { return await _client.HealthAsync(cancellationToken); }
        catch (AgerbotClientException) { return null; }
    }

    private Task StopManagedProcessUnsafeAsync()
    {
        if (_managedProcess != null)
        {
            _managedProcess.Exited -= OnManagedProcessExited;
            try { _managedProcess.KillEntireTree(); }
            catch { }
            CleanupManagedProcess();
        }
        else
        {
            _metadataStore.Clear();
        }
        return Task.CompletedTask;
    }

    private void OnManagedProcessExited(object? sender, EventArgs e)
    {
        if (_managedProcess == null) return;
        CleanupManagedProcess();
        if (State.Status is not AgerbotRuntimeStatus.Stopping and not AgerbotRuntimeStatus.Stopped)
        {
            State = new(AgerbotRuntimeStatus.Failed, "Agerbot se cerró inesperadamente. MISIL sigue disponible.");
        }
    }

    private void CleanupManagedProcess()
    {
        _managedProcess?.Dispose();
        _managedProcess = null;
        _metadataStore.Clear();
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync();
        _lifecycle.Dispose();
    }
}
