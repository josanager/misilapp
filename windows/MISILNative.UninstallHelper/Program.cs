using MISILNative.Core.Agerbot;

string metadata = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "MISIL",
    "Agerbot",
    "runtime",
    "managed-process.json");
var store = new ManagedRuntimeMetadataStore(metadata);
store.TryTerminateRecordedOrphan();
return 0;
