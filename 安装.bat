@echo off
setlocal
title AI Photo Editor - Install Dependencies
cd /d "%~dp0"

echo ===================================================
echo        AI Photo Editor - Install Dependencies
echo ===================================================
echo.

if exist "%~dp0.runtime\node\node.exe" set "PATH=%~dp0.runtime\node;%PATH%"
if exist "%~dp0.runtime\git\cmd\git.exe" set "PATH=%~dp0.runtime\git\cmd;%PATH%"

echo [1/2] Checking Git and Node.js...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0services\ensure-runtime.ps1" -EnsureGit -EnsureNode
if errorlevel 1 goto failed

if exist "%~dp0.runtime\node\node.exe" set "PATH=%~dp0.runtime\node;%PATH%"
if exist "%~dp0.runtime\git\cmd\git.exe" set "PATH=%~dp0.runtime\git\cmd;%PATH%"

where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git could not be prepared.
    goto failed
)
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js could not be prepared.
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
call npm.cmd --version
echo.
echo [2/2] Installing the versions locked in package-lock.json...
call npm.cmd ci
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
