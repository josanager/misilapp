# MISIL para Windows

Cliente nativo WPF para Windows 10/11 x64, compilado con .NET 8 y distribuido como aplicación autocontenida. No usa Electron ni WebView.

## Arquitectura

- `MISILNative`: interfaz WPF, navegación y adaptación a servicios de Windows.
- `MISILNative.Core`: contratos y servicios comprobables de Agerbot, distribución, cuota y actualización.
- `MISILNative.Checks`: comprobaciones automatizadas sin hardware ni red externa.
- `MISILNative.Updater`: proceso externo que verifica, respalda, instala, reabre y restaura en caso de fallo.
- `MISILNative.UninstallHelper`: detiene únicamente el runtime Agerbot registrado por MISIL.
- `windows/installer/MISIL.iss`: instalador Inno Setup per-user.

## Agerbot local

Agerbot aparece como contacto `LOCAL`; su conversación se guarda aparte y nunca se envía a MISIL Hub. El runtime escucha en `127.0.0.1:4318`, se inicia sin consola y se detiene al salir de MISIL.

La aplicación administra paquetes separados de runtime CPU y CUDA. CPU se instala como respaldo universal; CUDA solo se recomienda cuando `nvidia-smi`, VRAM y el paquete publicado son compatibles. Una falla CUDA retrocede al ejecutable CPU específico.

Los modelos requieren manifiesto esquema 2, SemVer, compatibilidad Windows x64, tamaño y SHA-256. Una versión candidata se carga en un proceso aislado, ejecuta salud y una generación corta y solo entonces se activa. Se conserva una versión anterior para rollback y se registran las versiones defectuosas.

## Rutas

```text
%LOCALAPPDATA%\Programs\MISIL\       aplicación instalada
%LOCALAPPDATA%\MISIL\Agerbot\       runtimes, modelos, caché y metadatos
%LOCALAPPDATA%\MISIL\updates\       actualizaciones parciales y resultado
%LOCALAPPDATA%\MISIL\agerbot-conversation.json
%APPDATA%\MISIL\                    configuración
```

No se guardan datos mutables dentro de la carpeta de la aplicación.

## Desarrollo

```powershell
dotnet run --project windows/MISILNative.Checks/MISILNative.Checks.csproj -c Release
dotnet build windows/MISILNative/MISILNative.csproj -c Release
```

El instalador se construye en un runner `windows-latest` mediante el workflow `Build and package MISIL for Windows`. Un tag `vX.Y.Z` o `vX.Y.Z-beta.N` debe coincidir con `<Version>` en `MISILNative.csproj`; solo los tags publican GitHub Releases y las betas quedan marcadas como prerelease.

Consulta [docs/windows-release.md](../../docs/windows-release.md) y [docs/windows-validation.md](../../docs/windows-validation.md).
