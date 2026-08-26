# Distribución y actualización de MISIL para Windows

## Resultado de release

El workflow `.github/workflows/build-windows.yml`, visible como **Build and package MISIL for Windows**, ejecuta las pruebas en `windows-latest`, publica tres ejecutables autocontenidos y compila Inno Setup 6.

Cada tag estable `vX.Y.Z` o beta `vX.Y.Z-beta.N` genera:

- `MISIL-Setup-X.Y.Z-x64.exe`: instalador per-user recomendado.
- `MISIL-X.Y.Z-win-x64.zip`: copia portable opcional.
- `misil-release.json`: contrato consumido por el actualizador.
- `checksums-sha256.txt`: hashes del setup y ZIP.

Las ejecuciones manuales o de `main` solo crean artifacts con caducidad; no publican una release. Los tags beta publican una GitHub Release marcada como prerelease, que el actualizador estable ignora. El código fuente nunca se descarga ni clona en la laptop del usuario.

## Instalador

Inno Setup instala en `%LOCALAPPDATA%\Programs\MISIL`, crea un acceso en Inicio y ofrece uno opcional en el escritorio. `PrivilegesRequired=lowest` evita elevación. Los datos mutables permanecen fuera de esa carpeta.

La desinstalación desde Windows detiene el Agerbot administrado y pregunta separadamente si debe borrar runtime/modelos/caché, conversación local y configuración. La respuesta predeterminada conserva datos personales.

## Actualizador externo

MISIL consulta la lista de GitHub Releases del repositorio `josanager/misilapp`, ordena SemVer y descarta draft/prerelease en el canal estable. No usa ramas, commits, `git pull` ni `releases/latest` para decidir una versión.

El flujo es:

1. validar `misil-release.json`, arquitectura, Windows mínimo, nombre, URL, tamaño y SHA-256;
2. descargar con Range, reanudación y cancelación;
3. impedir actualizar durante una generación activa;
4. copiar `MISIL.Updater.exe` fuera de la carpeta instalada;
5. cerrar MISIL y Agerbot;
6. verificar nuevamente el setup y respaldar la aplicación instalada;
7. ejecutar Inno Setup silenciosamente;
8. reabrir MISIL y observarlo durante cinco segundos;
9. conservar la nueva versión si permanece abierta o restaurar los archivos anteriores si falla.

No existe todavía certificado Authenticode. SHA-256 y HTTPS son obligatorios; cuando se incorpore un certificado, el pipeline y el actualizador deberán fijar y validar el firmante antes de habilitar publicación estable firmada.

## Publicar

1. Actualiza la versión en `windows/MISILNative/MISILNative.csproj` y en los proyectos auxiliares.
2. Ejecuta pruebas locales y revisa que no existan `.pt`, secretos, certificados privados, `bin`, `obj` ni entornos Python en Git.
3. Sube los cambios al repositorio oficial `https://github.com/josanager/misilapp.git`.
4. Ejecuta manualmente el workflow para validar el setup como artifact.
5. Prueba ese artifact en una laptop Windows según `docs/windows-validation.md`.
6. Para una prueba física inicial usa un tag como `v0.3.0-beta.1`; el workflow publicará una prerelease descargable que no entra en las actualizaciones automáticas.
7. Solo después de validar esa beta crea y sube el tag estable coincidente, por ejemplo `v0.3.0`.

No debe publicarse una release estable si la matriz manual sigue pendiente.
