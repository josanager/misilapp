# Arquitectura local de MISIL

## Alcance de esta fase

La aplicación trabaja como un nodo autónomo en un solo equipo. `local-node/server.mjs` conserva el estado y los archivos para los procesos de escritorio que lo integren. No se necesita una cuenta remota y el nodo no escucha conexiones desde la red local o Internet.

## Flujo de datos

1. El cliente de escritorio envía mensajes y archivos a `http://127.0.0.1:4317/v1`.
2. Los metadatos se validan y se escriben en `.misil-data/misil.sqlite`.
3. Cada archivo se procesa como flujo, se separa en bloques de 4 MiB y se cifra con AES-256-GCM.
4. Cada bloque recibe un IV aleatorio y una etiqueta de autenticación independientes.
5. La base registra el hash SHA-256, tamaño, bloques y relación con el mensaje.
6. Al reproducir contenido, el nodo descifra únicamente los bloques incluidos en el rango solicitado.

## Estructura del directorio

```text
.misil-data/
├── misil.sqlite
├── misil.sqlite-wal
├── misil.sqlite-shm
├── master.key
├── blobs/<blob-id>/<chunk>.bin
└── tmp/
```

`master.key` es imprescindible para recuperar los archivos. Perderla hace que los bloques cifrados sean irrecuperables; copiarla junto con la base y `blobs/` permite restaurar el nodo.

## Límites y defensas

- El proceso escucha exclusivamente en IPv4 loopback.
- Se valida el encabezado `Host` para reducir ataques de DNS rebinding.
- CORS solo permite orígenes `localhost` y `127.0.0.1`.
- La cuota se vuelve a comprobar dentro de una sección de confirmación serializada para impedir que subidas simultáneas la excedan.
- SQLite usa claves foráneas, modo WAL, escrituras transaccionales y borrado en cascada.
- Los archivos temporales se eliminan al iniciar y después de errores o cancelaciones.
- Un archivo solo puede borrarse si ningún mensaje lo referencia.

La cifra protege los datos en reposo frente a una lectura casual del directorio de bloques. No protege contra una persona o programa que controle el equipo mientras el nodo está ejecutándose, porque el proceso necesita tener acceso a la clave para mostrar el contenido.

## Siguientes fases

1. Empaquetar interfaz y nodo como aplicación de escritorio firmada.
2. Crear identidad criptográfica por dispositivo y recuperación segura.
3. Diseñar descubrimiento y transporte entre nodos con autenticación mutua.
4. Añadir cifrado de extremo a extremo por conversación.
5. Implementar fragmentación con erasure coding, replicación, disponibilidad y reparación.
6. Incorporar contabilidad verificable de espacio aportado y límites de ancho de banda.
7. Someter protocolo, criptografía y actualizador a auditorías independientes antes de una red pública.
