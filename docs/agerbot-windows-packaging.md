# Paquetes autónomos de Agerbot para Windows

MISIL no incluye Python ni PyTorch en su instalador principal. Consume releases separadas del repositorio oficial `josanager/Agerbot`.

## Estrategia elegida

Publicar un entorno Python/PyTorch administrado y aislado dentro de ZIPs versionados:

- `agerbot-runtime-VERSION-windows-x64-cpu.zip`, obligatorio;
- `agerbot-runtime-VERSION-windows-x64-cuda.zip`, opcional y fijado a una combinación probada de PyTorch/CUDA;
- checkpoints/modelos como releases `model-vVERSION` independientes.

Cada ZIP debe contener un único punto de entrada sin consola, por ejemplo `agerbot-runtime.exe`, junto con Python, PyTorch y DLLs nativas necesarias. El usuario no ejecuta comandos. No se presupone PyInstaller: el paquete debe probarse en una máquina limpia y medirse antes de publicar.

## Release de runtime

Tag: `runtime-vX.Y.Z`. Assets obligatorios: `agerbot-runtime-release.json`, CPU ZIP y su checksum; CUDA solo cuando esté validado. El manifiesto esquema 1 declara versión, plataforma `windows-x64`, variante, entry point, tamaños instalado/descarga, SHA-256 y build mínimo de Windows.

CPU es siempre obligatorio. En un equipo NVIDIA compatible MISIL instala CPU como respaldo y después CUDA. Si CUDA no se descarga o no arranca, usa el ejecutable CPU específico.

## Release de modelo

Tag: `model-vX.Y.Z`. Assets obligatorios:

- `agerbot-release.json` esquema 2;
- checkpoint con nombre versionado, nunca `best.pt` sin manifiesto;
- `evaluation.json` con estado aprobado;
- `checksums-sha256.txt`.

El manifiesto declara arquitectura `agerbot-transformer`, tokenizador `byte-v1` o `char-v1`, runtime mínimo/máximo, plataformas, dispositivos, tamaño y SHA-256. MISIL valida todo y prueba el candidato en un puerto loopback aleatorio antes de activarlo.

## Bloqueo real actual

Todavía no existe una release pública de runtime/modelo Windows consumible. La integración Windows está comprobada con paquetes y transportes simulados, pero **Instalar Agerbot no podrá completar una instalación real hasta que el repositorio Agerbot publique esos assets**. Tampoco debe afirmarse compatibilidad real con RTX 3050 hasta ejecutar `docs/windows-validation.md`.
