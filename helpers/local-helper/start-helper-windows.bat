@echo off
setlocal

if "%NSDH_HELPER_PORT%"=="" set "NSDH_HELPER_PORT=4173"
if "%NSDH_APEX_ORIGIN%"=="" set "NSDH_APEX_ORIGIN=https://apex.oraclecorp.com"

set "INSTALL_DIR=%LOCALAPPDATA%\NSDemoHelper"
set "INSTALL_LAUNCHER=%INSTALL_DIR%\start-helper-windows.bat"
set "INSTALL_COMPAT=%INSTALL_DIR%\helper-windows.bat"
set "INSTALL_PS=%INSTALL_DIR%\nsdemohelper-local-helper.ps1"
set "SOURCE_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_FILE=%STARTUP_DIR%\NS DemoHelper Local Helper.cmd"

if /I "%~1"=="--serve" goto serve
if /I "%~1"=="--stop" goto stop
if /I "%~1"=="--uninstall" goto uninstall
if /I "%~1"=="--status" goto status

:install
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /Y "%SOURCE_DIR%start-helper-windows.bat" "%INSTALL_LAUNCHER%" >nul
copy /Y "%SOURCE_DIR%helper-windows.bat" "%INSTALL_COMPAT%" >nul
copy /Y "%SOURCE_DIR%nsdemohelper-local-helper.ps1" "%INSTALL_PS%" >nul
if errorlevel 1 (
  echo NS DemoHelper Local Helper could not copy all required files.
  echo Make sure the zip was extracted before running this helper.
  pause
  exit /b 1
)

if not exist "%STARTUP_DIR%" mkdir "%STARTUP_DIR%"
(
  echo @echo off
  echo start "NS DemoHelper Local Helper" /min "%INSTALL_LAUNCHER%" --serve
) > "%STARTUP_FILE%"

echo NS DemoHelper Local Helper is installed.
echo It will start automatically when you sign in.
echo Endpoint: http://127.0.0.1:%NSDH_HELPER_PORT%
echo.
echo Starting the helper now...
start "NS DemoHelper Local Helper" "%INSTALL_LAUNCHER%" --serve
echo Keep Codex open and signed in, then return to APEX and click Test Connection.
echo.
echo To check status later, run:
echo   "%INSTALL_LAUNCHER%" --status
echo To stop later, run:
echo   "%INSTALL_LAUNCHER%" --stop
echo To uninstall later, run:
echo   "%INSTALL_LAUNCHER%" --uninstall
pause
exit /b 0

:stop
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port=[int]$env:NSDH_HELPER_PORT; if(-not $port){$port=4173};" ^
  "$conn=Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1;" ^
  "if($conn){ Stop-Process -Id $conn.OwningProcess -Force; Write-Host 'NS DemoHelper Local Helper stopped.' } else { Write-Host 'No Local Helper process was found on that port.' }"
pause
exit /b 0

:uninstall
call "%INSTALL_LAUNCHER%" --stop
del "%STARTUP_FILE%" >nul 2>&1
rmdir /S /Q "%INSTALL_DIR%" >nul 2>&1
echo NS DemoHelper Local Helper uninstalled.
pause
exit /b 0

:status
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port=[int]$env:NSDH_HELPER_PORT; if(-not $port){$port=4173};" ^
  "try { Invoke-RestMethod -Uri ('http://127.0.0.1:' + $port + '/api/helper/status') -TimeoutSec 5 | ConvertTo-Json -Depth 10 } catch { Write-Host $_.Exception.Message }"
pause
exit /b 0

:serve
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%INSTALL_PS%" (
  if exist "%SOURCE_DIR%nsdemohelper-local-helper.ps1" copy /Y "%SOURCE_DIR%nsdemohelper-local-helper.ps1" "%INSTALL_PS%" >nul
)
if not exist "%INSTALL_PS%" (
  echo NS DemoHelper Local Helper could not find nsdemohelper-local-helper.ps1.
  echo Re-download the Windows helper zip and run start-helper-windows.bat again.
  pause
  exit /b 1
)

echo Starting NS DemoHelper Local Helper on http://127.0.0.1:%NSDH_HELPER_PORT%
echo Keep this window open while using the APEX app.
powershell -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_PS%"
exit /b %ERRORLEVEL%
