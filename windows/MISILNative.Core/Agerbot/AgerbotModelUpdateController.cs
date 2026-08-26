using System.ComponentModel;
using System.Runtime.CompilerServices;
using MISILNative.Core.Distribution;

namespace MISILNative.Core.Agerbot;

public sealed class AgerbotModelUpdateController : INotifyPropertyChanged, IDisposable
{
    private readonly string _managedRoot;
    private readonly AgerbotModelReleaseService _releases;
    private readonly AgerbotModelDownloadService _downloads;
    private readonly AgerbotModelInstallationManager _installation;
    private readonly IAgerbotCandidateValidator _validator;
    private readonly AgerbotSettingsStore _settings;
    private readonly AgerbotCurrentModelStore _currentStore;
    private readonly AgerbotFailedVersionStore _failedStore;
    private readonly AgerbotModelActivationService _activation;
    private readonly IAgerbotModelRuntimeActivator _runtimeActivator;
    private readonly SemaphoreSlim _operation = new(1, 1);
    private CancellationTokenSource? _cancellation;
    private AgerbotRemoteModelCandidate? _availableCandidate;
    private AgerbotModelUpdateState _state = new(AgerbotModelUpdateStatus.Idle, "Sin comprobar");

    public AgerbotModelUpdateController(
        string managedRoot,
        AgerbotModelReleaseService releases,
        AgerbotModelDownloadService downloads,
        AgerbotModelInstallationManager installation,
        IAgerbotCandidateValidator validator,
        AgerbotSettingsStore settings,
        AgerbotCurrentModelStore currentStore,
        AgerbotFailedVersionStore failedStore,
        AgerbotModelActivationService activation,
        IAgerbotModelRuntimeActivator runtimeActivator)
    {
        _managedRoot = Path.GetFullPath(managedRoot);
        _releases = releases;
        _downloads = downloads;
        _installation = installation;
        _validator = validator;
        _settings = settings;
        _currentStore = currentStore;
        _failedStore = failedStore;
        _activation = activation;
        _runtimeActivator = runtimeActivator;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public AgerbotModelUpdateState State
    {
        get => _state;
        private set { _state = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsBusy)); }
    }

    public bool IsBusy => State.Status is AgerbotModelUpdateStatus.Checking
        or AgerbotModelUpdateStatus.Downloading
        or AgerbotModelUpdateStatus.Verifying
        or AgerbotModelUpdateStatus.WaitingForConversation
        or AgerbotModelUpdateStatus.Activating
        or AgerbotModelUpdateStatus.RollingBack;

    public bool HasAvailableUpdate => _availableCandidate != null;

    public async Task CheckForUpdatesAsync(
        bool force = true,
        bool installAutomatically = false,
        ulong diskAvailableBytes = ulong.MaxValue,
        CancellationToken cancellationToken = default)
    {
        if (!await _operation.WaitAsync(0, cancellationToken)) return;
        _cancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        try
        {
            _availableCandidate = null;
            OnPropertyChanged(nameof(HasAvailableUpdate));
            if (!force && _settings.Settings.LastUpdateCheckAt is DateTimeOffset last
                && DateTimeOffset.UtcNow - last < TimeSpan.FromHours(6))
            {
                State = new(AgerbotModelUpdateStatus.Idle, "Comprobación reciente");
                return;
            }
            if (string.IsNullOrWhiteSpace(_settings.Settings.RuntimeVersion))
                throw new InvalidOperationException("Instala primero el runtime de Agerbot.");
            State = new(AgerbotModelUpdateStatus.Checking, "Buscando un modelo estable compatible…");
            _settings.Update(value => value.LastUpdateCheckAt = DateTimeOffset.UtcNow);
            var candidate = await _releases.LatestCompatibleAsync(
                _settings.Settings.RuntimeVersion,
                _settings.Settings.ActiveModelVersion,
                _settings.Settings.AllowPrereleaseModels,
                _cancellation.Token);
            string version = candidate.Manifest.Release.Version;
            if (await _failedStore.ContainsAsync(version, _cancellation.Token))
                throw new InvalidOperationException($"Agerbot {version} falló anteriormente y no se reinstalará automáticamente.");
            _availableCandidate = candidate;
            OnPropertyChanged(nameof(HasAvailableUpdate));
            State = new(AgerbotModelUpdateStatus.Available, $"Modelo Agerbot {version} disponible", version, candidate.Manifest.Artifact.SizeBytes);
            if (installAutomatically && _settings.Settings.AutomaticModelUpdates)
                await InstallAvailableUnsafeAsync(_cancellation.Token, diskAvailableBytes);
        }
        catch (OperationCanceledException)
        {
            State = new(AgerbotModelUpdateStatus.Cancelled, "Actualización cancelada");
        }
        catch (NoUpdateAvailableException exception)
        {
            State = new(AgerbotModelUpdateStatus.Idle, exception.Message);
        }
        catch (Exception exception)
        {
            State = new(AgerbotModelUpdateStatus.Failed, exception.Message);
        }
        finally { EndOperation(); }
    }

    public async Task InstallAvailableAsync(ulong diskAvailableBytes, CancellationToken cancellationToken = default)
    {
        if (_availableCandidate == null || !await _operation.WaitAsync(0, cancellationToken)) return;
        _cancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        try { await InstallAvailableUnsafeAsync(_cancellation.Token, diskAvailableBytes); }
        catch (OperationCanceledException)
        {
            State = new(AgerbotModelUpdateStatus.Cancelled, "Descarga cancelada; MISIL podrá reanudarla.");
        }
        catch (Exception exception)
        {
            State = new(AgerbotModelUpdateStatus.Failed, exception.Message);
        }
        finally { EndOperation(); }
    }

    public async Task RollbackAsync(CancellationToken cancellationToken = default)
    {
        string? previousVersion = _settings.Settings.PreviousModelVersion;
        if (string.IsNullOrWhiteSpace(previousVersion) || !await _operation.WaitAsync(0, cancellationToken)) return;
        _cancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        try
        {
            State = new(AgerbotModelUpdateStatus.RollingBack, $"Volviendo a Agerbot {previousVersion}", previousVersion);
            string runtimeVersion = _settings.Settings.RuntimeVersion
                ?? throw new InvalidOperationException("No hay un runtime instalado.");
            var discovery = new AgerbotModelDiscoveryService(runtimeVersion);
            var models = await discovery.DiscoverAsync(_managedRoot, cancellationToken: _cancellation.Token);
            var model = models.FirstOrDefault(item => item.Manifest.Model.Version == previousVersion)
                ?? throw new InvalidOperationException("La versión anterior ya no está disponible localmente.");
            var current = await CurrentRecordAsync(_cancellation.Token);
            var target = new AgerbotCurrentModelRecord
            {
                ActiveVersion = previousVersion,
                PreviousVersion = current?.ActiveVersion,
                ActivatedAt = DateTimeOffset.UtcNow,
                CheckpointPath = model.CheckpointPath,
                ManifestPath = model.ManifestPath
            };
            bool success = await _activation.ActivateAsync(target, current, _runtimeActivator, _cancellation.Token);
            State = success
                ? new(AgerbotModelUpdateStatus.Installed, $"Agerbot {previousVersion} está activo", previousVersion, Progress: 1)
                : new(AgerbotModelUpdateStatus.Failed, "No se pudo volver al modelo anterior.");
        }
        catch (OperationCanceledException) { State = new(AgerbotModelUpdateStatus.Cancelled, "Rollback cancelado"); }
        catch (Exception exception) { State = new(AgerbotModelUpdateStatus.Failed, exception.Message); }
        finally { EndOperation(); }
    }

    public async Task RepairAsync(CancellationToken cancellationToken = default)
    {
        if (!await _operation.WaitAsync(0, cancellationToken)) return;
        _cancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        try
        {
            string runtimeVersion = _settings.Settings.RuntimeVersion
                ?? throw new InvalidOperationException("No hay un runtime instalado.");
            State = new(AgerbotModelUpdateStatus.Verifying, "Verificando la instalación administrada…");
            var discovery = new AgerbotModelDiscoveryService(runtimeVersion);
            var models = await discovery.DiscoverAsync(_managedRoot, cancellationToken: _cancellation.Token);
            var model = models.FirstOrDefault(item => item.Manifest.Model.Version == _settings.Settings.ActiveModelVersion)
                ?? discovery.Select(models, _settings.Settings.PinnedModelVersion, true, _settings.Settings.AllowPrereleaseModels)
                ?? throw new InvalidOperationException("No hay un modelo local válido para reparar.");
            bool valid = await ValidateWithCpuFallbackAsync(
                model.CheckpointPath,
                model.Manifest.Model.Version,
                _cancellation.Token);
            if (!valid) throw new InvalidOperationException("La instalación local no superó la validación aislada.");
            var previous = await CurrentRecordAsync(_cancellation.Token);
            var record = new AgerbotCurrentModelRecord
            {
                ActiveVersion = model.Manifest.Model.Version,
                PreviousVersion = previous?.ActiveVersion == model.Manifest.Model.Version
                    ? previous.PreviousVersion
                    : previous?.ActiveVersion,
                ActivatedAt = DateTimeOffset.UtcNow,
                CheckpointPath = model.CheckpointPath,
                ManifestPath = model.ManifestPath
            };
            State = new(AgerbotModelUpdateStatus.Activating, "Reiniciando el runtime verificado", record.ActiveVersion);
            if (!await _activation.ActivateAsync(record, previous, _runtimeActivator, _cancellation.Token))
                throw new InvalidOperationException("La reparación falló; MISIL restauró el estado anterior.");
            State = new(AgerbotModelUpdateStatus.Installed, "Instalación de Agerbot reparada", record.ActiveVersion, Progress: 1);
        }
        catch (OperationCanceledException) { State = new(AgerbotModelUpdateStatus.Cancelled, "Reparación cancelada"); }
        catch (Exception exception) { State = new(AgerbotModelUpdateStatus.Failed, exception.Message); }
        finally { EndOperation(); }
    }

    public void Cancel() => _cancellation?.Cancel();

    private async Task InstallAvailableUnsafeAsync(CancellationToken cancellationToken, ulong diskAvailableBytes = ulong.MaxValue)
    {
        var candidate = _availableCandidate ?? throw new InvalidOperationException("No hay una actualización seleccionada.");
        string version = candidate.Manifest.Release.Version;
        State = new(AgerbotModelUpdateStatus.Downloading, $"Descargando Agerbot {version}…", version, candidate.Manifest.Artifact.SizeBytes);
        var progress = new Progress<double>(value =>
            State = new(AgerbotModelUpdateStatus.Downloading, $"Descargando Agerbot {version}… {value:P0}", version, candidate.Manifest.Artifact.SizeBytes, value));
        var downloaded = await _downloads.DownloadAsync(candidate, diskAvailableBytes, progress, cancellationToken);
        State = new(AgerbotModelUpdateStatus.Verifying, "SHA-256 correcto; preparando el candidato", version);
        var installed = await _installation.InstallCandidateAsync(candidate, downloaded.Checkpoint, downloaded.Evaluation, cancellationToken);
        State = new(AgerbotModelUpdateStatus.Verifying, "Probando carga, salud y una generación aislada", version);
        bool valid = await ValidateWithCpuFallbackAsync(installed.CheckpointPath, version, cancellationToken);
        if (!valid)
        {
            await _failedStore.MarkFailedAsync(version, "Falló la validación aislada de carga, salud o generación.", cancellationToken);
            throw new InvalidOperationException("El modelo candidato no superó la prueba aislada del runtime.");
        }
        State = new(AgerbotModelUpdateStatus.WaitingForConversation, "Esperando a que termine la generación activa", version);
        var previous = await CurrentRecordAsync(cancellationToken);
        var record = new AgerbotCurrentModelRecord
        {
            ActiveVersion = version,
            PreviousVersion = previous?.ActiveVersion,
            ActivatedAt = DateTimeOffset.UtcNow,
            CheckpointPath = installed.CheckpointPath,
            ManifestPath = installed.ManifestPath
        };
        State = new(AgerbotModelUpdateStatus.Activating, $"Activando Agerbot {version}", version);
        bool activated = await _activation.ActivateAsync(record, previous, _runtimeActivator, cancellationToken);
        if (!activated) throw new InvalidOperationException("La activación falló; MISIL restauró el modelo anterior.");
        _installation.PruneOldModels(record.ActiveVersion, record.PreviousVersion);
        _availableCandidate = null;
        OnPropertyChanged(nameof(HasAvailableUpdate));
        State = new(AgerbotModelUpdateStatus.Installed, $"Agerbot {version} está instalado y activo", version, Progress: 1);
    }

    private async Task<bool> ValidateWithCpuFallbackAsync(
        string checkpointPath,
        string version,
        CancellationToken cancellationToken)
    {
        bool valid = await _validator.ValidateAsync(
            _settings.Settings.RuntimeExecutablePath,
            checkpointPath,
            version,
            _settings.Settings.RequestedDevice,
            cancellationToken);
        if (!valid
            && !_settings.Settings.RequestedDevice.Equals("cpu", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(_settings.Settings.CpuRuntimeExecutablePath)
            && !_settings.Settings.CpuRuntimeExecutablePath.Equals(_settings.Settings.RuntimeExecutablePath, StringComparison.OrdinalIgnoreCase))
        {
            valid = await _validator.ValidateAsync(
                _settings.Settings.CpuRuntimeExecutablePath,
                checkpointPath,
                version,
                "cpu",
                cancellationToken);
        }
        return valid;
    }

    private async Task<AgerbotCurrentModelRecord?> CurrentRecordAsync(CancellationToken cancellationToken)
    {
        var stored = await _currentStore.LoadAsync(cancellationToken);
        if (stored != null) return stored;
        if (string.IsNullOrWhiteSpace(_settings.Settings.ActiveModelVersion)
            || string.IsNullOrWhiteSpace(_settings.Settings.CheckpointPath)) return null;
        return new AgerbotCurrentModelRecord
        {
            ActiveVersion = _settings.Settings.ActiveModelVersion,
            PreviousVersion = _settings.Settings.PreviousModelVersion,
            ActivatedAt = DateTimeOffset.UtcNow,
            CheckpointPath = _settings.Settings.CheckpointPath,
            ManifestPath = Path.Combine(Path.GetDirectoryName(_settings.Settings.CheckpointPath)!, "manifest.json")
        };
    }

    private void EndOperation()
    {
        _cancellation?.Dispose();
        _cancellation = null;
        _operation.Release();
    }

    private void OnPropertyChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    public void Dispose()
    {
        Cancel();
        _releases.Dispose();
        _operation.Dispose();
    }
}
