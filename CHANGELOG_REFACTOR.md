# Changelog del Refactor (Arquitectura & Optimización)

## Mejoras de Confiabilidad y Envío de Mensajes
- Tipado `MessageDeliveryStatus` en Types.
- El mensaje local se crea con estado `pending`. Si falla, pasa a `error` y se muestra un botón rojo "❌ Reintentar" en el chat.
- Ya no se borran los mensajes que fallan ni hace falta recargar la web; todo se puede reintentar en vivo.
- La foto del usuario se precarga localmente para evitar parpadeos visuales al momento de enviar el mensaje.

## Entrar a Grupos de forma Instantánea
- Zustand persiste `messagesByTopic` pero truncado a 50 mensajes para evitar desbordar el `localStorage`.
- Se introdujo un campo `initialFetchDone` para diferenciar un chat "vacío real" de uno "en proceso de inicialización inicial".
- No más parpadeos al abrir chats cacheados.

## Arquitectura Realtime Desacoplada
- Toda la lógica atada a `supabase.channel` ha sido abstraída detrás de la interfaz `RealtimeTransport`.
- La suscripción ahora llama al Singleton `realtimeService`, habilitando el reemplazo a futuro con cualquier sistema WebSockets si la aplicación crece inmensamente (ej. Centrifugo).
- Creada guía explícita `docs/broadcast-migration.md`.

## Uploads Robustos Preparados
- Creada la base `UploadQueueManager` y las interfaces de tareas para que los Uploads se separen del input de UI.
- Con esto será muy simple implementar resumabilidad o mostrar la subida de un archivo de 1GB sin que el chat se congele.
