@echo off
setlocal
title AI Photo Editor - Start Server
cd /d "%~dp0"

echo ===================================================
echo        AI Photo Editor - Background Service
echo ===================================================
echo.

echo [1/3] Checking environment dependencies...
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or is not available in PATH.
    echo Please install Node.js first, then run this file again.
    goto failed
)
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm is not available in PATH.
    goto failed
)
if not exist "node_modules" (
    echo [INFO] First run: installing project dependencies...
    call "%~dp0install.bat" /quiet
    if errorlevel 1 goto failed
)

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
