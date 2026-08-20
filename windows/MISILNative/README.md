# MISIL Local Alpha para Windows

Aplicación nativa de escritorio escrita en **C# y .NET 8.0 con WPF (Windows Presentation Foundation)**. No contiene Electron, WebViews pesados ni runtime de Node.js en el cliente.

---

## Características de la versión nativa para Windows

- **Onboarding sin inicio de sesión:** Acceso directo a tu espacio local sin registro por correo ni número de teléfono.
- **Aportación de almacenamiento:** Selección flexible de cuotas (10 GB, 50 GB, 100 GB, 500 GB o cantidad personalizada mínima de 10 GB).
- **Validación de disco:** Detección en tiempo real del espacio libre disponible mediante `DriveInfo` reservando siempre 5 GB de margen de seguridad para Windows.
- **Seguridad nativa con Windows DPAPI:** La clave maestra de 256 bits se genera aleatoriamente y se cifra con la **Windows Data Protection API (`System.Security.Cryptography.ProtectedData`)** a nivel de `CurrentUser`.
- **Dashboard de almacenamiento:** Métricas de cuota aportada, espacio consumido, espacio libre y botón para abrir directamente la carpeta de bloques en el **Explorador de Archivos de Windows**.
- **Chat nativo e integración con MISIL Web:** Conversación local persistida y sincronización mediante sobres cifrados con **AES-256-GCM** compatibles con el relay temporal web.
- **Ajustes:** Modificación de cuota en caliente y opción para restablecer la configuración inicial de prueba preservando los datos.

---

## Requisitos para Compilar en Windows

- **Windows 10 / 11** (x64 o ARM64).
- **.NET 8.0 SDK** (descargable desde [dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/8.0)).

---

## Compilar y Ejecutar en Windows

### Opción 1: Con el script Batch (CMD o doble clic)
```cmd
windows\MISILNative\scripts\build.bat
```

### Opción 2: Con PowerShell
```powershell
.\windows\MISILNative\scripts\build.ps1
```

### Opción 3: Con la CLI de .NET
```bash
cd windows/MISILNative
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist
```

El ejecutable autónomo `MISIL.exe` se generará en `windows/MISILNative/dist/MISIL.exe`. Puede ejecutarse en cualquier PC con Windows 10/11 sin necesidad de tener .NET instalado previamente gracias al modo *self-contained*.

---

## Ubicación de los Datos en Windows

La aplicación almacena sus datos de forma aislada en:
```text
%LOCALAPPDATA%\MISIL\
├── configuration.json        -> Configuración del nodo y cuota seleccionada
├── native-messages.json      -> Historial local de mensajes de chat
├── Security\
│   ├── master.key.dat        -> Clave de 256 bits cifrada con Windows DPAPI
│   └── relay.identity.dat    -> Credenciales del relay web cifradas con DPAPI
└── Storage\
    ├── Blobs\                -> Fragmentos de 4 MiB cifrados
    └── Temporary\            -> Directorio temporal y pruebas de integridad
```
