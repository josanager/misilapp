namespace MISILNative.Core.Agerbot;

public sealed class AgerbotManagedRuntimeActivator : IAgerbotModelRuntimeActivator
{
    private readonly IAgerbotProcessManager _processManager;
    private readonly AgerbotSettingsStore _settingsStore;

    public AgerbotManagedRuntimeActivator(
        IAgerbotProcessManager processManager,
        AgerbotSettingsStore settingsStore)
    {
        _processManager = processManager;
        _settingsStore = settingsStore;
    }

    public async Task<bool> ActivateAsync(AgerbotCurrentModelRecord record, CancellationToken cancellationToken = default)
    {
        await _processManager.StopAsync(cancellationToken);
        _settingsStore.Update(settings =>
        {
            settings.CheckpointPath = record.CheckpointPath;
            settings.ActiveModelVersion = record.ActiveVersion;
            settings.PreviousModelVersion = record.PreviousVersion;
        });
        await _processManager.StartAsync(_settingsStore.Settings, cancellationToken);
        return _processManager.State.IsReady
            && _processManager.State.Health?.Model.Version == record.ActiveVersion;
    }

    public async Task DeactivateAsync(CancellationToken cancellationToken = default)
    {
        await _processManager.StopAsync(cancellationToken);
        _settingsStore.Update(settings =>
        {
            settings.CheckpointPath = string.Empty;
            settings.ActiveModelVersion = null;
            settings.PreviousModelVersion = null;
        });
    }
}
