@echo off
setlocal
title AI Photo Editor - Restart Server
cd /d "%~dp0"

echo ===================================================
echo        AI Photo Editor - Restarting Service
echo ===================================================
echo.

if exist "%~dp0.runtime\node\node.exe" set "PATH=%~dp0.runtime\node;%PATH%"
if exist "%~dp0.runtime\git\cmd\git.exe" set "PATH=%~dp0.runtime\git\cmd;%PATH%"

set "NEED_INSTALL="
where node >nul 2>nul
if errorlevel 1 set "NEED_INSTALL=1"
where npm >nul 2>nul
if errorlevel 1 set "NEED_INSTALL=1"
if not exist "node_modules" set "NEED_INSTALL=1"

if defined NEED_INSTALL (
    echo [INFO] Preparing the local runtime and project dependencies...
    call "%~dp0°²×°.bat" /quiet
    if errorlevel 1 goto failed
)

if exist "%~dp0.runtime\node\node.exe" set "PATH=%~dp0.runtime\node;%PATH%"
if exist "%~dp0.runtime\git\cmd\git.exe" set "PATH=%~dp0.runtime\git\cmd;%PATH%"

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
