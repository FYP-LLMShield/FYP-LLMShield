# Fix pip configuration and install packages

Write-Host "=== Fixing Pip Configuration and Installing Packages ===" -ForegroundColor Cyan
Write-Host ""

# Unset the problematic environment variables
$env:PIP_NO_INDEX = ''
$env:NO_INDEX = ''
$env:HTTP_PROXY = ''
$env:HTTPS_PROXY = ''
$env:http_proxy = ''
$env:https_proxy = ''

Write-Host "Environment variables cleared" -ForegroundColor Green
Write-Host ""

# Navigate to backend
cd C:\Alisha\Projects\university\fyp\FYP-LLMShield\backend

# Activate venv
Write-Host "Activating Python 3.11 virtual environment..." -ForegroundColor Yellow
& .\venv_py311\Scripts\Activate.ps1

# Verify Python version
$pythonVersion = python --version
Write-Host "Python version: $pythonVersion" -ForegroundColor Cyan
Write-Host ""

# Install packages
Write-Host "Installing motor and pymongo..." -ForegroundColor Yellow
python -m pip install motor pymongo --index-url https://pypi.org/simple --trusted-host pypi.org

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Installing remaining requirements..." -ForegroundColor Yellow
    python -m pip install -r requirements.txt --index-url https://pypi.org/simple --trusted-host pypi.org
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=== Installation Complete! ===" -ForegroundColor Green
        Write-Host ""
        python check_install.py
        Write-Host ""
        Write-Host "To start the server:" -ForegroundColor Cyan
        Write-Host "  .\venv_py311\Scripts\Activate.ps1" -ForegroundColor White
        Write-Host "  python run.py" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "Some packages failed to install. Check errors above." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Failed to install motor/pymongo. Check errors above." -ForegroundColor Red
}
