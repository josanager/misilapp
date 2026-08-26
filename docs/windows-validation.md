# Validación manual de MISIL en Windows

Estado actual: **pendiente de ejecución en hardware Windows real**. Compilar en macOS o simular servicios no sustituye esta prueba.

Registra versión de Windows, build, CPU, RAM, GPU, VRAM, driver NVIDIA, hashes y resultado de cada paso.

1. Descarga `MISIL-Setup-VERSION-x64.exe` desde la GitHub Release o, antes de publicar, desde el artifact del runner `windows-latest`.
2. Compara el SHA-256 con `checksums-sha256.txt`.
3. Instala sin Git, Python, PyTorch, Visual Studio, SDK de .NET ni terminal.
4. Comprueba accesos de Inicio y escritorio opcional.
5. Abre MISIL y verifica que los chats normales funcionan por Internet con el MISIL Hub autoalojado.
6. Confirma que Agerbot aparece como contacto `LOCAL` y que su aviso indica que no usa el Hub.
7. Abre Ajustes y confirma Windows, CPU, RAM, RTX 3050 Laptop, VRAM, driver y disco detectados; no aceptes valores hardcodeados.
8. Elige 1, 2, 5, 10 GB y un valor personalizado; prueba también una cuota insuficiente.
9. Pulsa **Instalar Agerbot** y registra runtime CPU, runtime CUDA si es compatible, modelo, tamaños y SHA-256.
10. Confirma que una falla de CUDA muestra el motivo y continúa con CPU.
11. Inicia Agerbot y verifica `Listo · CUDA` o el fallback explícito `Listo · CPU`.
12. Envía preguntas de gastronomía peruana y confirma respuesta sin congelar la interfaz.
13. Cancela una generación y vuelve a enviar después.
14. Comprueba que el chat local no aparece en tráfico ni almacenamiento de MISIL Hub.
15. Cierra MISIL y confirma en Administrador de tareas que no queda su runtime Agerbot.
16. Reabre y confirma historial, modelo y configuración.
17. Simula puerto 4318 ocupado; MISIL no debe matar el proceso ajeno.
18. Simula cierre inesperado del runtime; MISIL debe seguir abierto y permitir reintentar.
19. Suspende y reanuda Windows; verifica recuperación o reinicio manual comprensible.
20. Publica una release de modelo de prueba compatible, descarga, valida y activa.
21. Prueba modelo corrupto, truncado, incompatible y cancelación/reanudación.
22. Fuerza fallo después de activar y confirma rollback y bloqueo de reinstalación automática.
23. Publica una release de MISIL de prueba; comprueba notas, tamaño, descarga y SHA-256.
24. Pulsa **Actualizar y reiniciar**; confirma cierre de Agerbot, instalación externa y reapertura.
25. Fuerza fallo del instalador o arranque y confirma restauración de la versión anterior.
26. Pulsa **Desinstalar Agerbot**; verifica que runtime/modelos desaparecen y el historial se conserva.
27. Desinstala MISIL desde Aplicaciones instaladas y prueba por separado conservar y borrar cada categoría de datos.

Una validación se considera real solo si se adjuntan los resultados de este recorrido en Windows y el hash del instalador probado.
