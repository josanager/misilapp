param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ArtifactsRoot = Join-Path $RepositoryRoot 'windows\artifacts'
$PublishRoot = Join-Path $ArtifactsRoot 'publish'
$UpdaterRoot = Join-Path $ArtifactsRoot 'updater'
$HelperRoot = Join-Path $ArtifactsRoot 'uninstall-helper'
$InstallerRoot = Join-Path $ArtifactsRoot 'installer'
$ReleaseRoot = Join-Path $ArtifactsRoot 'release'
$IconPath = Join-Path $RepositoryRoot 'windows\MISILNative\Resources\MISIL.ico'

if (Test-Path $ArtifactsRoot) { Remove-Item $ArtifactsRoot -Recurse -Force }
New-Item -ItemType Directory -Path $PublishRoot, $UpdaterRoot, $HelperRoot, $InstallerRoot, $ReleaseRoot | Out-Null

if (-not (Test-Path $IconPath)) { throw 'No se encontró el icono oficial de MISIL para Windows.' }

dotnet publish (Join-Path $RepositoryRoot 'windows\MISILNative\MISILNative.csproj') `
    -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:DebugType=None `
    -o $PublishRoot
if ($LASTEXITCODE -ne 0) { throw 'Falló la publicación de MISIL.' }

dotnet publish (Join-Path $RepositoryRoot 'windows\MISILNative.Updater\MISILNative.Updater.csproj') `
    -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:DebugType=None `
    -o $UpdaterRoot
if ($LASTEXITCODE -ne 0) { throw 'Falló la publicación del actualizador externo.' }

dotnet publish (Join-Path $RepositoryRoot 'windows\MISILNative.UninstallHelper\MISILNative.UninstallHelper.csproj') `
    -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:DebugType=None `
    -o $HelperRoot
if ($LASTEXITCODE -ne 0) { throw 'Falló la publicación del ayudante de desinstalación.' }

Copy-Item (Join-Path $UpdaterRoot 'MISIL.Updater.exe') $PublishRoot
Copy-Item (Join-Path $HelperRoot 'MISIL.UninstallHelper.exe') $PublishRoot

$Iscc = Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'
if (-not (Test-Path $Iscc)) { throw 'No se encontró Inno Setup 6.' }
$IsccArguments = @(
    "/DMyAppVersion=$Version"
    "/DPublishDir=$PublishRoot"
    "/DOutputDir=$InstallerRoot"
)
$IsccArguments += "/DSetupIconFile=$IconPath"
$IsccArguments += (Join-Path $RepositoryRoot 'windows\installer\MISIL.iss')
& $Iscc @IsccArguments
if ($LASTEXITCODE -ne 0) { throw 'Falló la creación del instalador Inno Setup.' }

$InstallerName = "MISIL-Setup-$Version-x64.exe"
$Installer = Join-Path $InstallerRoot $InstallerName
if (-not (Test-Path $Installer)) { throw "No se generó $InstallerName." }
Copy-Item $Installer $ReleaseRoot

$PortableName = "MISIL-$Version-win-x64.zip"
$Portable = Join-Path $ReleaseRoot $PortableName
Compress-Archive -Path (Join-Path $PublishRoot '*') -DestinationPath $Portable -CompressionLevel Optimal

$InstallerHash = (Get-FileHash $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
$InstallerSize = (Get-Item $Installer).Length
$ReleaseUrl = "https://github.com/josanager/misilapp/releases/download/v$Version/$InstallerName"
$Manifest = [ordered]@{
    schemaVersion = 1
    product = 'MISIL'
    version = $Version
    channel = 'stable'
    publishedAt = [DateTimeOffset]::UtcNow.ToString('o')
    architecture = 'x64'
    minimumWindowsVersion = '10.0.19041'
    assetName = $InstallerName
    url = $ReleaseUrl
    sizeBytes = $InstallerSize
    sha256 = $InstallerHash
    installerType = 'inno'
    silentArguments = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS'
    restartRequired = $false
    compatibility = @('windows-x64', 'windows-10-2004-or-newer', 'windows-11')
}
$Manifest | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $ReleaseRoot 'misil-release.json') -Encoding utf8

$PortableHash = (Get-FileHash $Portable -Algorithm SHA256).Hash.ToLowerInvariant()
@(
    "$InstallerHash  $InstallerName"
    "$PortableHash  $PortableName"
) | Set-Content (Join-Path $ReleaseRoot 'checksums-sha256.txt') -Encoding ascii

Write-Host "Release de MISIL $Version preparada en $ReleaseRoot"
