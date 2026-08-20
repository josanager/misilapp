# MISIL Windows Native Build Script
param (
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [switch]$SingleFile = $true
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$DistDir = Join-Path $ProjectDir "dist"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Compilando MISIL Native para Windows   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Proyecto: $ProjectDir"
Write-Host "Configuración: $Configuration"
Write-Host "Runtime: $Runtime"
Write-Host ""

# Ensure dist directory exists and is clean
if (Test-Path $DistDir) {
    Remove-Item -Path $DistDir -Recurse -Force
}
New-Item -ItemType Directory -Path $DistDir | Out-Null

# Publish self-contained executable
Write-Host "Publicando ejecutable autónomo (.exe)..." -ForegroundColor Yellow
$PublishArgs = @(
    "publish",
    "$ProjectDir/MISILNative.csproj",
    "-c", $Configuration,
    "-r", $Runtime,
    "--self-contained", "true",
    "-p:PublishSingleFile=$($SingleFile.ToString().ToLower())",
    "-p:IncludeNativeLibrariesForSelfExtract=true",
    "-p:EnableCompressionInSingleFile=true",
    "-o", $DistDir
)

& dotnet @PublishArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "   ¡Compilación completada con éxito!     " -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "El ejecutable se encuentra en: $DistDir\MISIL.exe" -ForegroundColor Green
} else {
    Write-Host "Error durante la compilación." -ForegroundColor Red
    exit 1
}
