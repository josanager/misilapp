using System.Collections.Concurrent;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MISILNative.Models;

namespace MISILNative.Services;

public sealed class PeerStorageService : IDisposable
{
    private const int DiscoveryPort = 47777;
    private const string MulticastAddress = "239.255.77.77";
    private static readonly TimeSpan PeerTimeout = TimeSpan.FromSeconds(7);
    private readonly StorageCoordinator _storage;
    private readonly MessagingIdentity _identity;
    private readonly ConcurrentDictionary<string, PeerStorageNode> _peers = new();
    private CancellationTokenSource? _cancellation;
    private TcpListener? _listener;
    private Task? _runTask;
    private AppConfiguration? _configuration;

    public PeerStorageService(StorageCoordinator storage)
    {
        _storage = storage;
        _identity = MessagingIdentityStore.LoadOrCreate();
    }

    public event EventHandler? PeersChanged;
    public IReadOnlyList<PeerStorageNode> Peers => _peers.Values.OrderBy(p => p.DisplayName).ToArray();

    public void Start(AppConfiguration? configuration)
    {
        Stop();
        _configuration = configuration;
        if (configuration?.SharesStorage != true || configuration.QuotaBytes == 0) return;
        _cancellation = new CancellationTokenSource();
        _listener = new TcpListener(IPAddress.Any, 0);
        _listener.Start();
        _runTask = RunAsync(((IPEndPoint)_listener.LocalEndpoint).Port, _cancellation.Token);
    }

    public void Stop()
    {
        _cancellation?.Cancel();
        _listener?.Stop();
        _cancellation?.Dispose();
        _cancellation = null;
        _listener = null;
        _runTask = null;
        if (!_peers.IsEmpty) { _peers.Clear(); PeersChanged?.Invoke(this, EventArgs.Empty); }
    }

    public async Task<string> TestFirstPeerAsync(CancellationToken cancellationToken = default)
    {
        var peer = Peers.FirstOrDefault() ?? throw new InvalidOperationException("No hay otro equipo MISIL conectado a esta red Wi‑Fi.");
        byte[] payload = RandomNumberGenerator.GetBytes(64 * 1024);
        string hash = Convert.ToHexString(SHA256.HashData(payload)).ToLowerInvariant();
        var put = await SendAsync(peer, new PeerRequest("put", hash, Convert.ToBase64String(payload)), cancellationToken);
        if (!put.Ok) throw new IOException(put.Error ?? "El equipo remoto rechazó la escritura.");
        var get = await SendAsync(peer, new PeerRequest("get", hash, null), cancellationToken);
        if (!get.Ok || string.IsNullOrEmpty(get.Data)) throw new IOException(get.Error ?? "No se pudo recuperar la prueba.");
        byte[] received = Convert.FromBase64String(get.Data);
        if (!CryptographicOperations.FixedTimeEquals(SHA256.HashData(received), SHA256.HashData(payload)))
            throw new IOException("La verificación de integridad remota falló.");
        _ = await SendAsync(peer, new PeerRequest("delete", hash, null), cancellationToken);
        return $"Transferencia verificada con {peer.DisplayName}: 64 KB escritos, leídos y eliminados.";
    }

    private async Task RunAsync(int tcpPort, CancellationToken cancellationToken)
    {
        Task[] jobs = { AcceptLoopAsync(cancellationToken), DiscoverLoopAsync(tcpPort, cancellationToken), CleanupLoopAsync(cancellationToken) };
        try { await Task.WhenAll(jobs); } catch (OperationCanceledException) { } catch (ObjectDisposedException) { }
    }

    private async Task AcceptLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested && _listener != null)
        {
            TcpClient client = await _listener.AcceptTcpClientAsync(cancellationToken);
            _ = HandleClientAsync(client, cancellationToken);
        }
    }

    private async Task HandleClientAsync(TcpClient client, CancellationToken cancellationToken)
    {
        using (client)
        using (NetworkStream stream = client.GetStream())
        using (var reader = new StreamReader(stream, Encoding.UTF8, false, 1024 * 1024, leaveOpen: true))
        using (var writer = new StreamWriter(stream, new UTF8Encoding(false), 1024, leaveOpen: true) { AutoFlush = true })
        {
            try
            {
                string? line = await reader.ReadLineAsync(cancellationToken);
                var request = line == null ? null : JsonSerializer.Deserialize<PeerRequest>(line);
                PeerResponse response = request == null ? new(false, null, "Solicitud inválida.") : await HandleAsync(request, cancellationToken);
                await writer.WriteLineAsync(JsonSerializer.Serialize(response).AsMemory(), cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                try { await writer.WriteLineAsync(JsonSerializer.Serialize(new PeerResponse(false, null, ex.Message))); } catch { }
            }
        }
    }

    private async Task<PeerResponse> HandleAsync(PeerRequest request, CancellationToken cancellationToken)
    {
        if (_configuration?.SharesStorage != true) return new(false, null, "Almacenamiento desactivado.");
        string blobs = _configuration.StorageDirectory;
        Directory.CreateDirectory(blobs);
        if (request.Key.Length != 64 || request.Key.Any(c => !Uri.IsHexDigit(c))) return new(false, null, "Identificador inválido.");
        string path = Path.Combine(blobs, request.Key.ToLowerInvariant() + ".misil");
        switch (request.Operation)
        {
            case "put":
                byte[] data = Convert.FromBase64String(request.Data ?? string.Empty);
                if (data.Length > 16 * 1024 * 1024) return new(false, null, "Bloque mayor de 16 MB.");
                var snapshot = _storage.Snapshot(_configuration);
                if ((ulong)data.Length > snapshot.AvailableWithinQuota) return new(false, null, "Cuota remota insuficiente.");
                if (!Convert.ToHexString(SHA256.HashData(data)).Equals(request.Key, StringComparison.OrdinalIgnoreCase)) return new(false, null, "Hash inválido.");
                await File.WriteAllBytesAsync(path, data, cancellationToken);
                return new(true, null, null);
            case "get":
                if (!File.Exists(path)) return new(false, null, "Bloque no encontrado.");
                return new(true, Convert.ToBase64String(await File.ReadAllBytesAsync(path, cancellationToken)), null);
            case "delete":
                if (File.Exists(path)) File.Delete(path);
                return new(true, null, null);
            default: return new(false, null, "Operación desconocida.");
        }
    }

    private async Task DiscoverLoopAsync(int tcpPort, CancellationToken cancellationToken)
    {
        using var receiver = new UdpClient(AddressFamily.InterNetwork);
        receiver.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
        receiver.Client.Bind(new IPEndPoint(IPAddress.Any, DiscoveryPort));
        receiver.JoinMulticastGroup(IPAddress.Parse(MulticastAddress));
        using var sender = new UdpClient(AddressFamily.InterNetwork) { MulticastLoopback = false };
        var receiveTask = ReceiveAnnouncementsAsync(receiver, cancellationToken);
        var endpoint = new IPEndPoint(IPAddress.Parse(MulticastAddress), DiscoveryPort);
        while (!cancellationToken.IsCancellationRequested)
        {
            var snapshot = _storage.Snapshot(_configuration);
            var announcement = new PeerAnnouncement("misil-storage-v1", _identity.DeviceId, _identity.Username, _identity.DisplayName, "windows", tcpPort, snapshot.QuotaBytes, snapshot.UsedBytes);
            byte[] data = JsonSerializer.SerializeToUtf8Bytes(announcement);
            await sender.SendAsync(data, endpoint, cancellationToken);
            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
        }
        await receiveTask;
    }

    private async Task ReceiveAnnouncementsAsync(UdpClient receiver, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            UdpReceiveResult packet = await receiver.ReceiveAsync(cancellationToken);
            var item = JsonSerializer.Deserialize<PeerAnnouncement>(packet.Buffer);
            if (item?.Protocol != "misil-storage-v1" || item.DeviceId == _identity.DeviceId || item.Port is < 1 or > 65535) continue;
            var peer = new PeerStorageNode(item.DeviceId, item.Username, item.DisplayName, item.Platform, packet.RemoteEndPoint.Address.ToString(), item.Port, item.QuotaBytes, item.UsedBytes, DateTime.UtcNow);
            _peers[item.DeviceId] = peer;
            PeersChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    private async Task CleanupLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            bool changed = false;
            foreach (var pair in _peers)
                if (DateTime.UtcNow - pair.Value.LastSeen > PeerTimeout) changed |= _peers.TryRemove(pair.Key, out _);
            if (changed) PeersChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    private static async Task<PeerResponse> SendAsync(PeerStorageNode peer, PeerRequest request, CancellationToken cancellationToken)
    {
        using var client = new TcpClient();
        await client.ConnectAsync(peer.Address, peer.Port, cancellationToken);
        using NetworkStream stream = client.GetStream();
        using var writer = new StreamWriter(stream, new UTF8Encoding(false), 1024, true) { AutoFlush = true };
        using var reader = new StreamReader(stream, Encoding.UTF8, false, 1024 * 1024, true);
        await writer.WriteLineAsync(JsonSerializer.Serialize(request).AsMemory(), cancellationToken);
        string? line = await reader.ReadLineAsync(cancellationToken);
        return line == null ? new(false, null, "Sin respuesta remota.") : JsonSerializer.Deserialize<PeerResponse>(line) ?? new(false, null, "Respuesta inválida.");
    }

    public void Dispose() => Stop();
    private sealed record PeerAnnouncement(string Protocol, string DeviceId, string Username, string DisplayName, string Platform, int Port, ulong QuotaBytes, ulong UsedBytes);
    private sealed record PeerRequest(string Operation, string Key, string? Data);
    private sealed record PeerResponse(bool Ok, string? Data, string? Error);
}

public sealed record PeerStorageNode(string DeviceId, string Username, string DisplayName, string Platform, string Address, int Port, ulong QuotaBytes, ulong UsedBytes, DateTime LastSeen)
{
    public ulong AvailableBytes => QuotaBytes > UsedBytes ? QuotaBytes - UsedBytes : 0;
}
