@echo off
setlocal
title AI Photo Editor - One-click Setup
cd /d "%~dp0"

echo ===================================================
echo        AI Photo Editor - One-click Setup
echo ===================================================
echo.

set "SETUP_SCRIPT=%~dp0services\setup.ps1"
set "DOWNLOADED_SETUP="

if exist "%SETUP_SCRIPT%" goto run_setup

set "SETUP_SCRIPT=%TEMP%\ai-photo-editor-setup-%RANDOM%-%RANDOM%.ps1"
set "DOWNLOADED_SETUP=1"
echo [INFO] Downloading the setup program...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/AidenArgents/ai-photo-editor/main/services/setup.ps1' -OutFile '%SETUP_SCRIPT%'"
if errorlevel 1 goto failed

:run_setup
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SETUP_SCRIPT%" -InstallParent "%~dp0."
set "SETUP_EXIT=%ERRORLEVEL%"

if defined DOWNLOADED_SETUP del /q "%SETUP_SCRIPT%" >nul 2>nul
if not "%SETUP_EXIT%"=="0" goto failed

echo.
echo ===================================================
echo [OK] Installation and startup completed.
echo ===================================================
echo Press any key to close this window...
pause >nul
exit /b 0

:failed
if defined DOWNLOADED_SETUP del /q "%SETUP_SCRIPT%" >nul 2>nul
echo.
echo [ERROR] Setup was not completed. Review the message above.
echo Press any key to close this window...
pause >nul
exit /b 1
