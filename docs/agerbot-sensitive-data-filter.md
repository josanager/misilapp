# Filtro de datos sensibles para Agerbot

Este filtro pertenece a la futura preparación de datos. No se aplica todavía a conversaciones ni habilita entrenamiento en Fase 1.

## Objetivo

Reducir la inclusión accidental de secretos o información personal sin afirmar que la detección sea perfecta. Un resultado limpio no convierte un conjunto en seguro.

## Capas propuestas

1. **Rutas y tipos bloqueados:** llaveros, `.ssh`, perfiles de navegador, gestores de contraseñas, historiales de terminal, archivos `.env`, bases de credenciales y claves privadas.
2. **Patrones de secretos:** tokens con prefijos conocidos, bloques PEM, credenciales en URL, cadenas de conexión y pares usuario/contraseña.
3. **Identificadores personales:** correos, teléfonos, documentos nacionales, direcciones, cuentas financieras y fechas asociadas a nombres.
4. **Heurísticas de contexto:** palabras como contraseña, secreto, paciente, expediente o tarjeta elevan el nivel de revisión.
5. **Vista previa humana:** todo hallazgo muestra fragmento redactado, motivo, archivo y acción recomendada.

## Resultado por elemento

- `allow`: no se detectó una regla conocida; aún requiere consentimiento.
- `review`: posible dato sensible; queda excluido hasta aprobación explícita.
- `block`: secreto de alta confianza o ruta prohibida; no puede incluirse en la beta.

## Registro mínimo

Se guarda localmente la regla activada, hash del archivo, decisión y hora. No se guarda el valor sensible detectado. Los registros tienen retención limitada y pueden borrarse desde MISIL.

## Pruebas mínimas futuras

- Corpus sintético de secretos conocidos y falsos positivos.
- Archivos grandes, binarios, codificaciones inválidas y enlaces simbólicos.
- Comprobación de que ningún fragmento sensible aparece en logs o telemetría.
- Revisión manual de falsos negativos antes del piloto de entrenamiento.
