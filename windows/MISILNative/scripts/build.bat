@echo off
setlocal
echo ==========================================
echo    Compilando MISIL Native para Windows  
echo ==========================================
echo.

cd /d "%~dp0\.."

if exist "dist" (
    rmdir /s /q "dist"
)
mkdir "dist"

dotnet publish MISILNative.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o dist

if %ERRORLEVEL% equ 0 (
    echo.
    echo ==========================================
    echo    Compilacion completada con exito!     
    echo ==========================================
    echo Ejecutable generado en: %~dp0..\dist\MISIL.exe
) else (
    echo.
    echo [ERROR] La compilacion ha fallado. Verifica que .NET 8 SDK este instalado.
)

pause
