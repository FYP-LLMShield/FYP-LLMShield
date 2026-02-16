# Quick Fix Guide - Secret Detection

## What Was Fixed

✓ **LLM Prompt** - Now asks for secrets (was ignoring them)
✓ **Regex Patterns** - More lenient to catch variants
✓ **Logging** - Full visibility into what's happening
✓ **Deduplication** - Shows what's kept vs removed

---

## How to Test NOW

### 1️⃣ Set Groq API Key

```bash
# Create .env file
cat > backend/.env << 'EOF'
GROQ_API_KEY=gsk_YOUR_API_KEY_HERE
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=llmshield
EOF
```

Get key from: https://console.groq.com/keys

### 2️⃣ Restart Backend

```bash
# Docker
docker restart llmshield-backend

# Or directly
cd backend
python -m uvicorn app.main:app --reload
```

### 3️⃣ Test Secrets Detection

```bash
# Test regex scanner (should find secrets)
curl -X POST http://localhost:8000/api/v1/scan/text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "const char *AWS_KEY = \"AKIAIOSFODNN7EXAMPLE\"; const char *pass = \"admin123\";",
    "filename": "test.c",
    "scan_types": ["secrets", "cpp_vulns"]
  }'
```

Expected: 2 Critical findings (AWS key + password)

### 4️⃣ Test LLM Scanner

```bash
# Test hybrid scanner with Groq
curl -X POST http://localhost:8000/api/v1/hybrid-scan/text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "const char *AWS_KEY = \"AKIAIOSFODNN7EXAMPLE\"; if (x = 1) { }",
    "filename": "test.c"
  }'
```

Expected: 3 findings
- AWS Key (regex)
- Hardcoded password (regex)
- Assignment in condition (LLM)

### 5️⃣ Watch Logs

```bash
# In another terminal, watch what's happening
docker logs llmshield-backend -f | grep "\[LLM\]\|\[HYBRID\]\|\[DEDUP\]"
```

Expected output:
```
[HYBRID] SCAN STARTED for test.c
[HYBRID] Running regex scanner...
[HYBRID] Regex scanner returned 2 findings
[HYBRID] Checking LLM availability...
[HYBRID] LLM available: true
[HYBRID] LLM scan STARTING...
[LLM] SCAN STARTED
[LLM] Calling Groq API...
[LLM] Got response (1234 chars)
[LLM] Extracted 1 findings from JSON
[LLM]   Finding 1: Assignment in Condition at line 1
[LLM] SCAN COMPLETED - Returning 1 findings
[DEDUP] Starting deduplication
[DEDUP] KEPT LLM finding: Assignment in Condition at line 1
[DEDUP] After dedup: 2 regex, 1 LLM
```

---

## What to Check

✓ **Regex findings > 0** → Secrets scanner working
✓ **LLM findings > 0** → LLM is being called and working
✓ **[HYBRID] logs show** → Integration is active
✓ **[DEDUP] KEPT entries** → LLM findings not discarded
✓ **No [LLM] ERROR** → API is working

---

## If LLM Findings = 0

### Step 1: Check API Key

```bash
cat backend/.env | grep GROQ
# Should show: GROQ_API_KEY=gsk_...
```

### Step 2: Test API Directly

```bash
cd backend
GROQ_API_KEY=gsk_... python test_groq_direct.py
```

This bypasses FastAPI and tests raw LLM capability.

### Step 3: Check Groq Console

Visit https://console.groq.com/account/usage
- Check if quota is exceeded
- Check for rate limiting
- Verify API key is active

### Step 4: Read Full Logs

```bash
docker logs llmshield-backend -f 2>&1 | head -200 | grep -A5 "\[LLM\] ERROR"
```

---

## File Changes

| File | Changes | Impact |
|------|---------|--------|
| `llm_scanner_service.py` | Fixed prompt, added logging | LLM now finds secrets |
| `hybrid_scanner.py` | Added logging | Full visibility |
| `scanner.py` | Relaxed patterns | More detections |
| `test_groq_direct.py` | NEW | Direct API testing |

---

## Expected Results

### Before Fix:
```
Regex findings: 8
LLM findings: 0
Total: 8
LLM value: ZERO ❌
```

### After Fix (with Groq API key):
```
Regex findings: 8 (secrets + C++ vulns)
LLM findings: 3 (secrets + logic bugs)
Total: 11
LLM value: HIGH ✓
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| No GROQ_API_KEY in logs | Set environment variable or create .env |
| LLM returns 0 findings | Check logs for errors, test direct API |
| Groq API 401/403 error | API key invalid or expired |
| Groq API timeout | Code too large (>10KB) or LLM slow |
| Hybrid scan hangs | LLM timeout (60 sec), check large files |

---

## Next: Commit Changes

```bash
git add -A
git commit -m "fix: enable LLM secret detection and improve patterns

- Fixed LLM prompt to explicitly ask for hardcoded secrets
- Relaxed GitHub PAT pattern to catch shorter tokens (25+ chars)
- Relaxed Google API pattern (30+ chars instead of 35+)
- Expanded password patterns to catch variations
- Added comprehensive logging for LLM and dedup flow
- Can now detect secrets user mentioned:
  - AWS Access Key
  - AWS Secret Key
  - GitHub Tokens
  - Hardcoded passwords
- LLM findings no longer discarded by dedup
- Logs show exactly what LLM found and what's kept"
```

---

## Success Criteria

After these fixes, you should see:

1. ✓ Secrets detected by regex scanner
2. ✓ LLM called with Groq API
3. ✓ LLM findings = at least 1-5 additional issues
4. ✓ Logs show [LLM] and [DEDUP] entries
5. ✓ Total findings > regex findings

If all above ✓, the fix is working!
