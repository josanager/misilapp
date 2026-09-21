# MISIL Desktop

**App nativa de escritorio (Windows / macOS) con almacenamiento local cifrado y mensajería opcional autoalojada.**  
Pensada para quien quiere datos en el propio equipo (local-first), cifrado en disco y, si lo necesita, chat por Internet sin depender de un SaaS de terceros.

> **Beta · v0.2.0** — úsala con datos de prueba y conserva copias de lo importante. Release estable actual: [v0.2.0](https://github.com/josanager/misilapp/releases/tag/v0.2.0) (Windows).

## Descargar

### [Descargas / Releases](https://github.com/josanager/misilapp/releases/latest)

- **Windows (x64):** descarga el artefacto de la última release (`MISIL-Windows-x64-…`). No hace falta clonar el repo ni instalar el SDK de .NET para usarla.
- **macOS:** la build nativa existe en el código; el DMG/distribución pública llegará cuando haya un paquete firmado o claramente marcado como beta.

Requisitos orientativos (Windows): Windows 10 (2004+) o Windows 11, procesador x64.

---

## Capturas

Aún no hay capturas de la UI de escritorio actual. Se añadirán pronto (no se incluyen capturas de productos antiguos para no confundir).

---

## Qué es / para qué sirve / objetivo

- **Qué es:** MISIL Desktop — cliente nativo de escritorio con motor local de almacenamiento cifrado (AES-256-GCM + SQLite) y un nodo local solo en `127.0.0.1`.
- **Para qué sirve:** guardar y organizar datos en el propio equipo con cifrado en reposo; mensajería opcional entre equipos vía un hub WebSocket autoalojado (`misil-hub`); Agerbot opcional (asistente/modelo local) sin pasar el chat por el hub.
- **Objetivo:** demostrar un producto **local-first** real (nativo + cifrado + red opcional autoalojada), útil como pieza de portfolio técnico y como base de un cliente de escritorio honesto sobre privacidad y control de datos.

---

## Stack / componentes (alto nivel)

| Pieza | Tecnología |
|:---|:---|
| Cliente macOS | **SwiftUI** (`macos/MISILNative`) |
| Cliente Windows | **WPF / .NET 8** (`windows/MISILNative` + Core) |
| Motor local | **Node.js** en `127.0.0.1` — cifrado AES-256-GCM, metadatos en **SQLite** (`local-node/`) |
| Hub (opcional) | **misil-hub** — servidor WebSocket autoalojado para identidad y mensajes |
| Agerbot (opcional) | Runtime/modelo local; chat guardado en el equipo, no en el hub |
| Empaquetado Windows | Publicación self-contained + artefactos en GitHub Releases |

El motor local **no** publica datos en Internet por defecto. Las claves se protegen con el Llavero de macOS o DPAPI en Windows según la plataforma.

---

## Características (resumen)

- Almacenamiento local cifrado (AES-256-GCM + SQLite)
- Nodo local acotado a `127.0.0.1`
- Mensajería por Internet **opcional** con hub autoalojado
- Integración opcional con Agerbot (modelo local)
- Clientes nativos: SwiftUI (macOS) y WPF/.NET (Windows)
- Release Windows publicada en GitHub Releases (v0.2.0)

---

## Desarrollo (resumen)

Necesitas Node.js para el motor local y el hub. Para el cliente Windows, .NET 8; para macOS, el toolchain de Xcode/Swift.

```bash
npm install
npm run test:local
npm run dev          # motor local en http://127.0.0.1:4317
```

Hub (dos equipos simulados):

```bash
npm run test:hub
npm run hub:start
```

macOS:

```bash
npm run mac:test
npm run mac:build
npm run mac:dmg
```

Windows (publicación self-contained):

```powershell
dotnet publish windows/MISILNative/MISILNative.csproj `
  -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true `
  -o windows/MISILNative/dist
```

### Datos locales (desarrollo / runtime)

- macOS: `~/Library/Application Support/MISIL/`
- Windows: `%LOCALAPPDATA%\MISIL\`
- Motor local de desarrollo: `.misil-data/`

---

## Documentación

Detalle técnico en `docs/` (no duplicado aquí):

- [`docs/local-node.md`](docs/local-node.md) — arquitectura y garantías del almacenamiento local
- [`docs/internet-messaging.md`](docs/internet-messaging.md) — despliegue del hub y conexión entre equipos
- [`docs/windows-release.md`](docs/windows-release.md) — guía de release Windows
- [`docs/windows-validation.md`](docs/windows-validation.md) — validación en laptop Windows real
- [`docs/agerbot-runtime.md`](docs/agerbot-runtime.md) / [`docs/agerbot-vision.md`](docs/agerbot-vision.md) — Agerbot opcional

---

## Licencia / uso

Proyecto personal de portfolio en **beta**. Revisa el repositorio y las [Releases](https://github.com/josanager/misilapp/releases) para el estado actual del código y de los binarios.
