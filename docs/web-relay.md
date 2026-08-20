# MISIL Web y relay temporal

## Alcance de esta fase

La web pública se divide en tres rutas:

- `/`: presentación y descarga de la aplicación.
- `/chat`: chat web independiente, limitado a mensajes de texto.
- `/local`: interfaz de diagnóstico del nodo local; no forma parte del flujo público normal.

Los archivos no pueden subirse desde ninguna pantalla web. La aplicación nativa es la única superficie prevista para seleccionar archivos, cifrarlos y aportar almacenamiento.

## Modelo de seguridad del relay

Al crear un espacio web, el navegador genera tres secretos:

1. un identificador aleatorio de espacio;
2. un token de acceso;
3. una clave AES-GCM de 256 bits.

Cloudflare D1 conserva el hash del token y los sobres cifrados. La clave AES no se envía al relay. El código privado exportado por el navegador contiene los secretos necesarios para entrar desde otro dispositivo, por lo que debe tratarse como una contraseña.

Los mensajes se eliminan automáticamente al vencer siete días. Las salas vencen después de noventa días en esta primera versión. Esto es un transporte temporal, no una copia de seguridad.

## Desarrollo local

`npm run dev` utiliza la implementación equivalente del relay incluida en `local-node/` mediante el proxy de Vite. Así `/chat` funciona sin una cuenta de Cloudflare.

Para probar exactamente Pages Functions y D1 local:

```bash
npm run build
npm run relay:migrate:local
npm run dev:cloud
```

La vista estará en `http://localhost:8788`.

## Publicación en Cloudflare

1. Autenticar Wrangler: `npx wrangler login`.
2. Crear D1: `npx wrangler d1 create misil-relay`.
3. Sustituir el `database_id` provisional de `wrangler.toml` por el valor real.
4. Ejecutar `npm run relay:migrate:remote`.
5. Crear el proyecto Pages `misil-web` y ejecutar `npm run deploy:pages`.

El dominio provisional será `misil-web.pages.dev` si el nombre está disponible.

## Límites conocidos

- El código compartido concede acceso completo al espacio. Las identidades individuales con claves públicas llegarán en una fase posterior.
- El relay aún usa sondeo cada 2,5 segundos; WebSocket/P2P se añadirá después.
- El cifrado protege el contenido, pero Cloudflare todavía puede observar metadatos como hora, IP y tamaño aproximado.
- La aplicación macOS alpha ya puede crear o unir espacios del relay, guardar la identidad en el Llavero y sincronizar mensajes de texto. La distribución P2P de archivos continúa siendo una fase posterior.
