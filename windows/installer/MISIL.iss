#ifndef MyAppVersion
  #define MyAppVersion "0.3.0"
#endif
#ifndef PublishDir
  #define PublishDir "..\artifacts\publish"
#endif
#ifndef OutputDir
  #define OutputDir "..\artifacts\installer"
#endif
#ifndef SetupIconFile
  #define SetupIconFile "..\MISILNative\Resources\MISIL.ico"
#endif

[Setup]
AppId={{93AE879A-EC2E-4B71-A67B-32FBA42D7E16}
AppName=MISIL
AppVersion={#MyAppVersion}
AppPublisher=MISIL
AppPublisherURL=https://github.com/josanager/misilapp
AppSupportURL=https://github.com/josanager/misilapp/issues
AppUpdatesURL=https://github.com/josanager/misilapp/releases
MinVersion=10.0.19041
DefaultDirName={localappdata}\Programs\MISIL
DefaultGroupName=MISIL
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#OutputDir}
OutputBaseFilename=MISIL-Setup-{#MyAppVersion}-x64
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
SetupLogging=yes
UninstallDisplayName=MISIL
UninstallDisplayIcon={app}\MISIL.exe
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany=MISIL
VersionInfoDescription=Instalador de MISIL para Windows
VersionInfoProductName=MISIL
VersionInfoProductVersion={#MyAppVersion}
ChangesEnvironment=no
SetupIconFile={#SetupIconFile}

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear un acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: unchecked

[Files]
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.pdb,*.xml"

[Icons]
Name: "{group}\MISIL"; Filename: "{app}\MISIL.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\MISIL"; Filename: "{app}\MISIL.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\MISIL.exe"; Description: "Abrir MISIL"; Flags: nowait postinstall skipifsilent

[Code]
var
  DeleteAgerbotData: Boolean;
  DeleteConversation: Boolean;
  DeleteSettings: Boolean;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
  LocalDataRoot: String;
  RoamingDataRoot: String;
begin
  LocalDataRoot := ExpandConstant('{localappdata}\MISIL');
  RoamingDataRoot := ExpandConstant('{userappdata}\MISIL');

  if CurUninstallStep = usUninstall then
  begin
    if FileExists(ExpandConstant('{app}\MISIL.UninstallHelper.exe')) then
      Exec(ExpandConstant('{app}\MISIL.UninstallHelper.exe'), '--stop-agerbot', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    DeleteAgerbotData := MsgBox(
      '¿Deseas eliminar también el runtime, los modelos y la caché administrada de Agerbot?',
      mbConfirmation, MB_YESNO) = IDYES;
    DeleteConversation := MsgBox(
      '¿Deseas eliminar el historial local de conversación con Agerbot?',
      mbConfirmation, MB_YESNO) = IDYES;
    DeleteSettings := MsgBox(
      '¿Deseas eliminar la configuración personal de MISIL?',
      mbConfirmation, MB_YESNO) = IDYES;
  end;

  if CurUninstallStep = usPostUninstall then
  begin
    if DeleteAgerbotData then
    begin
      DelTree(LocalDataRoot + '\Agerbot', True, True, True);
      DelTree(LocalDataRoot + '\updates', True, True, True);
    end;
    if DeleteConversation then
      DeleteFile(LocalDataRoot + '\agerbot-conversation.json');
    if DeleteSettings then
    begin
      DelTree(RoamingDataRoot, True, True, True);
      DeleteFile(LocalDataRoot + '\configuration.json');
    end;
  end;
end;
