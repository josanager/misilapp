using System.Text.Json;

namespace MISILNative.Core.Agerbot;

public sealed class AgerbotSettingsStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    private readonly string _filePath;
    private readonly object _sync = new();

    public AgerbotSettings Settings { get; private set; }

    public AgerbotSettingsStore(string? filePath = null)
    {
        string root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "MISIL");
        _filePath = filePath ?? Path.Combine(root, "agerbot-settings.json");
        Settings = Load();
    }

    public void Update(Action<AgerbotSettings> update)
    {
        lock (_sync)
        {
            update(Settings);
            SaveUnsafe();
        }
    }

    public void Reload()
    {
        lock (_sync) Settings = Load();
    }

    private AgerbotSettings Load()
    {
        try
        {
            if (!File.Exists(_filePath)) return new AgerbotSettings();
            return JsonSerializer.Deserialize<AgerbotSettings>(File.ReadAllText(_filePath), JsonOptions)
                ?? new AgerbotSettings();
        }
        catch (JsonException)
        {
            return new AgerbotSettings();
        }
        catch (IOException)
        {
            return new AgerbotSettings();
        }
    }

    private void SaveUnsafe()
    {
        string directory = Path.GetDirectoryName(_filePath)!;
        Directory.CreateDirectory(directory);
        string temporary = _filePath + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(Settings, JsonOptions));
        File.Move(temporary, _filePath, overwrite: true);
    }
}
