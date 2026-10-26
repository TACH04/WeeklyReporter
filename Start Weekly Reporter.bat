@echo off
setlocal
cd /d "%~dp0"

echo =========================================
echo    Starting Weekly Reporter Launcher           
echo =========================================
echo.

:: Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo -------------------------------------------------------------------
    echo ERROR: Python is not installed or not in your system PATH.
    echo.
    echo Please install Python 3 from: https://www.python.org/downloads/
    echo IMPORTANT: Make sure to check "Add Python to PATH" during installation.
    echo -------------------------------------------------------------------
    echo.
    pause
    exit /b 1
)

:: Run the Python launcher
python source\launcher.py

if errorlevel 1 (
    echo.
    echo -------------------------------------------------------------------
    echo ERROR: The launcher encountered an issue. See the output above.
    echo -------------------------------------------------------------------
    pause
    exit /b 1
)

exit /b 0
