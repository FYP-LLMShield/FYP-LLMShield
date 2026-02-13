@echo off
REM SAST-MCP Installation Script for Windows
REM Installs Semgrep and TruffleHog for professional C/C++ code analysis

setlocal enabledelayedexpansion

echo.
echo 🛡️  LLMShield SAST Installation Script (Windows)
echo ======================================================
echo.

REM Check Python installation
echo [1/5] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found. Please install Python 3.8 or higher.
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo ✅ Python %PYTHON_VERSION% found
echo.

REM Check pip installation
echo [2/5] Checking pip installation...
pip --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pip not found. Please install pip.
    pause
    exit /b 1
)
echo ✅ pip found
echo.

REM Install Semgrep
echo [3/5] Installing Semgrep...
pip install semgrep
if errorlevel 1 (
    echo ❌ Failed to install Semgrep
    pause
    exit /b 1
)
echo ✅ Semgrep installed successfully
semgrep --version
echo.

REM Install TruffleHog
echo [4/5] Installing TruffleHog...
pip install truffleHog
if errorlevel 1 (
    echo ❌ Failed to install TruffleHog
    pause
    exit /b 1
)
echo ✅ TruffleHog installed successfully
trufflehog --version
echo.

REM Update backend requirements
echo [5/5] Updating backend requirements...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo ⚠️  Some packages may not have installed. Please check manually.
) else (
    echo ✅ Backend requirements updated
)
cd ..
echo.

echo ======================================================
echo ✅ SAST Installation Complete!
echo ======================================================
echo.
echo Next steps:
echo 1. Start backend: cd backend ^& python run.py
echo 2. Start frontend: cd frontend ^& npm start
echo 3. Open http://localhost:3000
echo 4. Test the SAST scanner with sample code
echo.
echo For more information, see SAST_SETUP.md
echo.
pause
