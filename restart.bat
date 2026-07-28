@echo off
setlocal
title AI Photo Editor - Restart Server
cd /d "%~dp0"

echo ===================================================
echo        AI Photo Editor - Restarting Service
echo ===================================================
echo.

if not exist "node_modules" (
    echo [INFO] Project dependencies are missing. Installing them first...
    call "%~dp0install.bat" /quiet
    if errorlevel 1 goto failed
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0services\server-control.ps1" restart
if errorlevel 1 goto failed
start "" "http://localhost:3000"

echo.
echo ===================================================
echo Service restarted! Browser opened at localhost:3000
echo If the browser tab was already open, press F5.
echo ===================================================
if /i "%~1"=="/quiet" exit /b 0
echo Press any key to close this window...
pause > nul
exit /b 0

:failed
echo.
echo [ERROR] AI Photo Editor could not be restarted.
if /i "%~1"=="/quiet" exit /b 1
echo Press any key to close this window...
pause > nul
exit /b 1
