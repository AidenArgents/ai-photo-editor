@echo off
setlocal
title AI Photo Editor - Stop Server
cd /d "%~dp0"

echo ===================================================
echo        AI Photo Editor - Stop Background Service
echo ===================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0services\server-control.ps1" stop
if errorlevel 1 goto failed

echo.
echo ===================================================
echo [OK] AI Photo Editor service is stopped.
echo ===================================================
if /i "%~1"=="/quiet" exit /b 0
echo Press any key to close this window...
pause > nul
exit /b 0

:failed
echo.
echo [ERROR] The service could not be stopped safely.
if /i "%~1"=="/quiet" exit /b 1
echo Press any key to close this window...
pause > nul
exit /b 1
