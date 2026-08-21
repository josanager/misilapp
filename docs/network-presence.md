# Red de capacidad en tiempo real

MISIL 0.2.0 incorpora un plano de presencia común para Windows y macOS. Su objetivo es que todas las aplicaciones muestren la suma de las cuotas de los nodos que están realmente conectados a Internet.

## Comportamiento

- Cada instalación genera un identificador UUID y un token aleatorio de 256 bits.
- El token se protege con DPAPI en Windows y con Keychain en macOS. El servidor conserva únicamente su hash SHA-256.
- Un nodo que comparte espacio envía un latido cada 10 segundos con plataforma, versión, cuota, uso y resultado de la comprobación local de almacenamiento.
- Un nodo cuenta como disponible sólo cuando su cuota es mayor que cero, su almacenamiento local está sano y su último latido tiene menos de 35 segundos.
- Al cerrar la aplicación normalmente se envía una baja inmediata. Ante un corte eléctrico o de red, la expiración elimina el nodo del total automáticamente.
- Las lecturas de D1 usan una sesión que empieza en el primario para evitar mostrar una suma anterior después de un latido.

Ejemplo esperado:

| Estado | Windows | macOS | Total visible |
|---|---:|---:|---:|
| Ambos conectados | 10 GiB | 10 GiB | 20 GiB |
| macOS apagado | 10 GiB | fuera de línea | 10 GiB |
| Ambos apagados | fuera de línea | fuera de línea | 0 GiB |

## API

El relay expone tres rutas y cuatro operaciones sin publicar nombres de equipo, rutas locales ni claves:

- `POST /api/network/nodes`: registro idempotente de la instalación.
- `PUT /api/network/presence`: latido autenticado; devuelve la capacidad agregada actual.
- `DELETE /api/network/presence`: baja voluntaria.
- `GET /api/network/capacity`: lectura pública de totales y desglose por plataforma.

La migración D1 está en `migrations/0002_network_presence.sql`. Las Functions también crean la tabla de forma idempotente para que una actualización conectada a GitHub no dependa de una ejecución manual de la migración.

## Alcance de esta versión

La versión 0.2.0 implementa y verifica el plano de capacidad: descubre nodos, valida que el almacén local y su clave están disponibles, suma cuotas y retira nodos desconectados. El transporte y la asignación de bloques de archivos entre ordenadores es un plano de datos separado; no debe considerarse implementado por el contador de capacidad.

## Prueba local reproducible

```bash
npm run test:local
npm run build
npm run relay:migrate:local
npx wrangler pages dev dist --port 8788
```

Para dirigir una app nativa al relay local durante una prueba:

```bash
MISIL_RELAY_URL=http://127.0.0.1:8788 /ruta/a/MISIL
```

En producción las aplicaciones usan `https://misil-web.pages.dev` salvo que se defina `MISIL_RELAY_URL`.
