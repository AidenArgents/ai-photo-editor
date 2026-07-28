@echo off
setlocal EnableDelayedExpansion
title AI Photo Editor - Update
cd /d "%~dp0"

echo ===================================================
echo        AI Photo Editor - Safe Update
echo ===================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git is not installed or is not available in PATH.
    echo ZIP downloads cannot use one-click Git updates.
    goto failed
)

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
    echo [ERROR] This folder is not a Git clone.
    echo Download the new ZIP manually, or clone the GitHub repository with Git.
    goto failed
)

set "DIRTY="
for /f "delims=" %%i in ('git status --porcelain --untracked-files^=normal') do set "DIRTY=1"
if defined DIRTY (
    echo [ERROR] Local source-code changes were found.
    echo Update stopped to avoid overwriting user files.
    echo.
    git status --short
    goto failed
)

echo [1/4] Stopping this project's service...
call "%~dp0stop.bat" /quiet
if errorlevel 1 goto failed

echo.
echo [2/4] Downloading the latest code...
git pull --ff-only
if errorlevel 1 goto failed

echo.
echo [3/4] Installing locked dependencies...
call "%~dp0install.bat" /quiet
if errorlevel 1 goto failed

echo.
echo [4/4] Starting the updated service...
call "%~dp0start.bat" /quiet
if errorlevel 1 goto failed

echo.
echo ===================================================
echo [OK] AI Photo Editor has been updated successfully.
echo ===================================================
echo Press any key to close this window...
pause > nul
exit /b 0

:failed
echo.
echo [ERROR] Update was not completed. Existing files were not overwritten automatically.
echo Press any key to close this window...
pause > nul
exit /b 1
