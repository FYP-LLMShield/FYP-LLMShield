# Run backend locally after installing dependencies.
# Usage: from repo root or backend folder: .\backend\run_local.ps1
# Or: cd backend; .\run_local.ps1

$ErrorActionPreference = "Stop"
$backendDir = $PSScriptRoot
if (-not $backendDir) { $backendDir = ".\backend" }
Push-Location $backendDir

try {
    $python = $null
    if (Test-Path ".venv\Scripts\python.exe") { $python = ".\.venv\Scripts\python.exe" }
    elseif (Test-Path "venv\Scripts\python.exe") { $python = ".\venv\Scripts\python.exe" }
    else { $python = "python" }

    Write-Host "Using: $python"
    Write-Host "Installing dependencies (pip install -r requirements.txt)..."
    & $python -m pip install -r requirements.txt -q
    if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
    Write-Host "Starting server (python run.py)..."
    & $python run.py
} finally {
    Pop-Location
}
