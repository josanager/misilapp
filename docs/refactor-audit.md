# Chat Latino - Refactor Audit

## Arquitectura Actual
- **Frameworks**: React 18 + Vite + TypeScript.
- **Estado Global**: Zustand con Zustand Persist para caché offline de `authStore`, `groupStore` y `chatStore`.
- **Backend/Transport**: Supabase (PostgreSQL para DB, Auth, Supabase Channels para Realtime y Presence).
- **Almacenamiento (Archivos)**: Cloudflare R2 vía Worker HTTP (`VITE_UPLOAD_WORKER_URL`), desacoplado parcialmente.
- **Estilos**: Variables CSS nativas, sin dependencias pesadas, modo móvil/desktop segregado por componentes.

## Diagnóstico de Problemas (Deuda Técnica)
1. **Envío de mensajes (Optimistic UI Frágil):**
   - El estado de "enviado", "fallido" o "pendiente" no está tipado ni reacciona bien ante errores de red.
   - El input puede quedar colgado si Supabase falla o hay un error HTTP.
2. **Entrada a Grupos (Flicker/Falsos vacíos):**
   - Aunque se mitigó cacheando `messagesByTopic`, cuando no hay caché, la app sigue pasando por un estado `loading` que bloquea la UI o muestra un chat vacío hasta el fin del `fetch`.
3. **Acoplamiento Fuerte de Supabase Realtime:**
   - Todo el realtime vive monolíticamente dentro de `chatStore.ts` (funciones `subscribeToMessages`, `subscribeToPresence`, etc.).
   - Difícil de cambiar a WebSockets puros u otro proveedor sin reescribir la lógica de la UI o de las stores.
4. **Caché Indiscriminado (Memoria Leak Potencial):**
   - `chatStore.persist` guarda todo el historial para cada topic sin límites, pudiendo llevar a un `localStorage` inflado (límite clásico de ~5MB).
5. **Subidas de Archivos (Uploads Básicos):**
   - Actualmente es de tipo "fire and forget". Falta arquitectura para retries, chunks, y una cola (queue) global, esencial si el internet oscila en móvil.
6. **Rendimiento Visual (React Renders):**
   - Cada inserción de mensaje re-renderiza todo el mapa de mensajes en `ChatView.tsx`.
   - Listas sin virtualizar (aceptable para chats pequeños, pero requiere memoización en `<MessageBubble />`).

## Plan de Refactorización (Prioridad)
1. **Core Data Types**: Ampliar `Message` con `status: 'pending' | 'sent' | 'error'`.
2. **Message Flow (ChatStore)**: Implementar una cola de envíos real (`sendMessage` con try-catch fino).
3. **UI States (ChatView)**: Manejar `connectionState` y `initialFetchState`.
4. **Realtime Abstraction**: Mover `supabase.channel` a `/src/services/realtime/SupabaseAdapter.ts`.
5. **Upload Abstraction**: Definir `/src/services/upload/UploadQueue.ts` y tipos base.
6. **Zustand Optimization**: Truncar el caché persistido (máx 50-100 por topic).
