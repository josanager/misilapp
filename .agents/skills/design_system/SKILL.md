---
name: Sistema de Diseño Misil (Chat Latino)
description: Reglas de diseño y estética visual obligatorias para el desarrollo frontend del proyecto.
---

# Sistema de Diseño y Estética Visual

Esta skill define las reglas obligatorias de diseño, la paleta de colores, la tipografía y los estilos de componentes que deben aplicarse a cualquier nuevo desarrollo o modificación en el frontend de la aplicación "Misil" (Chat Latino).

## 1. Paleta de Colores (Tema Oscuro)

El proyecto actual tiene una paleta definida en CSS inspirada en Telegram, con acentos rojos. Deben respetarse estrictamente las siguientes directrices y usar estas variables CSS:

### Fondos (Backgrounds)
- **Principal:** `#0e1621` (`--bg-primary`)
- **Secundario:** `#17212b` (`--bg-secondary`)
- **Terciario / Modales:** `#1c2733` (`--bg-tertiary`, `--bg-modal`)
- **Hover:** `#242f3d` (`--bg-hover`)
- **Activo:** `#2b5278` (`--bg-active`)
- **Inputs:** `#242f3d` (`--bg-input`)

### Textos
- **Primario:** `#f5f5f5` (`--text-primary`)
- **Secundario:** `#8b9bab` (`--text-secondary`)
- **Silenciado (Muted):** `#6c7883` (`--text-muted`)
- **Enlaces:** `#6ab2f2` (`--text-link`)

### Acentos (Rojos principalmente)
- **Acento Principal:** `#FF3737` (`--accent`)
- **Acento Hover:** `#FF5555` (`--accent-hover`)
- **Acento Oscuro:** `#CC2222` (`--accent-dark`)
- **Gradiente de Acento:** `linear-gradient(135deg, #FF3737, #CC2222)` (`--accent-gradient`)
- **Glow (Resplandor):** `rgba(255, 55, 55, 0.15)` (`--accent-glow`)

## 2. Tipografía

La aplicación utiliza un sistema multi-fuente riguroso. Al crear componentes o actualizar estilos, DEBES usar las siguientes fuentes para los elementos específicos:

- **Space Grotesk:** Úsala EXCLUSIVAMENTE para el nombre de la página web / marca ("Misil") y para los Titulares principales (Headlines: `h1`, `h2`, `h3`, títulos de modales, grandes encabezados).
- **Inter:** Úsala para el Body, es decir, el texto general de la aplicación, mensajes en el chat, descripciones y configuraciones.
- **Plus Jakarta Sans:** Úsala para los Labels (etiquetas de formularios, inputs), elementos pequeños de la interfaz de usuario, metadatos, tags y tooltips.

*Importante:* En cualquier nuevo desarrollo frontend, asegúrate de que estas fuentes estén correctamente importadas (ej. desde Google Fonts) e implementadas usando las variables de CSS actualizadas.

## 3. Estilos de Componentes Específicos

### Botones (Translucidez y Glassmorphism)
- Los botones ya no utilizarán fondos sólidos aburridos y tradicionales, ahora deben tener un diseño **translúcido** (efecto de cristal o capa semitransparente) que se integre elegantemente con los fondos oscuros. 
- Priorizar el uso de fondos con opacidad y resplandores (ej. `background: rgba(255, 55, 55, 0.15)` o `rgba(255, 255, 255, 0.05)`).
- Implementar el efecto aplicando `backdrop-filter: blur(8px)` (o valores ajustados).
- Los bordes perimetrales del botón deben ser sutiles para enmarcar el cristal (ej. `border: 1px solid rgba(255, 255, 255, 0.08)` o bordes sutiles del color de acento).
- **Hover/Interacción:** Aumentar sutilmente la opacidad del fondo o el brillo y escalar ligeramente (`transform: translateY(-1px)`).

### Bordes Redondeados (Sistema Escalonado)
- **Importante:** Los bordes NO deben ser extremadamente redondos (`9999px`) para todos los elementos, ya que distorsiona burbujas de chat, paneles y formularios.
- Se utiliza un **sistema escalonado** de border-radius:
  - `--radius-sm: 10px` — Inputs, campos de formulario, chips pequeños.
  - `--radius-md: 14px` — Burbujas de chat, tarjetas, contenedores medianos.
  - `--radius-lg: 18px` — Paneles, modales, contenedores grandes.
  - `--radius-xl: 24px` — Contenedores principales, sidebars.
  - `--radius-full: 9999px` — SOLO para botones interactivos pequeños, badges, tags y avatares (forma píldora).
- **Regla clave:** Cuanto más grande sea el elemento, MENOR debe ser el border-radius relativo. Las burbujas de chat usan `--radius-md` (14px), los paneles usan `--radius-lg` (18px), y solo los botones y badges usan `--radius-full` (9999px).

### Interactividad y Micro-interacciones generales
- Evitar interfaces rígidas. Todo elemento cliqueable debe tener feedback visual con transiciones fluídas.
