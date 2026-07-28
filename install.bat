@echo off
setlocal
title AI Photo Editor - Install Dependencies
cd /d "%~dp0"

echo ===================================================
echo        AI Photo Editor - Install Dependencies
echo ===================================================
echo.

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

echo [INFO] Node.js:
node --version
echo [INFO] npm:
npm --version
echo.
echo [INFO] Installing the versions locked in package-lock.json...
call npm ci
if errorlevel 1 goto failed

echo.
echo [OK] Project dependencies are ready.
if /i "%~1"=="/quiet" exit /b 0
echo Press any key to close this window...
pause > nul
exit /b 0

:failed
echo.
echo [ERROR] Dependency installation failed.
if /i "%~1"=="/quiet" exit /b 1
echo Press any key to close this window...
pause > nul
exit /b 1
