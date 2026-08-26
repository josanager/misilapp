# Prototipo Agerbot de dos nodos

Este documento es un diseño futuro. No forma parte de la Fase 1 y no está implementado.

## Pregunta que debe responder el prototipo

¿Pueden dos equipos aportar trabajos de entrenamiento verificables y producir una versión agregada de Agerbot sin transferir sus textos originales?

Compartir 10 GB en cada equipo no crea automáticamente 20 GB de memoria o disco para un único proceso. Cada nodo conserva almacenamiento y cómputo local; un coordinador solo contabiliza disponibilidad y mueve artefactos explícitos.

## Topología mínima

```text
MISIL nodo A ── HTTPS/WebSocket ── Coordinador MISIL ── HTTPS/WebSocket ── MISIL nodo B
     │                                                            │
Runtime Agerbot local                                   Runtime Agerbot local
```

El coordinador puede ser software propio y autohospedado, pero sigue siendo infraestructura de Internet. No se reutiliza el canal de chat como transporte de entrenamiento.

## Ronda propuesta

1. El coordinador publica versión base, configuración, fecha límite y requisitos.
2. Cada nodo acepta la ronda y prepara datos localmente.
3. Cada nodo entrena desde la misma base y produce un delta/checkpoint con manifiesto.
4. Se suben artefactos limitados, métricas agregadas y hashes; nunca texto bruto por defecto.
5. El coordinador valida formato, tamaño, versión y métricas.
6. Se realiza agregación ponderada reproducible.
7. La versión candidata se evalúa antes de publicarse.
8. Ambos nodos descargan solo tras consentimiento y conservan rollback.

## Seguridad mínima antes de probar

- Autenticación de nodo, TLS, límites de tamaño y frecuencia.
- Manifiestos firmados o al menos hashes anclados en la ronda.
- Deserialización restringida; no ejecutar objetos arbitrarios de checkpoints remotos.
- Aislamiento del proceso de entrenamiento y cuotas de disco.
- Eliminación de artefactos incompletos y recuperación tras interrupciones.
- Registro técnico sin prompts, textos ni secretos.

## Criterio para avanzar

Dos nodos controlados completan diez rondas reproducibles, toleran desconexión/reanudación y producen un modelo evaluable sin intercambiar el corpus original. Hasta entonces no se amplía el número de participantes.
