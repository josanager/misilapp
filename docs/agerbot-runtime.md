# Contrato del runtime local de Agerbot

## Transporte

- Base URL: `http://127.0.0.1:4318`
- Formato: JSON UTF-8.
- El servidor rechaza cuerpos mayores de 1 MiB.
- No escucha en `0.0.0.0`, interfaces LAN ni IPv6 públicas.
- No registra prompts, historiales ni respuestas.
- MISIL aplica 3 segundos a salud, unos 20 segundos a arranque y un tiempo configurable a inferencia.

## `GET /v1/health`

Respuesta `200`:

```json
{
  "status": "ready",
  "runtimeVersion": "0.2.0",
  "model": {
    "name": "Agerbot",
    "version": "0.2.0",
    "trainingName": "gastronomia-peruana-v2",
    "loaded": true,
    "parameters": 10773504,
    "parameterCount": 10773504,
    "device": "mps",
    "tokenizer": "char-v1",
    "contextLength": 256
  }
}
```

Durante la carga, si el servidor ya acepta conexiones, `status` puede ser `loading` y `loaded` será `false`.

## `GET /v1/capabilities`

Respuesta `200`:

```json
{
  "platform": "macOS",
  "architecture": "arm64",
  "cpu": { "logicalCores": 10 },
  "memory": { "totalBytes": 17179869184 },
  "accelerators": [{ "kind": "mps", "name": "Apple Metal Performance Shaders" }],
  "inference": { "supported": true, "recommendedDevice": "mps" },
  "training": { "supported": true, "recommendedDevice": "mps" }
}
```

Las capacidades describen el equipo; no prometen un rendimiento concreto.

## `POST /v1/chat`

Petición:

```json
{
  "conversationId": "agerbot-local",
  "message": "¿Qué es el ají amarillo?",
  "history": [
    { "role": "user", "content": "Hola" },
    { "role": "assistant", "content": "Hola." }
  ],
  "generation": {
    "maxNewTokens": 120,
    "temperature": 0.8,
    "topK": 40
  }
}
```

`conversationId` y `message` son obligatorios. `history` es opcional y queda limitada por número de entradas y bytes. Límites iniciales: mensaje 16 KiB, 32 entradas de historial, 64 KiB de historial, `maxNewTokens` entre 1 y 512, temperatura entre 0,05 y 2,0 y `topK` entre 1 y 256.

Respuesta `200`:

```json
{
  "conversationId": "agerbot-local",
  "message": {
    "role": "assistant",
    "content": "..."
  },
  "usage": {
    "promptTokens": 87,
    "generatedTokens": 120,
    "durationMs": 934
  },
  "model": {
    "name": "Agerbot",
    "version": "0.2.0",
    "device": "mps"
  }
}
```

La respuesta es completa; todavía no hay streaming. El runtime reconstruye `byte-v1` o `char-v1` desde el checkpoint sin reajustarlo y trunca primero las partes más antiguas del historial.

## `POST /v1/chat/cancel`

Petición:

```json
{ "conversationId": "agerbot-local" }
```

Respuesta `200`:

```json
{ "conversationId": "agerbot-local", "cancelRequested": true }
```

La cancelación es cooperativa y se comprueba entre tokens. Cancelar la tarea HTTP en MISIL también envía esta petición de control.

## Errores

Todos los errores esperados usan el mismo cuerpo:

```json
{
  "error": {
    "code": "checkpoint_invalid",
    "message": "El checkpoint no coincide con su manifiesto.",
    "retryable": false
  }
}
```

Códigos iniciales: `bad_request`, `body_too_large`, `not_found`, `model_unavailable`, `checkpoint_missing`, `checkpoint_manifest_missing`, `checkpoint_invalid`, `tokenizer_missing`, `tokenizer_unsupported`, `tokenizer_vocab_mismatch`, `model_invalid_parameters`, `generation_cancelled`, `conversation_busy` e `internal_error`.

## Modelos estables y actualizaciones

- Cada modelo local requiere `manifest.json` de esquema 2, canal `stable`, SemVer, compatibilidad, tamaño y SHA-256.
- MISIL busca en `~/Library/Application Support/MISIL/Agerbot/models/` y en `checkpoints/*` del proyecto de desarrollo seleccionado.
- La consulta remota usa la API de GitHub Releases para `josanager/Agerbot`, no scraping ni `git pull`.
- Los assets se descargan a temporal mediante `URLSessionDownloadTask`, pueden cancelarse/reanudarse y no sobrescriben el modelo activo.
- Antes de activar, MISIL valida manifiesto, hash, carga, salud, versión y una generación corta en un proceso aislado.
- `current-model.json` se escribe atómicamente. Si la versión nueva no arranca, se restaura la anterior y la fallida queda registrada en `update-state.json`.
- Una activación espera a que termine cualquier generación; el chat continúa usando el modelo anterior durante la descarga.

Al 25 de agosto de 2026, el endpoint público de Releases devuelve 404 porque todavía no se ha publicado `model-v0.2.0`. El flujo se ha probado con transporte HTTP simulado, no con una release real.

## Variables de proceso

- `AGERBOT_CHECKPOINT`: ruta absoluta al `.pt`.
- `AGERBOT_HOST`: debe ser `127.0.0.1` si se especifica.
- `AGERBOT_PORT`: por defecto `4318`.
- `AGERBOT_DEVICE`: `auto`, `cpu`, `mps` o `cuda` según plataforma.

No se pasan secretos como argumentos ni variables. El proceso se inicia con su directorio de trabajo en la instalación Agerbot.
