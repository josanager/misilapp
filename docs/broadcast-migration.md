# Migración a una nueva capa Realtime / WebSockets

Actualmente, **Chat Latino** usa `Supabase Realtime` (por medio de `postgres_changes` y canales de Presencia). Esto funciona de maravilla con PostgreSQL, pero a alta escala, las conexiones a la base de datos o el canal de Broadcast podrían ser costosos.

Para evolucionar a una solución de WebSockets más liviana (como un servidor Node.js/Go con Redis Pub/Sub, Socket.io o Centrifugo), el código ha sido completamente **desacoplado**:

### ¿Cómo migrar?

1. Dirígete a `/src/services/realtime/RealtimeTransport.ts`. Esta interfaz define lo único que necesita la UI y el Store para funcionar.
   - `subscribeToTopicMessages`
   - `subscribeToTopicReactions`
   - `subscribeToPresence`

2. Crea una nueva clase que implemente `RealtimeTransport`, por ejemplo:
   `export class MiNuevoSocketAdapter implements RealtimeTransport { ... }`

3. En `/src/services/realtime/SupabaseRealtimeAdapter.ts`, en lugar de exportar `new SupabaseRealtimeAdapter()`, exporta tu nuevo adapter:
   ```typescript
   export const realtimeService = new MiNuevoSocketAdapter('ws://api.chatlatino.app');
   ```

Con estos simples pasos, toda la UI y los Stores (Zustand) empezarán a usar el nuevo sistema de tiempo real automáticamente sin modificar ni un solo componente de React.

### Dependencias Manuales (Si te sales de Supabase)
- El nuevo servidor debe devolver la estructura del tipo `Message` según se define en `src/lib/supabase.ts`.
- Recuerda replicar las políticas de seguridad (RLS) en tu backend.
