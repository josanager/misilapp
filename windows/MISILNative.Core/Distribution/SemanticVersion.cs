namespace MISILNative.Core.Distribution;

public readonly record struct SemanticVersion(int Major, int Minor, int Patch, string? Prerelease = null)
    : IComparable<SemanticVersion>
{
    public static bool TryParse(string? value, out SemanticVersion version)
    {
        version = default;
        if (string.IsNullOrWhiteSpace(value)) return false;
        string normalized = value.Trim().TrimStart('v');
        int metadata = normalized.IndexOf('+');
        if (metadata >= 0) normalized = normalized[..metadata];
        string[] releaseParts = normalized.Split('-', 2);
        string[] numbers = releaseParts[0].Split('.');
        if (numbers.Length != 3
            || !int.TryParse(numbers[0], out int major)
            || !int.TryParse(numbers[1], out int minor)
            || !int.TryParse(numbers[2], out int patch)
            || major < 0 || minor < 0 || patch < 0) return false;
        string? prerelease = releaseParts.Length == 2 && releaseParts[1].Length > 0 ? releaseParts[1] : null;
        version = new SemanticVersion(major, minor, patch, prerelease);
        return true;
    }

    public static SemanticVersion Parse(string value) =>
        TryParse(value, out var version) ? version : throw new FormatException($"'{value}' no es SemVer.");

    public int CompareTo(SemanticVersion other)
    {
        int result = Major.CompareTo(other.Major);
        if (result != 0) return result;
        result = Minor.CompareTo(other.Minor);
        if (result != 0) return result;
        result = Patch.CompareTo(other.Patch);
        if (result != 0) return result;
        if (Prerelease == null && other.Prerelease == null) return 0;
        if (Prerelease == null) return 1;
        if (other.Prerelease == null) return -1;
        return StringComparer.OrdinalIgnoreCase.Compare(Prerelease, other.Prerelease);
    }

    public override string ToString() => $"{Major}.{Minor}.{Patch}" + (Prerelease == null ? string.Empty : $"-{Prerelease}");
    public static bool operator <(SemanticVersion left, SemanticVersion right) => left.CompareTo(right) < 0;
    public static bool operator >(SemanticVersion left, SemanticVersion right) => left.CompareTo(right) > 0;
    public static bool operator <=(SemanticVersion left, SemanticVersion right) => left.CompareTo(right) <= 0;
    public static bool operator >=(SemanticVersion left, SemanticVersion right) => left.CompareTo(right) >= 0;
}
