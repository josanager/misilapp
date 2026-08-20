using System;

namespace MISILNative.Services
{
    public static class StoragePolicy
    {
        public const ulong BytesPerGiB = 1024UL * 1024UL * 1024UL; // 1,073,741,824
        public const int MinimumGiB = 10;
        public const int SafetyReserveGiB = 5;
        public static readonly int[] Presets = { 10, 50, 100, 500 };

        public static ulong BytesForGiB(int gibibytes)
        {
            if (gibibytes <= 0) return 0;
            return (ulong)gibibytes * BytesPerGiB;
        }

        public static int MaxShareableGiB(ulong availableBytes)
        {
            ulong reserve = BytesForGiB(SafetyReserveGiB);
            if (availableBytes <= reserve) return 0;
            return (int)((availableBytes - reserve) / BytesPerGiB);
        }

        public static void Validate(int gibibytes, ulong availableBytes)
        {
            if (gibibytes < MinimumGiB)
            {
                throw new InvalidOperationException("La aportación personalizada debe ser de al menos 10 GB.");
            }
            if (gibibytes > MaxShareableGiB(availableBytes))
            {
                throw new InvalidOperationException("Este equipo Windows no tiene espacio libre suficiente para esa cuota.");
            }
        }
    }
}
