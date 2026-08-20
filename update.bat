@echo off
setlocal EnableDelayedExpansion

if /i "%~1"=="/worker" goto worker

title AI Photo Editor - Update
set "PROJECT_ROOT=%~dp0"
set "QUIET_ARG="
if /i "%~1"=="/quiet" set "QUIET_ARG=/quiet"
set "WORKER_SCRIPT=%TEMP%\ai-photo-editor-update-%RANDOM%-%RANDOM%.bat"
copy /y "%~f0" "%WORKER_SCRIPT%" >nul 2>nul
if errorlevel 1 goto bootstrap_failed
call "%WORKER_SCRIPT%" /worker "%PROJECT_ROOT%" %QUIET_ARG%
set "WORKER_EXIT=%ERRORLEVEL%"
del /q "%WORKER_SCRIPT%" >nul 2>nul
exit /b %WORKER_EXIT%

:bootstrap_failed
echo [ERROR] Could not prepare the temporary update worker.
if defined QUIET_ARG exit /b 1
echo Press any key to close this window...
pause > nul
exit /b 1

:worker
set "PROJECT_ROOT=%~2"
set "QUIET_ARG="
if /i "%~3"=="/quiet" set "QUIET_ARG=/quiet"
title AI Photo Editor - Update
cd /d "%PROJECT_ROOT%"

if exist "%PROJECT_ROOT%.runtime\node\node.exe" set "PATH=%PROJECT_ROOT%.runtime\node;%PATH%"
if exist "%PROJECT_ROOT%.runtime\git\cmd\git.exe" set "PATH=%PROJECT_ROOT%.runtime\git\cmd;%PATH%"

echo ===================================================
echo        AI Photo Editor - Update
echo ===================================================
echo.

set "FAILED_STEP=preparing the update"
set "SOURCE_UPDATED="
set "BACKUP_STASH="
set "BACKUP_BRANCH="
set "BACKUP_STAMP="
set "CURRENT_BRANCH="
set "OLD_HEAD="
set "REMOTE_HEAD="
set "AHEAD=0"
set "BEHIND=0"

where git >nul 2>nul
if errorlevel 1 (
    echo [INFO] Git is missing. Preparing the local runtime first...
    call "%PROJECT_ROOT%install.bat" /quiet
    if errorlevel 1 goto failed
    if exist "%PROJECT_ROOT%.runtime\node\node.exe" set "PATH=%PROJECT_ROOT%.runtime\node;%PATH%"
    if exist "%PROJECT_ROOT%.runtime\git\cmd\git.exe" set "PATH=%PROJECT_ROOT%.runtime\git\cmd;%PATH%"
)

where git >nul 2>nul
if errorlevel 1 goto failed

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
    echo [ERROR] This folder is not a Git clone.
    echo Run setup.bat once to prepare automatic updates, then run update.bat again.
    goto failed
)

for /f "delims=" %%i in ('git symbolic-ref --quiet --short HEAD 2^>nul') do set "CURRENT_BRANCH=%%i"
if not defined CURRENT_BRANCH echo [INFO] The local repository is detached; it will still be aligned to GitHub main.

set "FAILED_STEP=downloading the latest version from GitHub"
echo [1/5] Downloading the latest version from GitHub...
git fetch origin main
if errorlevel 1 goto failed

for /f "delims=" %%i in ('git rev-parse HEAD 2^>nul') do set "OLD_HEAD=%%i"
for /f "delims=" %%i in ('git rev-parse FETCH_HEAD 2^>nul') do set "REMOTE_HEAD=%%i"
if not defined REMOTE_HEAD (
    echo [ERROR] GitHub returned no usable main branch.
    goto failed
)
if not "!OLD_HEAD!"=="!REMOTE_HEAD!" set "SOURCE_UPDATED=1"

set "FAILED_STEP=stopping the local service"
echo [2/5] Stopping this project's service...
call "%PROJECT_ROOT%stop.bat" /quiet
if errorlevel 1 goto failed

for /f "delims=" %%i in ('powershell.exe -NoLogo -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss" 2^>nul') do set "BACKUP_STAMP=%%i"
if not defined BACKUP_STAMP set "BACKUP_STAMP=%RANDOM%"

for /f "tokens=1,2" %%a in ('git rev-list --left-right --count HEAD...FETCH_HEAD 2^>nul') do (
    set "AHEAD=%%a"
    set "BEHIND=%%b"
)

if not "!AHEAD!"=="0" (
    set "BACKUP_BRANCH=backup-before-update-!BACKUP_STAMP!"
    echo [INFO] Preserving !AHEAD! local Git commit^(s^) in branch !BACKUP_BRANCH!.
    git branch "!BACKUP_BRANCH!" HEAD
    if errorlevel 1 goto failed
)

set "DIRTY="
for /f "delims=" %%i in ('git status --porcelain --untracked-files^=normal') do set "DIRTY=1"
if defined DIRTY (
    set "BACKUP_STASH=AI Photo Editor auto-backup before update !BACKUP_STAMP!"
    echo [INFO] Saving local file changes before applying the GitHub version...
    git stash push --include-untracked -m "!BACKUP_STASH!"
    if errorlevel 1 goto failed
)

set "REMAINING="
for /f "delims=" %%i in ('git status --porcelain --untracked-files^=all') do set "REMAINING=1"
if defined REMAINING (
    echo [ERROR] Some local files could not be backed up safely.
    git -c core.quotePath=false status --short
    goto failed
)

echo.
set "FAILED_STEP=applying the GitHub version over the local source code"
echo [3/5] Applying the GitHub version over the local source code...
git reset --hard FETCH_HEAD
if errorlevel 1 goto failed

if defined BACKUP_STASH echo [INFO] Local file backup saved in Git stash: !BACKUP_STASH!
if defined BACKUP_BRANCH echo [INFO] Local commit backup saved in branch: !BACKUP_BRANCH!

echo.
set "FAILED_STEP=installing locked dependencies"
echo [4/5] Installing locked dependencies...
call "%PROJECT_ROOT%install.bat" /quiet
if errorlevel 1 goto failed

echo.
set "FAILED_STEP=starting the updated service"
echo [5/5] Starting the updated service...
call "%PROJECT_ROOT%start.bat" /quiet
if errorlevel 1 goto failed

echo.
echo ===================================================
echo [OK] AI Photo Editor has been updated successfully.
echo ===================================================
if defined QUIET_ARG exit /b 0
echo Press any key to close this window...
pause > nul
exit /b 0

:failed
echo.
echo [ERROR] Update was not completed while !FAILED_STEP!.
if defined BACKUP_STASH echo [INFO] Local file backup remains in Git stash: !BACKUP_STASH!
if defined BACKUP_BRANCH echo [INFO] Local commit backup remains in branch: !BACKUP_BRANCH!
if defined SOURCE_UPDATED (
    echo [INFO] The GitHub source was downloaded, but the remaining update step failed.
    echo Run install.bat, then start.bat after fixing the problem.
) else (
    echo [INFO] The existing source version was not replaced.
)
if defined QUIET_ARG exit /b 1
echo Press any key to close this window...
pause > nul
exit /b 1
