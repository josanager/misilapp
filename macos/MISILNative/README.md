# MISIL para macOS

Aplicación nativa escrita con Swift 6 y SwiftUI. No utiliza Electron ni WebView. Los chats humanos se comunican con el MISIL Hub configurado por el usuario; el contacto especial Agerbot usa únicamente el runtime local `127.0.0.1:4318`. Los instaladores toman el logotipo de `desktop-assets/MISILLogo.svg`.

## Funciones

- Onboarding local sin cuenta.
- Cuotas de 10, 50, 100 y 500 GB, además de una cantidad personalizada.
- Reserva de seguridad de 5 GB y validación del espacio disponible.
- Clave maestra de 256 bits protegida por el Llavero de macOS.
- Dashboard local con cuota, uso, espacio libre y acceso a Finder.
- Conversación de prueba persistida únicamente en Application Support.
- Identidad única, enlace personal y mensajería por Internet en tiempo real.
- Reconexión automática y recepción de mensajes pendientes.
- Contacto local Agerbot separado de MISIL Hub.
- Inicio, comprobación de salud, cancelación y parada de Agerbot sin Terminal.
- Detección de CPU, memoria, acelerador y dispositivo de inferencia.
- Historial Agerbot separado en `agerbot-conversation.json`.
- Descubrimiento de modelos estables por manifiesto y Semantic Versioning.
- Actualización reanudable mediante GitHub Releases, SHA-256, activación atómica y rollback.
- Cambio de cuota y restablecimiento del onboarding sin borrar archivos.

La cuota es un límite máximo; el directorio crece únicamente cuando se guardan datos.

## Compilar y probar

```bash
macos/MISILNative/scripts/test-native.sh
macos/MISILNative/scripts/build-app.sh
macos/MISILNative/scripts/build-dmg.sh
```

Los artefactos se generan en `macos/MISILNative/dist/`.

## Datos

La aplicación escribe configuración, mensajes y almacenamiento en `~/Library/Application Support/MISIL/`. La clave maestra permanece separada en el Llavero.

Los ajustes de Agerbot se guardan en `agerbot-settings.json`; su conversación se
guarda en `agerbot-conversation.json`. Los modelos administrados viven bajo
`~/Library/Application Support/MISIL/Agerbot/`, fuera de `MISIL.app`. El runtime
continúa siendo una instalación independiente elegida explícitamente.
