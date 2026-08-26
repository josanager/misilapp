using System.Text;

namespace MISILNative.Core.Diagnostics;

public sealed class DiagnosticLogService
{
    private readonly string _root;
    private readonly long _maximumFileBytes;
    private readonly int _retainedFiles;
    private readonly object _sync = new();

    public DiagnosticLogService(string root, long maximumFileBytes = 1024 * 1024, int retainedFiles = 3)
    {
        _root = Path.GetFullPath(root);
        _maximumFileBytes = maximumFileBytes;
        _retainedFiles = Math.Max(1, retainedFiles);
    }

    public void Write(string eventName, string outcome, string? technicalCode = null)
    {
        lock (_sync)
        {
            Directory.CreateDirectory(_root);
            string active = Path.Combine(_root, "misil.log");
            RotateIfNeeded(active);
            string line = string.Join('\t',
                DateTimeOffset.UtcNow.ToString("O"),
                Clean(eventName, 80),
                Clean(outcome, 160),
                Clean(technicalCode ?? string.Empty, 120));
            File.AppendAllText(active, line + Environment.NewLine, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
        }
    }

    private void RotateIfNeeded(string active)
    {
        if (!File.Exists(active) || new FileInfo(active).Length < _maximumFileBytes) return;
        string oldest = Path.Combine(_root, $"misil.{_retainedFiles}.log");
        if (File.Exists(oldest)) File.Delete(oldest);
        for (int index = _retainedFiles; index >= 1; index--)
        {
            string source = Path.Combine(_root, index == 1 ? "misil.log" : $"misil.{index - 1}.log");
            string destination = Path.Combine(_root, $"misil.{index}.log");
            if (File.Exists(source)) File.Move(source, destination, overwrite: true);
        }
    }

    private static string Clean(string value, int maximumLength)
    {
        string clean = value.Replace('\r', ' ').Replace('\n', ' ').Replace('\t', ' ').Trim();
        return clean.Length <= maximumLength ? clean : clean[..maximumLength];
    }
}
