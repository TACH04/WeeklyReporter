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

:: ── Verify frontend assets are present ───────────────────────────────────────
call :LOG "Checking for frontend assets (static\index.html)..."
if not exist "static\index.html" (
    call :LOG "ERROR: static\index.html not found. App may be incomplete."
    echo Error: Frontend files are missing. Please re-download the application.
    goto :FATAL
)
call :LOG "Frontend assets OK."

:: ── Start the Flask app ───────────────────────────────────────────────────────
call :LOG "Launching Flask server..."
echo Starting Weekly Reporter Server...
echo Keep this window open while using the app.
echo.

start "Weekly Reporter Server" /D "%~dp0source" /MIN "%~dp0source\.venv\Scripts\python.exe" "app.py"
call :LOG "Flask start command issued. Waiting for server..."

:: ── Wait for server to boot (up to 30 seconds) ───────────────────────────────
echo Waiting for server to be ready...
set "ATTEMPT=0"
:waitloop
set /a ATTEMPT+=1

:: Try curl first, fall back to PowerShell if not available
curl -s -o nul -w "%%{http_code}" http://localhost:5001 2>nul | findstr /c:"200" >nul 2>&1
if !errorlevel! equ 0 goto startbrowser

:: PowerShell fallback health check
powershell -nologo -noprofile -command "try { $r=(Invoke-WebRequest -Uri 'http://localhost:5001' -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop).StatusCode; if ($r -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if !errorlevel! equ 0 goto startbrowser

if !ATTEMPT! geq 30 (
    call :LOG "ERROR: Server did not respond after 30s."
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
