@echo off
setlocal EnableDelayedExpansion

:: Change directory to the source folder
cd /d "%~dp0source"

echo =========================================
echo    Welcome to Weekly Reporter!           
echo =========================================
echo.

:: Pre-flight cleanup: kill any orphaned processes from previous runs
echo Cleaning up any old processes...
taskkill /f /im python.exe /fi "windowtitle eq Weekly Reporter Server" >nul 2>&1

:: ── Check for Python ──────────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is missing. Attempting to install automatically via winget...
    call winget install -e --id Python.Python.3 --silent --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo.
        echo Error: Automatic install failed. Please install Python 3 manually from https://www.python.org/downloads/
        echo Make sure to check "Add Python to PATH" during installation.
        pause
        exit /b 1
    )
    echo.
    echo Python installed successfully. Please RESTART this script to continue.
    pause
    exit /b 0
)

:: ── Set up virtual environment on first run ───────────────────────────────────
if not exist ".venv\" (
    echo First time setup detected. Creating secure virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo Error: Failed to create virtual environment.
        pause
        exit /b 1
    )
)

:: ── Activate Environment ──────────────────────────────────────────────────────
call .venv\Scripts\activate.bat

:: ── Install requirements ──────────────────────────────────────────────────────
echo Ensuring all required tools are installed...
call .venv\Scripts\python.exe -m pip install -qr requirements.txt
if errorlevel 1 (
    echo Error: pip install failed. Check requirements.txt and your internet connection.
    pause
    exit /b 1
)

:: ── Check for Node.js (must be outside nested if blocks) ─────────────────────
node -v >nul 2>&1
if errorlevel 1 (
    echo Node.js is missing. Attempting to install automatically via winget...
    call winget install -e --id OpenJS.NodeJS --silent --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo.
        echo Error: Automatic install failed. Please install Node.js manually from https://nodejs.org/
        pause
        exit /b 1
    )
    echo.
    echo Node.js installed successfully. Please RESTART this script to continue.
    pause
    exit /b 0
)

:: ── Ensure frontend is built ──────────────────────────────────────────────────
if not exist "static\index.html" (
    echo Frontend build missing. Attempting to build...
    pushd frontend
    echo Installing frontend dependencies (this may take a minute)...
    call npm install
    if errorlevel 1 (
        echo Error: npm install failed.
        popd
        pause
        exit /b 1
    )
    echo Building frontend...
    call npm run build
    if errorlevel 1 (
        echo Error: npm run build failed.
        popd
        pause
        exit /b 1
    )
    popd
)

:: ── Start the Flask app in background ────────────────────────────────────────
echo Starting Weekly Reporter Server...
echo Keep this window open while using the app.
echo.

start "Weekly Reporter Server" /MIN "%~dp0source\.venv\Scripts\python.exe" "%~dp0source\app.py"

:: ── Wait for server to boot (up to 30 seconds) ───────────────────────────────
echo Waiting for server to be ready...
set "ATTEMPT=0"
:waitloop
set /a ATTEMPT+=1
curl -s -o nul -w "%%{http_code}" http://localhost:5001 2>nul | findstr /c:"200" >nul 2>&1
if !errorlevel! equ 0 goto startbrowser
if !ATTEMPT! geq 30 (
    echo Error: Server failed to start within 30 seconds.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
goto waitloop

:startbrowser
:: ── Open in Default Browser ───────────────────────────────────────────────────
echo Opening app in your default browser...
start http://localhost:5001

echo.
echo Press any key in this window to STOP the server and exit.
pause >nul

:: ── Cleanup ───────────────────────────────────────────────────────────────────
taskkill /fi "windowtitle eq Weekly Reporter Server" /f >nul 2>&1
taskkill /f /im python.exe /fi "windowtitle eq Weekly Reporter Server" >nul 2>&1
