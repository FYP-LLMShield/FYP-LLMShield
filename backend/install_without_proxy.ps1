# Install packages bypassing proxy issues

Write-Host "=== Installing Packages (Bypassing Proxy) ===" -ForegroundColor Cyan
Write-Host ""

# Disable all proxy settings
$env:HTTP_PROXY = ''
$env:HTTPS_PROXY = ''
$env:http_proxy = ''
$env:https_proxy = ''
$env:NO_PROXY = '*'
$env:no_proxy = '*'
$env:PIP_NO_INDEX = ''
$env:NO_INDEX = ''

# Disable system proxy for this session
[System.Net.WebRequest]::DefaultWebProxy = [System.Net.WebRequest]::GetSystemWebProxy()
[System.Net.WebRequest]::DefaultWebProxy.Credentials = [System.Net.CredentialCache]::DefaultCredentials

Write-Host "Proxy settings disabled" -ForegroundColor Green
Write-Host ""

cd C:\Alisha\Projects\university\fyp\FYP-LLMShield\backend

# Activate venv
Write-Host "Activating Python 3.11 virtual environment..." -ForegroundColor Yellow
& .\venv_py311\Scripts\Activate.ps1

Write-Host "Python version: $(python --version)" -ForegroundColor Cyan
Write-Host ""

# Install with explicit no-proxy
Write-Host "Installing motor and pymongo..." -ForegroundColor Yellow
python -m pip install motor pymongo --index-url https://pypi.org/simple --trusted-host pypi.org --proxy ""

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ motor and pymongo installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installing remaining requirements..." -ForegroundColor Yellow
    python -m pip install -r requirements.txt --index-url https://pypi.org/simple --trusted-host pypi.org --proxy ""
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=== ✅ INSTALLATION COMPLETE! ===" -ForegroundColor Green
        Write-Host ""
        python check_install.py
        Write-Host ""
        Write-Host "To start the server:" -ForegroundColor Cyan
        Write-Host "  .\venv_py311\Scripts\Activate.ps1" -ForegroundColor White
        Write-Host "  python run.py" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "❌ Installation failed. Please check your network/proxy settings." -ForegroundColor Red
    Write-Host ""
    Write-Host "You may need to:" -ForegroundColor Yellow
    Write-Host "1. Disable proxy in Windows Settings" -ForegroundColor Cyan
    Write-Host "2. Or configure pip to use your proxy correctly" -ForegroundColor Cyan
}
