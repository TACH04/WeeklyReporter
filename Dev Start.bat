@echo off
setlocal
cd /d "%~dp0"

echo =========================================
echo    Weekly Reporter - Developer Mode
echo =========================================
echo.

:: Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [!] ERROR: Python not found in PATH.
    pause
    exit /b 1
)

:: Check for Node.js (required for npm run dev)
npm --version >nul 2>&1
if errorlevel 1 (
    echo [!] ERROR: Node.js/npm not found in PATH. 
    echo Please install Node.js to use development mode.
    pause
    exit /b 1
)

echo [*] Starting Backend (Python)...
:: Use the virtual environment if it exists
if exist "source\.venv\Scripts\python.exe" (
    start "WR Backend" /d "source" cmd /k "source\.venv\Scripts\python.exe app.py"
) else (
    start "WR Backend" /d "source" cmd /k "python app.py"
)

echo [*] Starting Frontend (Vite)...
start "WR Frontend" /d "source\frontend" cmd /k "npm run dev"

echo.
echo ---------------------------------------------------------
echo Both servers are starting in separate windows.
echo - Backend window: "WR Backend"
echo - Frontend window: "WR Frontend"
echo.
echo You can close this management window now.
echo ---------------------------------------------------------
timeout /t 5
