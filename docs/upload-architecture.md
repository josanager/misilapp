# Arquitectura de Subidas Multipart/Robustas 📂

Las subidas de archivos se están refactorizando fuera del input para ser gestionadas a nivel de aplicación usando una cola asíncrona (`UploadQueueManager`). Esto permite que:

1. El usuario minimice el chat o navegue a otro grupo y la carga continúe sin interrumpirse (Fire and Forget seguro).
2. Se reanuden subidas fallidas (Tus-resumable o Presigned URLs de R2 o S3).
3. Los mensajes "Optimistas" muestren una barra de progreso nativa en el chat con estado (`UploadTask`).

### ¿Qué se ha implementado hasta ahora?
- Creada la abstracción `/src/services/upload/UploadQueue.ts` y las interfaces base `UploadTask`, `UploadTransport`.

### ¿Qué falta para terminar (Pasos Manuales)?
- Configurar tu proveedor externo (ej. **Cloudflare Worker / AWS S3**) para soportar `Multipart Uploads`.
- Implementar la clase que cumpla la interfaz `UploadTransport` llamando a tu Worker usando Axios o Fetch, calculando progreso mediante el objeto `XMLHttpRequest` (XHR upload progress) o Fetch body streams.
- Adaptar `<MessageBubble />` (o `<MessageFileCard />`) para que en estado `pending` o `uploading` lea de esta cola de tareas (Store o Contexto Reactivo) el progreso de su `taskId` correspondiente.
