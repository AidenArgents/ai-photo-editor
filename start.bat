@echo off
setlocal
title AI Photo Editor - Start Server
cd /d "%~dp0"

echo ===================================================
echo        AI Photo Editor - Background Service
echo ===================================================
echo.

if exist "%~dp0.runtime\node\node.exe" set "PATH=%~dp0.runtime\node;%PATH%"
if exist "%~dp0.runtime\git\cmd\git.exe" set "PATH=%~dp0.runtime\git\cmd;%PATH%"

echo [1/3] Checking environment dependencies...
set "NEED_INSTALL="
where node >nul 2>nul
if errorlevel 1 set "NEED_INSTALL=1"
where npm >nul 2>nul
if errorlevel 1 set "NEED_INSTALL=1"
if not exist "node_modules" set "NEED_INSTALL=1"

if defined NEED_INSTALL (
    echo [INFO] First run: preparing the local runtime and project dependencies...
    call "%~dp0install.bat" /quiet
    if errorlevel 1 goto failed
)

if exist "%~dp0.runtime\node\node.exe" set "PATH=%~dp0.runtime\node;%PATH%"
if exist "%~dp0.runtime\git\cmd\git.exe" set "PATH=%~dp0.runtime\git\cmd;%PATH%"

where node >nul 2>nul
if errorlevel 1 goto failed
where npm >nul 2>nul
if errorlevel 1 goto failed

echo [2/3] API Key configuration...
echo [INFO] Each user enters their own Gemini API Key in the web page.

echo [3/3] Launching this project's background service...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0services\server-control.ps1" start
if errorlevel 1 goto failed
start "" "http://localhost:3000"

echo.
echo ===================================================
echo [OK] Background service launched successfully!
echo.
echo 1. Browser is opened at http://localhost:3000
echo 2. Service runs silently in the background.
echo 3. To stop service, run stop.bat in this folder.
echo ===================================================
echo.
if /i "%~1"=="/quiet" exit /b 0
echo Press any key to close this window...
pause > nul
exit /b 0

:failed
echo.
echo [ERROR] AI Photo Editor could not be started.
if /i "%~1"=="/quiet" exit /b 1
echo Press any key to close this window...
pause > nul
exit /b 1
