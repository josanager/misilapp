using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace MISILNative.Core.Distribution;

public sealed class MisilUpdateController : INotifyPropertyChanged, IDisposable
{
    private readonly MisilUpdateService _service;
    private readonly string _installedVersion;
    private readonly string _updatesRoot;
    private readonly SemaphoreSlim _operation = new(1, 1);
    private CancellationTokenSource? _cancellation;
    private MisilUpdateCandidate? _candidate;
    private MisilUpdateState _state = new(MisilUpdateStatus.Idle, "Sin comprobar");

    public MisilUpdateController(string installedVersion, string updatesRoot, MisilUpdateService? service = null)
    {
        _installedVersion = SemanticVersion.Parse(installedVersion).ToString();
        _updatesRoot = Path.GetFullPath(updatesRoot);
        _service = service ?? new MisilUpdateService();
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public string InstalledVersion => _installedVersion;
    public string ReleaseNotes => _candidate?.ReleaseNotes ?? string.Empty;
    public bool IsBusy => State.Status is MisilUpdateStatus.Checking or MisilUpdateStatus.Downloading;

    public MisilUpdateState State
    {
        get => _state;
        private set { _state = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsBusy)); OnPropertyChanged(nameof(ReleaseNotes)); }
    }

    public async Task CheckAsync(bool allowPrerelease, Version windowsVersion, CancellationToken cancellationToken = default)
    {
        if (!await _operation.WaitAsync(0, cancellationToken)) return;
        _cancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        try
        {
            _candidate = null;
            State = new(MisilUpdateStatus.Checking, "Buscando una release estable de MISIL…");
            _candidate = await _service.LatestCompatibleAsync(_installedVersion, allowPrerelease, windowsVersion, _cancellation.Token);
            State = new(
                MisilUpdateStatus.Available,
                $"MISIL {_candidate.Manifest.Version} está disponible",
                _candidate.Manifest.Version,
                _candidate.Manifest.SizeBytes);
        }
        catch (OperationCanceledException) { State = new(MisilUpdateStatus.Cancelled, "Comprobación cancelada"); }
        catch (NoUpdateAvailableException exception) { State = new(MisilUpdateStatus.Idle, exception.Message); }
        catch (Exception exception) { State = new(MisilUpdateStatus.Failed, exception.Message); }
        finally { EndOperation(); }
    }

    public async Task DownloadAsync(CancellationToken cancellationToken = default)
    {
        if (_candidate == null || !await _operation.WaitAsync(0, cancellationToken)) return;
        _cancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        try
        {
            var progress = new Progress<double>(value => State = new(
                MisilUpdateStatus.Downloading,
                $"Descargando MISIL {_candidate.Manifest.Version}… {value:P0}",
                _candidate.Manifest.Version,
                _candidate.Manifest.SizeBytes,
                value));
            string installer = await _service.DownloadAsync(_candidate, _updatesRoot, progress, _cancellation.Token);
            State = new(
                MisilUpdateStatus.ReadyToInstall,
                "Actualización verificada. Lista para actualizar y reiniciar.",
                _candidate.Manifest.Version,
                _candidate.Manifest.SizeBytes,
                1,
                installer);
        }
        catch (OperationCanceledException) { State = new(MisilUpdateStatus.Cancelled, "Descarga cancelada; podrá reanudarse."); }
        catch (Exception exception) { State = new(MisilUpdateStatus.Failed, exception.Message); }
        finally { EndOperation(); }
    }

    public MisilUpdaterLaunchPlan CreateLaunchPlan(int processId, string installDirectory, string relaunchExecutable)
    {
        if (_candidate == null || State.Status != MisilUpdateStatus.ReadyToInstall || string.IsNullOrWhiteSpace(State.InstallerPath))
            throw new InvalidOperationException("La actualización todavía no está lista.");
        return new(
            processId,
            State.InstallerPath,
            _candidate.Manifest.Sha256,
            _candidate.Manifest.SizeBytes,
            Path.GetFullPath(installDirectory),
            Path.GetFullPath(relaunchExecutable),
            _candidate.Manifest.SilentArguments);
    }

    public void Cancel() => _cancellation?.Cancel();

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
        _service.Dispose();
        _operation.Dispose();
    }
}

public static class MisilExternalUpdaterLauncher
{
    public static int Launch(string updaterExecutable, string updatesRoot, MisilUpdaterLaunchPlan plan)
    {
        if (!File.Exists(updaterExecutable)) throw new FileNotFoundException("No se encontró el actualizador externo de MISIL.", updaterExecutable);
        string root = Path.GetFullPath(updatesRoot);
        Directory.CreateDirectory(root);
        string updaterCopy = Path.Combine(root, $"MISIL.Updater-{Guid.NewGuid():N}.exe");
        File.Copy(updaterExecutable, updaterCopy, overwrite: false);
        string planPath = Path.Combine(root, $"update-plan-{Guid.NewGuid():N}.json");
        string temporary = planPath + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(plan, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true }));
        File.Move(temporary, planPath);
        var startInfo = new System.Diagnostics.ProcessStartInfo(updaterCopy)
        {
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden
        };
        startInfo.ArgumentList.Add("--plan");
        startInfo.ArgumentList.Add(planPath);
        using var process = System.Diagnostics.Process.Start(startInfo)
            ?? throw new InvalidOperationException("Windows no pudo iniciar el actualizador externo de MISIL.");
        return process.Id;
    }
}
