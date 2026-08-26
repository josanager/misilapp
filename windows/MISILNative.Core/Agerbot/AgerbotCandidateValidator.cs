using System.Diagnostics;
using System.Net;
using System.Net.Sockets;

namespace MISILNative.Core.Agerbot;

public interface IAgerbotCandidateValidator
{
    Task<bool> ValidateAsync(
        string runtimeExecutablePath,
        string checkpointPath,
        string expectedVersion,
        string requestedDevice,
        CancellationToken cancellationToken = default);
}

public interface IAgerbotRuntimeClientFactory
{
    IAgerbotRuntimeClient Create(Uri baseUri);
}

public sealed class AgerbotRuntimeClientFactory : IAgerbotRuntimeClientFactory
{
    public IAgerbotRuntimeClient Create(Uri baseUri) => new AgerbotRuntimeClient(baseUri);
}

public sealed class AgerbotCandidateValidator : IAgerbotCandidateValidator
{
    private readonly IAgerbotProcessLauncher _launcher;
    private readonly IAgerbotRuntimeClientFactory _clients;
    private readonly int _healthAttempts;
    private readonly TimeSpan _healthInterval;

    public AgerbotCandidateValidator(
        IAgerbotProcessLauncher? launcher = null,
        IAgerbotRuntimeClientFactory? clients = null,
        int healthAttempts = 120,
        TimeSpan? healthInterval = null)
    {
        _launcher = launcher ?? new SystemAgerbotProcessLauncher();
        _clients = clients ?? new AgerbotRuntimeClientFactory();
        _healthAttempts = healthAttempts;
        _healthInterval = healthInterval ?? TimeSpan.FromMilliseconds(250);
    }

    public async Task<bool> ValidateAsync(
        string runtimeExecutablePath,
        string checkpointPath,
        string expectedVersion,
        string requestedDevice,
        CancellationToken cancellationToken = default)
    {
        if (!File.Exists(runtimeExecutablePath) || !File.Exists(checkpointPath)) return false;
        var devices = requestedDevice.Equals("cpu", StringComparison.OrdinalIgnoreCase)
            ? new[] { "cpu" }
            : new[] { requestedDevice, "cpu" };
        foreach (string device in devices.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (await ValidateAttemptAsync(runtimeExecutablePath, checkpointPath, expectedVersion, device, cancellationToken))
                return true;
        }
        return false;
    }

    private async Task<bool> ValidateAttemptAsync(
        string runtimeExecutablePath,
        string checkpointPath,
        string expectedVersion,
        string device,
        CancellationToken cancellationToken)
    {
        int port = AvailableLoopbackPort();
        var startInfo = new ProcessStartInfo(Path.GetFullPath(runtimeExecutablePath))
        {
            WorkingDirectory = Path.GetDirectoryName(Path.GetFullPath(runtimeExecutablePath))!,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = false,
            RedirectStandardError = false
        };
        startInfo.Environment["AGERBOT_CHECKPOINT"] = Path.GetFullPath(checkpointPath);
        startInfo.Environment["AGERBOT_HOST"] = "127.0.0.1";
        startInfo.Environment["AGERBOT_PORT"] = port.ToString();
        startInfo.Environment["AGERBOT_DEVICE"] = device;
        IAgerbotManagedProcess? process = null;
        IAgerbotRuntimeClient? client = null;
        try
        {
            process = _launcher.Start(startInfo);
            client = _clients.Create(new Uri($"http://127.0.0.1:{port}"));
            for (int attempt = 0; attempt < _healthAttempts; attempt++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (process.HasExited) return false;
                try
                {
                    var health = await client.HealthAsync(cancellationToken);
                    if (health.Model.Loaded == true && health.Model.Version == expectedVersion)
                    {
                        var diagnostic = await client.ChatAsync(new AgerbotChatRequest
                        {
                            ConversationId = "agerbot-validation",
                            Message = "Hola",
                            Generation = new AgerbotGenerationSettings { MaxNewTokens = 4, Temperature = 1, TopK = 1 }
                        }, cancellationToken);
                        return !string.IsNullOrWhiteSpace(diagnostic.Message.Content);
                    }
                }
                catch (AgerbotClientException) { }
                await Task.Delay(_healthInterval, cancellationToken);
            }
            return false;
        }
        catch (OperationCanceledException) { throw; }
        catch { return false; }
        finally
        {
            try { process?.KillEntireTree(); }
            catch { }
            process?.Dispose();
            if (client is IDisposable disposable) disposable.Dispose();
        }
    }

    private static int AvailableLoopbackPort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }
}
