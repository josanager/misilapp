# Agerbot: política de entrenamiento para beta privada

Este documento define el flujo previsto para una fase posterior. La Fase 1 no entrena desde MISIL.

## Principios

- La participación siempre es explícita, revocable y separada de instalar o usar Agerbot.
- Nada se entrena en segundo plano sin un trabajo visible.
- Antes de usar un archivo, MISIL muestra origen, tamaño, tipo, fragmentos de muestra y resultado del filtro sensible.
- La persona puede excluir archivos o cancelar el lote completo.
- Los mensajes de chats humanos y el historial con Agerbot están excluidos por defecto.
- Cada ejecución conserva configuración, versión base, hash del conjunto preparado, métricas y checkpoint resultante.

## Pipeline local propuesto

1. Selección explícita de carpetas o archivos.
2. Copia a una zona de preparación local con cuota.
3. Normalización y deduplicación.
4. Filtro de datos sensibles y cuarentena.
5. Vista previa y consentimiento final.
6. División reproducible de entrenamiento/evaluación.
7. Entrenamiento con límites de recursos.
8. Evaluación automática y comparación con el modelo activo.
9. Activación manual o descarte.

## Límites mínimos

- CPU y memoria configurables; acelerador solo si la capacidad fue detectada.
- Espacio libre de seguridad antes de iniciar y durante checkpoints.
- Pausa por presión térmica, batería baja o falta de disco.
- Checkpoints atómicos y reanudables.
- Botones visibles para pausar, reanudar y cancelar.
- El modelo activo no se reemplaza hasta superar validación y confirmación manual.

## Datos que no deben entrar automáticamente

- Conversaciones de MISIL o de otras aplicaciones.
- Contraseñas, tokens, llaves privadas y archivos de credenciales.
- Datos financieros, sanitarios o legales identificables.
- Directorios del sistema, llaveros, perfiles de navegador y copias de seguridad.
- Contenido cuya licencia no permita entrenamiento.

## Beta de unas 20 personas

El piloto debe medir fallos, tiempo, temperatura, memoria, espacio y calidad antes de pensar en más nodos. Las métricas técnicas deben excluir contenido y ser opcionales. Cada participante debe conocer que Agerbot es experimental y que los datos seleccionados permanecen bajo su responsabilidad.
