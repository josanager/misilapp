# 🚀 MISIL — Plataforma de Comunicación y Almacenamiento Descentralizado

**MISIL** es un ecosistema de mensajería y almacenamiento privado diseñado para funcionar con **recursos aportados por los propios usuarios**. No requiere cuentas con correo o número de teléfono, no depende de almacenamiento centralizado y garantiza que los archivos y mensajes permanezcan bajo el control de los usuarios mediante criptografía de grado militar (**AES-256-GCM**).

---

## 📑 Tabla de Contenidos

1. [¿Qué es y cómo funciona MISIL?](#-qué-es-y-cómo-funciona-misil)
2. [Estructura del Proyecto](#-estructura-del-proyecto)
3. [Cómo Ejecutar el Proyecto](#-cómo-ejecutar-el-proyecto)
   - [1. Modo Web y Nodo Local de Desarrollo](#1-modo-web-y-nodo-local-de-desarrollo)
   - [2. Aplicación Nativa para Windows (PC)](#2-aplicación-nativa-para-windows-pc)
   - [3. Aplicación Nativa para macOS (Mac)](#3-aplicación-nativa-para-macos-mac)
   - [4. Despliegue del Relay en Cloudflare](#4-despliegue-del-relay-en-cloudflare)
4. [Donación de Almacenamiento y Criptografía](#-donación-de-almacenamiento-y-criptografía)
5. [Variables de Entorno y Configuración](#-variables-de-entorno-y-configuración)

---

## 💡 ¿Qué es y cómo funciona MISIL?

El proyecto se divide en tres niveles complementarios:

1. **Web Pública & Relay Efímero (`/chat`):**
   - Permite crear salas de chat efímeras e intercambiar mensajes de texto protegidos de extremo a extremo.
   - Utiliza la **Web Crypto API (AES-256-GCM)** en el navegador. El servidor de relay (Cloudflare) solo transporta sobres cifrados (*Zero-Knowledge*), sin acceso a claves ni texto plano.
   - Los mensajes se purgan automáticamente tras 7 días.

2. **Nodo Local Backend (`local-node/`):**
   - Servidor local en Node.js y SQLite (`better-sqlite3`) en `127.0.0.1:4317`.
   - Fragmenta archivos en bloques de **4 MiB**, los cifra con AES-256-GCM, deduplica por SHA-256 y permite streaming mediante rangos HTTP.

3. **Aplicaciones Nativas de Escritorio (Windows & macOS):**
   - **Windows:** Aplicación nativa en **C# / .NET 8 WPF** que resguarda la clave maestra de 256 bits mediante la **Windows Data Protection API (DPAPI)**.
   - **macOS:** Aplicación nativa en **Swift 6 / SwiftUI** que resguarda la clave maestra en el **Keychain** de macOS.
   - Ambas aplicaciones permiten al usuario aportar una cuota de su disco duro (10, 50, 100, 500 GB o personalizada), ver el dashboard de capacidad y sincronizarse con salas de chat web.
   - Desde la versión 0.2.0, ambas publican presencia autenticada por Internet y muestran en tiempo casi real la suma de cuotas de todos los nodos sanos y conectados.

---

## 📂 Estructura del Proyecto

```text
MISIL/
├── src/                  # Frontend Web SPA (React 18 + TypeScript + Vite + Zustand)
│   ├── components/       # Componentes de UI (Landing, Web Chat, Layouts, Dashboard)
│   ├── services/         # Cliente API local y motor criptográfico del relay (relayCrypto.ts)
│   └── stores/           # Gestores de estado globales con Zustand
│
├── local-node/           # Servidor del Nodo Local autónomo
│   ├── server.mjs        # Servidor HTTP local (puerto 4317)
│   ├── storage.mjs       # Motor de chunks 4 MiB, cifrado AES-256-GCM y deduplicación
│   └── database.mjs      # Base de datos SQLite (WAL mode)
│
├── windows/              # 🪟 Aplicación Nativa para Windows
│   └── MISILNative/      # Proyecto .NET 8 WPF, XAML, Windows DPAPI y scripts de build
│
├── macos/                # 🍏 Aplicación Nativa para macOS
│   └── MISILNative/      # Proyecto Swift 6 / SwiftUI, AppKit y Keychain
│
├── functions/            # ☁️ Relay Serverless para Cloudflare Pages Functions + D1
│   └── api/relay/        # Endpoints de salas y sobres cifrados temporales
│
├── docs/                 # Documentación técnica de arquitectura
│   ├── local-node.md     # Especificación del nodo local y almacenamiento
│   └── web-relay.md      # Especificación de seguridad del relay web
│
└── package.json          # Scripts globales y dependencias
```

---

## 🚀 Cómo Ejecutar el Proyecto

### 1. Modo Web y Nodo Local de Desarrollo

Requiere **Node.js 20** o superior:

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar interfaz web, nodo local y relay en paralelo
npm run dev
```

- Abre tu navegador en **`http://localhost:5173`**.
- La landing pública estará en `/` y el chat efímero en `/chat`.

---

### 2. Aplicación Nativa para Windows (PC)

Para compilar y ejecutar en un ordenador con **Windows 10 / 11**:

#### Requisitos:
- Instalar [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0).

#### Compilación:
```cmd
# Opción 1: Con el script Batch (CMD o doble clic)
windows\MISILNative\scripts\build.bat

# Opción 2: Con PowerShell
.\windows\MISILNative\scripts\build.ps1

# Opción 3: Con npm
npm run win:build
```

El ejecutable autónomo quedará generado en:
```text
windows\MISILNative\dist\MISIL.exe
```
> **Nota:** `MISIL.exe` es un binario autónomo (*self-contained*), por lo que puede ejecutarse directamente en cualquier PC Windows sin configuraciones adicionales.

---

### 3. Aplicación Nativa para macOS (Mac)

Para compilar en un ordenador con **macOS** (Apple Silicon o Intel):

#### Requisitos:
- Xcode 15+ o Swift 6 toolchain.

#### Compilación:
```bash
# Ejecutar tests nativos
npm run mac:test

# Compilar aplicación (.app)
npm run mac:build

# Generar instalador (.dmg)
npm run mac:dmg
```

El instalador se generará en:
```text
macos/MISILNative/dist/MISIL-Local-Alpha-0.2.0-macOS-arm64.dmg
```

---

### 4. Despliegue del Relay en Cloudflare

Para publicar la web y el relay en Cloudflare Pages con base de datos D1:

```bash
# 1. Iniciar sesión en Cloudflare
npx wrangler login

# 2. Aplicar migraciones en D1
npm run relay:migrate:local    # Para entorno local
npm run relay:migrate:remote   # Para producción

# 3. Desplegar en Cloudflare Pages
npm run deploy:pages
```

---

## 🔒 Donación de Almacenamiento y Criptografía

1. **Aportación por Nodo:** Cada usuario en Windows o macOS elige cuántos GB de disco donar (mínimo 10 GB). La aplicación reserva automáticamente 5 GB de seguridad para el sistema operativo.
2. **Capacidad Colectiva:** En la red de MISIL, la capacidad total disponible es la suma de los espacios aportados por cada nodo activo.
3. **Cifrado en Reposo:** Cada archivo se divide en bloques independientes de 4 MiB cifrados con AES-256-GCM.
4. **Protección de la Clave Maestra:**
   - En **Windows:** Cifrada con **Windows DPAPI** (`ProtectedData.Protect` con ámbito `CurrentUser`).
   - En **macOS:** Almacenada en el **Keychain** del sistema operativo.

---

## ⚙️ Variables de Entorno y Configuración

| Variable | Valor predeterminado | Descripción |
| :--- | :--- | :--- |
| `VITE_LOCAL_NODE_URL` | `http://127.0.0.1:4317` | URL del nodo local usada por la web |
| `MISIL_NODE_PORT` | `4317` | Puerto donde escucha el nodo local |
| `MISIL_DATA_DIR` | `.misil-data` | Directorio local de base de datos y blobs |
| `MISIL_QUOTA_BYTES` | `10737418240` (10 GiB) | Límite de cuota del nodo local de desarrollo |
| `VITE_RELAY_API_URL` | *(vacío para relay local)* | URL del relay en producción (ej. `https://misil-web.pages.dev`) |
| `MISIL_RELAY_URL` | `https://misil-web.pages.dev` | Relay usado por las apps nativas para presencia y capacidad; útil para pruebas locales. |

La arquitectura y el protocolo del contador de capacidad están documentados en [`docs/network-presence.md`](docs/network-presence.md).
