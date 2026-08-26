# Mensajería por Internet con MISIL Hub

## Arquitectura

Cada aplicación abre una conexión WebSocket saliente hacia un MISIL Hub propio. Las conexiones salientes funcionan detrás de la mayoría de routers y CGNAT sin abrir puertos en los equipos Windows o Mac.

```text
MISIL para Windows ──WSS──┐
                          ├── MISIL Hub autoalojado ── SQLite
MISIL para macOS ───WSS───┘
```

El Hub registra el nombre único y la llave de cada instalación, entrega mensajes en tiempo real y conserva mensajes pendientes para equipos desconectados. En esta primera versión el contenido no está cifrado de extremo a extremo y el administrador del Hub puede leer la base de datos.

## Identidad y enlaces

Al iniciarse por primera vez, cada app genera:

- un identificador UUID de equipo;
- una llave aleatoria de 256 bits;
- un nombre de usuario basado en el nombre del equipo más un sufijo aleatorio;
- un enlace `misil://contacto/<usuario>/<equipo>`.

El usuario copia ese enlace desde Chats y lo pega en la otra instalación. Ambas aplicaciones deben utilizar la misma dirección de Hub.

## Prueba local

```bash
npm install
npm run hub:start
npm run test:hub
```

El Hub de desarrollo escucha en `ws://127.0.0.1:4320/v1/connect`.

## Publicación autoalojada

Se necesita una máquina controlada por el proyecto que sea accesible desde Internet. Puede ser un servidor físico propio con IP pública o una máquina pública administrada por el equipo. Si el proveedor de Internet usa CGNAT y no ofrece una dirección entrante, un equipo doméstico no puede actuar como punto público por sí solo.

Requisitos:

- Linux con Docker y Docker Compose;
- un dominio apuntando a la IP pública del servidor;
- puertos TCP 80 y 443 abiertos; opcionalmente UDP 443 para HTTP/3.

En el servidor:

```bash
git clone https://github.com/josanager/misilapp.git
cd misilapp
export MISIL_HUB_DOMAIN=hub.tudominio.com
docker compose -f docker-compose.hub.yml up -d --build
curl https://hub.tudominio.com/health
```

Caddy obtiene y renueva el certificado TLS. El servicio guarda SQLite en el volumen `hub-data`; no usa bases de datos ni APIs externas.

Después, en cada app:

1. Abrir **Ajustes → Conexión por Internet**.
2. Escribir `wss://hub.tudominio.com/v1/connect`.
3. Elegir un nombre único y guardar.
4. Reiniciar MISIL.
5. Copiar el enlace personal de Chats y enviarlo al otro equipo.

## Variables del Hub

| Variable | Valor predeterminado | Función |
| --- | --- | --- |
| `MISIL_HUB_HOST` | `0.0.0.0` | Interfaz de escucha |
| `MISIL_HUB_PORT` | `4320` | Puerto interno |
| `MISIL_HUB_DATA_DIR` | `.misil-hub` | Directorio de SQLite |

El cliente también reconoce `MISIL_HUB_URL` durante la creación inicial de identidad. La configuración guardada desde Ajustes tiene efecto después de reiniciar la aplicación.
