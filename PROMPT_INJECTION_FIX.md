# Prompt Injection Test - "Stream Ended" Error Fix

## Error Meaning
"Stream ended without completion data" = Backend crashed, timed out, or model didn't respond

---

## Diagnostic Checklist

### Step 1: Check Backend Logs
Look at your backend console for error messages:

```bash
# In backend terminal, look for:
ERROR: [error message]
Traceback: [stack trace]
```

**Common errors:**
- `Connection refused` → Model not running
- `Timeout` → Model too slow
- `Invalid API key` → Credentials wrong
- `400 Bad Request` → Model config wrong

---

### Step 2: Verify Your Model is Running

**For Ollama:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags
# Should return a list of models
```

**For OpenAI:**
```bash
# Check if API key is set
echo $OPENAI_API_KEY
# Should show: sk-...
```

**For Local LLM:**
```bash
# Check if local server is running
curl http://localhost:8080/health
# Should return 200 OK
```

---

### Step 3: Test Model Connection Directly

```bash
# Test Ollama
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "prompt": "Hello",
    "stream": false
  }'
```

If this fails, **your model isn't running or accessible.**

---

### Step 4: Check Backend Configuration

Make sure `.env` file has:

```bash
# For Ollama
OLLAMA_BASE_URL=http://localhost:11434

# For OpenAI
OPENAI_API_KEY=sk-...

# For Local LLM
LOCAL_LLM_URL=http://localhost:8080
```

---

## Most Common Fix: Start Your Model

### Ollama
```bash
# Download and run Ollama
ollama pull llama2
ollama serve
```

Then in another terminal:
```bash
# Verify it's running
curl http://localhost:11434/api/tags
```

### OpenAI
```bash
# Set API key
export OPENAI_API_KEY=sk-your-key-here

# Verify in Python
python -c "import os; print(os.getenv('OPENAI_API_KEY'))"
```

### Local LLM
```bash
# Make sure your local server is running
# Example: text-generation-webui, vLLM, etc.
# Server should be at http://localhost:8080
```

---

## Step 5: Restart Backend

After fixing the model:

```bash
# Kill backend
pkill -f "uvicorn"

# Restart
cd E:\extra\FYP-LLMShield\backend
python -m uvicorn app.main:app --reload
```

---

## Step 6: Test Again

1. Go to Prompt Injection module
2. **Double-check model config:**
   - Provider: (Ollama/OpenAI/Local)
   - Model: (llama2/gpt-4/custom)
   - Base URL: (http://localhost:11434 for Ollama)
   - API Key: (if needed)
3. Click "Launch Test"
4. Check backend logs for any errors

---

## What "Stream ended" Really Means

| Cause | Symptom | Fix |
|-------|---------|-----|
| Model not running | Instant error | Start model server |
| Model timeout | Hangs 25+ seconds | Check model performance |
| Bad API key | Connection refused | Verify credentials |
| Wrong base URL | Connection refused | Check .env config |
| Model overloaded | Timeout | Reduce max_tokens |

---

## Detailed Error Debugging

Check backend console for these patterns:

### "Connection refused"
```
ERROR: Cannot connect to http://localhost:11434
Fix: Start Ollama or your model server
```

### "Timeout"
```
ERROR: Request timeout after 25 seconds
Fix: Model is too slow or not responding
     Reduce max_tokens in test config
```

### "Invalid API key"
```
ERROR: Invalid OpenAI API key
Fix: Check OPENAI_API_KEY environment variable
```

### "Model not found"
```
ERROR: Model 'llama2' not found
Fix: Pull the model with 'ollama pull llama2'
```

---

## Complete Setup Example (Ollama)

```bash
# Terminal 1: Start Ollama
ollama serve
# Output: Listening on 127.0.0.1:11434

# Terminal 2: In another terminal
curl http://localhost:11434/api/tags
# Verify models are available

# Terminal 3: Start backend
cd E:\extra\FYP-LLMShield\backend
python -m uvicorn app.main:app --reload

# Terminal 4: Open frontend, go to Prompt Injection
# Enter test config:
# - Provider: ollama
# - Model: llama2
# - Base URL: http://localhost:11434
# Click "Launch Test"
```

---

## If Still Getting "Stream ended"

1. **Check backend terminal** - what's the actual error?
2. **Run diagnostics** - Can you curl the model endpoint?
3. **Restart everything** - Backend, model, browser
4. **Check firewall** - Is localhost:11434 accessible?
5. **Use simpler config** - Test with OpenAI (if you have key)

---

## Success Indicators

✅ Backend shows: `Testing probe 1/X...`
✅ No error messages in logs
✅ Progress moves from 0% to 100%
✅ Results show violations found
✅ Execution time is reasonable (30-50 seconds)

---

**Do these checks and let me know:**
1. What model are you testing?
2. Is it actually running?
3. What error appears in the backend logs?
