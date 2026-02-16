# LLMShield Project Testing Script
# Run this script to verify your project setup

Write-Host "🧪 LLMShield Project Testing Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check Python
Write-Host "1. Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "   ✅ $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Python not found!" -ForegroundColor Red
    exit 1
}

# Check Node.js
Write-Host "2. Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js not found!" -ForegroundColor Red
    exit 1
}

# Check Backend Dependencies
Write-Host "3. Checking Backend Dependencies..." -ForegroundColor Yellow
Set-Location "backend"
$deps = @("fastapi", "pymongo", "motor", "uvicorn")
$allInstalled = $true
foreach ($dep in $deps) {
    $result = python -c "import $dep; print('OK')" 2>&1
    if ($result -match "OK") {
        Write-Host "   ✅ $dep installed" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $dep NOT installed" -ForegroundColor Red
        $allInstalled = $false
    }
}

if (-not $allInstalled) {
    Write-Host ""
    Write-Host "⚠️  Some dependencies missing. Run: pip install -r requirements.txt" -ForegroundColor Yellow
}

# Check Frontend Dependencies
Write-Host "4. Checking Frontend Dependencies..." -ForegroundColor Yellow
Set-Location "..\frontend"
if (Test-Path "node_modules") {
    Write-Host "   ✅ node_modules exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ node_modules missing. Run: npm install" -ForegroundColor Red
}

# Check MongoDB (optional)
Write-Host "5. Checking MongoDB Connection..." -ForegroundColor Yellow
Set-Location "..\backend"
try {
    $mongoCheck = python -c "from pymongo import MongoClient; client = MongoClient('mongodb://localhost:27017', serverSelectionTimeoutMS=2000); client.server_info(); print('OK')" 2>&1
    if ($mongoCheck -match "OK") {
        Write-Host "   ✅ MongoDB connection successful" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  MongoDB not accessible (may need to start MongoDB service)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  MongoDB not accessible (may need to start MongoDB service)" -ForegroundColor Yellow
}

# Check Environment Files
Write-Host "6. Checking Environment Configuration..." -ForegroundColor Yellow
Set-Location ".."
if (Test-Path ".env") {
    Write-Host "   ✅ .env file exists" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  .env file not found (will use defaults)" -ForegroundColor Yellow
}

# Check Model Files (for Data Poisoning)
Write-Host "7. Checking Model Files..." -ForegroundColor Yellow
if (Test-Path "CompleteModels") {
    Write-Host "   ✅ CompleteModels folder exists" -ForegroundColor Green
    
    $models = @(
        "Llama3\Llama3.2_safe_model\Llama_safe_full.Q8_0.gguf",
        "Llama3\Llama3.2_poison_model\Llama_poison_full.Q8_0.gguf",
        "TinyLlama_Models\TinyLlama_safe_model\TinyLlama_safe_full.Q8_0.gguf",
        "TinyLlama_Models\TinyLlama_poison_model\TinyLlama_poison_full.Q8_0.gguf",
        "Qwen_Models\Qwen_safe_model\Qwen_safe_full.Q8_0.gguf",
        "Qwen_Models\Qwen_poison_model\Qwen_poison_full.Q8_0.gguf"
    )
    
    $foundModels = 0
    foreach ($model in $models) {
        if (Test-Path "CompleteModels\$model") {
            $foundModels++
        }
    }
    
    if ($foundModels -eq $models.Count) {
        Write-Host "   ✅ All model files found ($foundModels/$($models.Count))" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Some model files missing ($foundModels/$($models.Count))" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  CompleteModels folder not found (Data Poisoning feature may not work)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "✅ Pre-flight checks complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Start MongoDB (if not running)" -ForegroundColor White
Write-Host "2. Start Backend: cd backend; python run.py" -ForegroundColor White
Write-Host "3. Start Frontend: cd frontend; npm start" -ForegroundColor White
Write-Host "4. Open browser: http://localhost:3000" -ForegroundColor White
Write-Host ""
Set-Location ".."

