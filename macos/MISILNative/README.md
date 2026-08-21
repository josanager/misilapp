# MISIL Local Alpha para macOS

Aplicación nativa escrita con Swift 6 y SwiftUI. No contiene Electron, WebView ni un runtime de Node.js. El bundle, el volumen de instalación y la interfaz usan el logotipo oficial de `public/favicon.svg`.

## Funciones de esta alpha

- Onboarding sin cuenta.
- Elección de aportar almacenamiento o continuar sin hacerlo.
- Cuotas de 10, 50, 100 y 500 GB, más una cantidad personalizada mínima de 10 GB.
- Validación del espacio real disponible y reserva de 5 GB para macOS.
- Clave local de 256 bits guardada en el Llavero.
- Explicación previa antes de que macOS solicite acceso a esa clave.
- Preparación real del directorio y prueba de escritura.
- Dashboard disponible únicamente cuando el nodo aporta almacenamiento.
- Capacidad total Windows/macOS actualizada por Internet cada 10 segundos y baja automática de nodos sin señal.
- Chat local nativo de prueba, persistido en Application Support.
- Ajustes para cambiar la cuota o repetir el onboarding.

La cuota no crea un archivo vacío del tamaño seleccionado. Es un límite máximo y el almacenamiento crece conforme se escriben datos.

## Compilar y probar

```bash
macos/MISILNative/scripts/test-native.sh
macos/MISILNative/scripts/build-app.sh
macos/MISILNative/scripts/build-dmg.sh
```

Los artefactos se generan en `macos/MISILNative/dist/`.

## Instalar la alpha local

1. Abre el archivo `.dmg`.
2. Arrastra MISIL a Applications.
3. Esta compilación está firmada de forma ad hoc. Si Gatekeeper la bloquea, haz clic derecho en MISIL, selecciona **Abrir** y confirma una vez.

Para distribuirla sin ese aviso se necesita un certificado Developer ID Application y notarización de Apple.

## Datos

La aplicación escribe en `~/Library/Application Support/MISIL/`. La configuración y los mensajes están allí; la clave de almacenamiento y la identidad de presencia están separadas en el Llavero de macOS.
