# MISIL Desktop

MISIL es una aplicación nativa de escritorio para Windows y macOS con almacenamiento local cifrado y mensajería por Internet mediante infraestructura autoalojada.

## Descargar MISIL

> **Beta:** usa MISIL con datos de prueba y conserva copias de los archivos importantes.

[**Descargar MISIL para Windows**](https://github.com/josanager/misilapp/releases/latest) · [Ver todas las versiones](https://github.com/josanager/misilapp/releases)

El usuario normal descarga `MISIL-Setup-VERSION-x64.exe` desde una GitHub Release estable; no necesita descargar el código fuente ni instalar Git, Python, PyTorch, Visual Studio o el SDK de .NET.

Requisitos mínimos para Windows: Windows 10 versión 2004 (build 19041) o Windows 11, procesador x64 y conexión a Internet. El instalador es por usuario, se guarda bajo `%LOCALAPPDATA%\Programs\MISIL` y no requiere permisos de administrador. La versión macOS distribuible aparecerá en la misma página cuando exista un DMG firmado o claramente identificado como beta.

### Instalar, actualizar y desinstalar

1. Abre la release estable más reciente y descarga únicamente `MISIL-Setup-VERSION-x64.exe`.
2. Ejecuta el instalador y abre MISIL desde el menú Inicio.
3. Para Agerbot, entra en **Ajustes → Agerbot local**, elige una cuota y pulsa **Instalar Agerbot**. MISIL descargará runtime y modelo compatibles cuando sus releases oficiales estén disponibles.
4. Las actualizaciones de MISIL aparecen por separado en **Actualizaciones de MISIL**. El botón **Actualizar y reiniciar** verifica SHA-256, cierra MISIL y Agerbot, instala mediante un proceso externo y vuelve a abrir la aplicación.
5. **Desinstalar Agerbot** conserva el chat local. Para eliminar MISIL usa **Aplicaciones instaladas** de Windows; el desinstalador pregunta qué datos personales deseas conservar.

Consulta la [guía de release de Windows](docs/windows-release.md) y la [validación en una laptop Windows real](docs/windows-validation.md).

## Componentes

```text
desktop-assets/          Recursos visuales compartidos por los instaladores
local-node/              Motor local de almacenamiento cifrado y SQLite
misil-hub/               Servidor WebSocket propio para identidad y mensajes
macos/MISILNative/       Aplicación nativa SwiftUI
windows/MISILNative/     Aplicación nativa WPF para .NET 8
windows/MISILNative.Core/ Servicios comprobables de Agerbot y actualizaciones
windows/installer/       Instalador per-user Inno Setup
docs/local-node.md       Arquitectura y garantías del almacenamiento local
docs/internet-messaging.md Despliegue del Hub y conexión entre equipos
docs/agerbot-runtime.md  Contrato del modelo local opcional Agerbot
```

El motor local escucha exclusivamente en `127.0.0.1`, cifra los archivos por bloques con AES-256-GCM y guarda los metadatos en SQLite. No publica datos en Internet.

## Desarrollo

```bash
npm install
npm run test:local
npm run dev
```

`npm run dev` inicia únicamente el motor local en `http://127.0.0.1:4317`.

Para probar la comunicación entre dos equipos simulados:

```bash
npm run test:hub
npm run hub:start
```

El despliegue público autoalojado está documentado en [`docs/internet-messaging.md`](docs/internet-messaging.md).

## macOS

```bash
npm run mac:test
npm run mac:build
npm run mac:dmg
```

Los artefactos se escriben en `macos/MISILNative/dist/`.

### Agerbot en macOS

MISIL descubre automáticamente modelos estables de Agerbot, inicia su
runtime en `http://127.0.0.1:4318` y muestra el modelo como un contacto especial.
Ese chat se guarda en `agerbot-conversation.json` y nunca pasa por MISIL Hub.

Para el entorno de desarrollo actual:

```bash
cd ../Agerbot
uv sync
cd ../MISIL
npm run mac:build
open macos/MISILNative/dist/MISIL.app
```

MISIL puede comprobar GitHub Releases cada seis horas, descargar un modelo más
nuevo en segundo plano, verificarlo y activarlo con rollback. No descarga ni
actualiza automáticamente el runtime Python/PyTorch. Consulta
[`docs/agerbot-vision.md`](docs/agerbot-vision.md) y
[`docs/agerbot-runtime.md`](docs/agerbot-runtime.md).

## Windows

```powershell
dotnet publish windows/MISILNative/MISILNative.csproj `
  -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true `
  -o windows/MISILNative/dist
```

El publish autónomo se empaqueta como instalador mediante el workflow
`Build and package MISIL for Windows`. Los artefactos de una ejecución manual son
temporales; los usuarios deben descargar siempre desde GitHub Releases.

## Datos locales

- macOS: `~/Library/Application Support/MISIL/`
- Windows: `%LOCALAPPDATA%\MISIL\`
- Motor local de desarrollo: `.misil-data/`

Las claves se protegen con el Llavero de macOS o Windows DPAPI según la plataforma.
