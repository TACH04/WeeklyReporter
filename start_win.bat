@echo off
setlocal

:: Change directory to the source folder
cd /d "%~dp0source"

echo =========================================
echo    Welcome to Weekly Reporter!           
echo =========================================
echo.

:: Pre-flight cleanup: kill any orphaned processes from previous runs
echo Cleaning up any old processes...
taskkill /f /im python.exe /fi "windowtitle eq Weekly Reporter Server" >nul 2>&1

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH.
    echo Please download and install it from https://www.python.org/downloads/
    echo Make sure to check the box "Add Python to PATH" during installation.
    pause
    exit /b 1
)

:: Set up virtual environment on first run
if not exist ".venv\" (
    echo First time setup detected. Creating secure virtual environment...
    python -m venv .venv
)

:: Activate Environment
call .venv\Scripts\activate

:: Install requirements
echo Ensuring all required tools are installed...
pip install -qr requirements.txt

:: Start the Flask app in background
echo Starting Weekly Reporter Server...
echo Keep this window open while using the app.
echo.

:: Start python server
start "Weekly Reporter Server" /MIN python app.py

:: Wait for server to boot (up to 30 seconds)
echo Waiting for server to be ready...
set "ATTEMPT=0"
:waitloop
set /a ATTEMPT+=1
powershell -command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5001' -UseBasicParsing -ErrorAction Ignore; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto startbrowser
if %ATTEMPT% geq 30 (
    echo Error: Server failed to start within 30 seconds.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
goto waitloop

:startbrowser
:: Open in Default Browser
echo Opening app in your default browser...
start http://localhost:5001

echo.
echo Press any key in this window to STOP the server and exit.
pause >nul

:: Kill the flask process using window title
taskkill /fi "windowtitle eq Weekly Reporter Server" /f >nul 2>&1
taskkill /f /im python.exe /fi "windowtitle eq Weekly Reporter Server" >nul 2>&1
