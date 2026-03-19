# Configuración Manual (Fuera del Repositorio)

1. **Activar Supabase Realtime (Tablas):**
   Asegúrate de ir a _Supabase Dashboard_ > _Database_ > _Replication_, y enciende "Insert/Update/Delete" para las tablas:
   - `messages`
   - `message_reactions`
   *(Si el frontend nota desconexiones o falta de sync, es porque esto sigue apagado).*

2. **Bucket & RLS para Cloudflare (Si aplica):**
   Si pasas el `UploadQueue` de R2 a un storage directo de Supabase por cuestiones de ancho de banda o conveniencia:
   Crea el bucket `media` en Storage y aplica políticas de inserción pública (o solo autenticados), ya que por defecto los buckets bloquean las subidas.

3. **Migrar al Nuevo Adapter (Opcional, Escalamiento):**
   Revisa `docs/broadcast-migration.md`. Si mantienes Supabase a corto plazo, no tienes que cambiar nada de código.
