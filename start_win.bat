@echo off
setlocal EnableDelayedExpansion

:: ── Log file setup ────────────────────────────────────────────────────────────
set "LOG=%~dp0startup_log.txt"
echo [%date% %time%] Starting Weekly Reporter... > "%LOG%"
echo Log file: %LOG%
echo If something goes wrong, send this file for support.
echo.

:: Redirect a copy of output to log (tee-style via PowerShell not needed — 
:: each echo below also writes to log manually for simplicity)
call :LOG "Script started from: %~dp0"
call :LOG "Working dir: %CD%"

:: Change directory to the source folder
cd /d "%~dp0source"
call :LOG "Changed to source dir: %CD%"

echo =========================================
echo    Welcome to Weekly Reporter!           
echo =========================================
echo.

:: Pre-flight cleanup
echo Cleaning up any old processes...
call :LOG "Killing orphaned python processes..."
taskkill /f /im python.exe /fi "windowtitle eq Weekly Reporter Server" >nul 2>&1

:: ── Check for Python ──────────────────────────────────────────────────────────
call :LOG "Checking for Python..."
python --version >nul 2>&1
if errorlevel 1 (
    call :LOG "Python NOT found. Attempting winget install..."
    echo Python is missing. Attempting to install automatically via winget...
    call winget install -e --id Python.Python.3 --silent --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        call :LOG "ERROR: winget Python install failed."
        echo.
        echo Error: Automatic install failed. Please install Python 3 manually from https://www.python.org/downloads/
        echo Make sure to check "Add Python to PATH" during installation.
        goto :FATAL
    )
    call :LOG "Python installed. Requesting restart."
    echo.
    echo Python installed successfully. Please RESTART this script to continue.
    pause
    exit /b 0
)
call :LOG "Python found OK."

:: ── Set up virtual environment ────────────────────────────────────────────────
if not exist ".venv\" (
    call :LOG "No .venv found. Creating virtual environment..."
    echo First time setup detected. Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        call :LOG "ERROR: python -m venv failed."
        echo Error: Failed to create virtual environment.
        goto :FATAL
    )
    call :LOG ".venv created OK."
)

:: ── Activate Environment ──────────────────────────────────────────────────────
call :LOG "Activating .venv..."
call .venv\Scripts\activate.bat
call :LOG "Activated."

:: ── Install requirements ──────────────────────────────────────────────────────
echo Ensuring all required tools are installed...
call :LOG "Running pip install -r requirements.txt..."
call .venv\Scripts\python.exe -m pip install -qr requirements.txt
if errorlevel 1 (
    call :LOG "ERROR: pip install failed."
    echo Error: pip install failed. Check your internet connection.
    goto :FATAL
)
call :LOG "pip install OK."

:: ── Check for Node.js ─────────────────────────────────────────────────────────
call :LOG "Checking for Node.js..."
node -v >nul 2>&1
if errorlevel 1 (
    call :LOG "Node.js NOT found. Attempting winget install..."
    echo Node.js is missing. Attempting to install automatically via winget...
    call winget install -e --id OpenJS.NodeJS --silent --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        call :LOG "ERROR: winget Node.js install failed."
        echo.
        echo Error: Automatic install failed. Please install Node.js manually from https://nodejs.org/
        goto :FATAL
    )
    call :LOG "Node.js installed. Requesting restart."
    echo.
    echo Node.js installed successfully. Please RESTART this script to continue.
    pause
    exit /b 0
)
call :LOG "Node.js found OK."

:: ── Ensure frontend is built ──────────────────────────────────────────────────
if not exist "static\index.html" (
    call :LOG "Frontend not built. Running npm install + build..."
    echo Frontend build missing. Attempting to build...
    pushd frontend
    echo Installing frontend dependencies (this may take a minute)...
    call npm install
    if errorlevel 1 (
        call :LOG "ERROR: npm install failed."
        echo Error: npm install failed.
        popd
        goto :FATAL
    )
    echo Building frontend...
    call npm run build
    if errorlevel 1 (
        call :LOG "ERROR: npm run build failed."
        echo Error: npm run build failed.
        popd
        goto :FATAL
    )
    popd
    call :LOG "Frontend built OK."
)

:: ── Start the Flask app ───────────────────────────────────────────────────────
call :LOG "Launching Flask server..."
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
    call :LOG "ERROR: Server did not respond after 30s. Check startup_log.txt"
    echo Error: Server failed to start within 30 seconds.
    echo Check startup_log.txt for details.
    goto :FATAL
)
timeout /t 1 /nobreak >nul
goto waitloop

:startbrowser
call :LOG "Server ready. Opening browser."
echo Opening app in your default browser...
start http://localhost:5001

echo.
echo Press any key in this window to STOP the server and exit.
pause >nul

:: ── Cleanup ───────────────────────────────────────────────────────────────────
call :LOG "User exited. Cleaning up."
taskkill /fi "windowtitle eq Weekly Reporter Server" /f >nul 2>&1
taskkill /f /im python.exe /fi "windowtitle eq Weekly Reporter Server" >nul 2>&1
call :LOG "Done."
exit /b 0

:: ── Fatal error handler ───────────────────────────────────────────────────────
:FATAL
call :LOG "FATAL ERROR — script stopped."
echo.
echo =========================================
echo  Something went wrong. Do NOT close this
echo  window. Screenshot this screen or send:
echo  %LOG%
echo =========================================
echo.
cmd /k
exit /b 1

:: ── Logging subroutine ────────────────────────────────────────────────────────
:LOG
echo [%time%] %~1 >> "%LOG%"
exit /b 0
