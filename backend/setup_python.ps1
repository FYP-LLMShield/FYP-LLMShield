# PowerShell script to set up Python 3.13/3.12 for LLMShield project

Write-Host "=== LLMShield Python Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if Python 3.13, 3.12, or 3.11 is available
Write-Host "Checking for Python 3.13, 3.12, or 3.11..." -ForegroundColor Yellow
$python313 = py -3.13 --version 2>$null
$python312 = py -3.12 --version 2>$null
$python311 = py -3.11 --version 2>$null

if ($python313) {
    Write-Host "✅ Python 3.13 found!" -ForegroundColor Green
    $pythonVersion = "3.13"
} elseif ($python312) {
    Write-Host "✅ Python 3.12 found!" -ForegroundColor Green
    $pythonVersion = "3.12"
} elseif ($python311) {
    Write-Host "✅ Python 3.11 found!" -ForegroundColor Green
    $pythonVersion = "3.11"
} else {
    Write-Host "❌ Python 3.13, 3.12, or 3.11 not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Python 3.13, 3.12, or 3.11:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://www.python.org/downloads/" -ForegroundColor Cyan
    Write-Host "2. During installation, check 'Add Python to PATH'" -ForegroundColor Cyan
    Write-Host "3. Run this script again after installation" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or use winget to install:" -ForegroundColor Yellow
    Write-Host "  winget install Python.Python.3.13" -ForegroundColor Cyan
    Write-Host "  OR" -ForegroundColor Cyan
    Write-Host "  winget install Python.Python.3.12" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "Using Python $pythonVersion" -ForegroundColor Green
Write-Host ""

# Navigate to backend directory
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendDir

Write-Host "Current directory: $backendDir" -ForegroundColor Cyan
Write-Host ""

# Remove old venv if exists (skip if files are locked)
if (Test-Path "venv") {
    Write-Host "Old venv detected. Creating new venv with different name..." -ForegroundColor Yellow
    $venvName = "venv_py311"
} else {
    $venvName = "venv"
}

# Create new venv
Write-Host "Creating new virtual environment with Python $pythonVersion..." -ForegroundColor Yellow
py -$pythonVersion -m venv $venvName

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create virtual environment!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Virtual environment created" -ForegroundColor Green
Write-Host ""

# Activate venv
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\$venvName\Scripts\Activate.ps1

# Verify Python version
$venvPython = python --version
Write-Host "Python version in venv: $venvPython" -ForegroundColor Cyan
Write-Host ""

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet
Write-Host "✅ pip upgraded" -ForegroundColor Green
Write-Host ""

# Install requirements
Write-Host "Installing requirements..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Cyan
Write-Host ""

$env:HTTP_PROXY = ''
$env:HTTPS_PROXY = ''
$env:http_proxy = ''
$env:https_proxy = ''

pip install -r requirements.txt

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Installation complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verifying installation..." -ForegroundColor Yellow
    python check_install.py
    
    Write-Host ""
    Write-Host "=== Setup Complete ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "To start the server, run:" -ForegroundColor Cyan
    Write-Host "  python run.py" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Installation failed. Please check the errors above." -ForegroundColor Red
    exit 1
}
