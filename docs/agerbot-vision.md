# MISIL + Agerbot: visión y límites

## Objetivo

MISIL es la aplicación anfitriona de escritorio y Agerbot es un modelo local opcional. La primera integración permite abrir una conversación especial con Agerbot desde MISIL para macOS, iniciar y detener su proceso sin usar Terminal y conservar esa conversación solo en el equipo.

La beta inicial está dirigida a unas 20 personas cercanas. Sigue siendo software experimental: no se presenta como cifrado de extremo a extremo, privado, anónimo ni apto para información sensible.

## Estado auditado antes de la integración

- MISIL ya ofrece conversaciones entre personas mediante MISIL Hub y almacena mensajes locales.
- Agerbot estable 0.2.0 es un transformer educativo de 10.773.504 parámetros, tokenizador `char-v1` y contexto 256.
- El checkpoint activo es `gastronomia-peruana-v2/best.pt`, mejor paso 4.500, con pérdida de validación 0,08549.
- Agerbot solo ofrecía comandos de entrenamiento y generación; cargaba el checkpoint en cada invocación y no tenía API local.
- MISIL y Agerbot viven en repositorios/directorios separados y deben seguir separados.

## Decisiones de arquitectura

1. MISIL nunca importa PyTorch ni el código Python. Se comunica con un proceso Agerbot por HTTP local.
2. El runtime escucha exclusivamente en `127.0.0.1:4318`; no es un servidor de red.
3. El contacto reservado `agerbot-local` no tiene usuario remoto, destinatario ni enlace personal.
4. Los mensajes de Agerbot se guardan en un archivo distinto de los mensajes de MISIL Hub.
5. MISIL no descarga el runtime Agerbot silenciosamente. Los modelos estables sí pueden actualizarse automáticamente en la beta mediante GitHub Releases, con verificación y rollback.
6. Solo se carga un checkpoint con manifiesto SHA-256 válido. Una ruta seleccionada por el usuario no elimina esa comprobación.
7. La primera respuesta de chat es completa. El streaming se deja para una iteración posterior.

## Fases

### Fase 1 — runtime y chat local

- Contrato HTTP y errores estructurados.
- Proceso Agerbot administrado desde MISIL macOS.
- Contacto especial, historial local, estado de pensamiento y cancelación.
- Ajustes de proyecto/checkpoint y diagnóstico de instalación.
- Pruebas de runtime y compilación macOS disponible.

### Fase 2 — modelos versionados y distribución explícita

- Descubrimiento local por manifiestos y migración automática v1 → v2.
- Descarga de modelos desde Releases, progreso, reanudación, verificación y activación atómica.
- Rollback automático y conservación del modelo anterior.
- El empaquetado independiente del runtime y su desinstalación siguen pendientes.

### Fase 3 — entrenamiento local controlado

- Preparación de datos, vista previa, exclusión y consentimiento.
- Trabajos pausables y reanudables con límites de CPU, memoria, disco y temperatura.
- Evaluación local y rollback de modelo.

### Fase 4 — prototipo de dos nodos

- Coordinador propio de MISIL, intercambio de artefactos verificables y agregación reproducible.
- Sin transferencia de texto de conversaciones por defecto.
- Piloto pequeño antes de cualquier escala mayor.

## No objetivos de Fase 1

- Entrenar Agerbot desde MISIL.
- Combinar almacenamiento de equipos para alojar un único proceso del modelo.
- Descargar o instalar automáticamente el runtime Python/PyTorch.
- Exponer Agerbot a Internet o a la LAN.
- Enviar conversaciones de Agerbot por MISIL Hub.
- Prometer privacidad, anonimato o seguridad criptográfica no implementada.

## Criterio de éxito

Con Agerbot instalado localmente y un manifiesto válido, una persona abre MISIL, selecciona Agerbot, inicia el runtime desde la interfaz, envía una pregunta, recibe una continuación del modelo, puede cancelarla y vuelve a ver el historial tras reiniciar. Los chats normales siguen utilizando MISIL Hub sin cambios.
