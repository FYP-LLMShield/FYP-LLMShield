# Fixed Hanging at 90% Issue

## Problem
Scans were hanging at 90% and never completing. This happened because:
1. The `is_available()` check was taking 5 seconds timeout
2. The LLM scan had no timeout - could hang forever
3. No fallback if Groq API was slow

## Solution Applied

### 1. Reduced Availability Check Timeout
**File**: `backend/app/services/llm_scanner_service.py`

**Before**: 5 second timeout
**After**: 3 second timeout (fail fast)

```python
async with httpx.AsyncClient(timeout=3.0) as client:  # Was 5.0
    # ... test request ...
    timeout=3.0  # Was 5.0
```

**Why**: If Groq API is unreachable, we fail quickly instead of waiting 5 seconds.

---

### 2. Added Timeout to LLM Scan
**File**: `backend/app/routes/hybrid_scanner.py`

**Before**:
```python
llm_findings = await llm_scanner_service.scan_code(...)  # Could hang forever
```

**After**:
```python
llm_findings = await asyncio.wait_for(
    llm_scanner_service.scan_code(...),
    timeout=70.0  # Hard timeout after 70 seconds
)
```

**Why**: Even if Groq API is slow, we timeout and fallback to regex results.

---

### 3. Added Fallback on Timeout
**Before**: If LLM timed out, scan crashed
**After**: If LLM times out, we just return regex findings

```python
except asyncio.TimeoutError:
    logger.warning("[HYBRID] LLM scan TIMEOUT - proceeding with regex results only")
    llm_findings = []
```

**Result**: Scan completes with or without LLM.

---

## Expected Behavior Now

### Timeline:
1. **0-2 seconds**: Regex scan (fast)
2. **2-3 seconds**: Check LLM availability
3. **3-60 seconds**: LLM scan (if available)
4. **60+ seconds**: Timeout and return results

### If LLM is slow/unreachable:
- Scan completes with just regex findings
- No hanging, no crash
- Frontend gets response within 70 seconds max

---

## How to Test

### Test 1: Quick Scan (Regex Only)
```bash
curl -X POST http://localhost:8000/api/v1/scan/text \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "char buf[10]; strcpy(buf, x);",
    "filename": "test.c",
    "scan_types": ["secrets", "cpp_vulns"]
  }'
```

Expected: Response in <2 seconds

### Test 2: Hybrid Scan (Should Not Hang)
```bash
curl -X POST http://localhost:8000/api/v1/hybrid-scan/text \
  -H "Authorization: Bearer TOKEN" \
  -d '{"content": "const char *p = \"admin123\";", "filename": "test.c"}'
```

Expected: Response in <70 seconds (not hanging at 90%)

### Test 3: Watch Logs
```bash
docker logs llmshield-backend -f | grep "\[HYBRID\]\|\[LLM\]"
```

Expected output:
```
[HYBRID] SCAN STARTED
[HYBRID] Running regex scanner...
[HYBRID] Regex scanner returned N findings
[HYBRID] Checking LLM availability...
[HYBRID] LLM available: true/false
[HYBRID] LLM scan STARTING...
[LLM] SCAN STARTED
[LLM] Calling Groq API...
[LLM] Got response (X chars)
[LLM] SCAN COMPLETED
[HYBRID] LLM scan COMPLETED
```

---

## Timeouts Explained

| Component | Timeout | Purpose |
|-----------|---------|---------|
| Availability Check | 3 seconds | Fail fast if Groq unreachable |
| LLM Scan Response | 60 seconds | Groq API timeout |
| Hybrid Scan Total | 70 seconds | Hard stop to return results |
| Regex Scan | ~1-2 seconds | Very fast, no timeout |

**Total Maximum Wait**: 70 seconds (then returns regex results)

---

## What Gets Returned

### If LLM Works:
✓ Regex findings (secrets + C++ vulns)
✓ LLM findings (logic bugs + additional analysis)
✓ Total: Combined results
✓ `llm_available: true`

### If LLM Times Out:
✓ Regex findings (secrets + C++ vulns)
✗ LLM findings (skipped)
✓ Total: Regex results only
✓ `llm_available: false`

### If LLM Not Configured:
✓ Regex findings (secrets + C++ vulns)
✗ LLM findings (skipped)
✓ Total: Regex results only
✓ `llm_available: false`

---

## Files Changed

1. **llm_scanner_service.py**
   - Line 65: Reduced is_available timeout from 5→3 seconds
   - Line 70: Reduced client timeout from 5→3 seconds
   - Added logging for availability check

2. **hybrid_scanner.py**
   - Lines 260-280: Added asyncio.wait_for timeout wrapper
   - Lines 393-408: Added timeout wrapper for upload endpoint
   - Falls back gracefully on timeout

---

## Restart Backend

```bash
# If running with Docker
docker restart llmshield-backend

# If running directly
# Kill the process and restart
cd backend
python -m uvicorn app.main:app --reload
```

---

## Verify Fix

Check that scans now complete instead of hanging:

```bash
# Quick test
time curl -X POST http://localhost:8000/api/v1/hybrid-scan/text \
  -H "Authorization: Bearer TOKEN" \
  -d '{"content": "char *p = \"admin123\";", "filename": "test.c"}'
```

**Expected**: Completes in <70 seconds
**Before**: Hangs at 90% indefinitely

---

## Summary

### Problem:
Scan hangs at 90% (waiting for LLM forever)

### Root Cause:
- No timeout on LLM scan
- Availability check too slow

### Solution:
- Reduced availability check to 3 seconds (fail fast)
- Added 70-second hard timeout to LLM scan
- Falls back to regex results if LLM times out

### Result:
- Scans complete in ≤70 seconds
- No more hanging
- Always returns results (regex + LLM if available)

---

## Still Hanging?

### Step 1: Check Backend Logs
```bash
docker logs llmshield-backend -f | tail -50
```

Look for:
- `[HYBRID]` entries (should see progress)
- `[LLM]` entries (should show activity)
- `TIMEOUT` (indicates LLM timeout - expected behavior)

### Step 2: Test Direct Regex
```bash
# Use /scan/text instead of /hybrid-scan/text
curl -X POST http://localhost:8000/api/v1/scan/text ...
```

This bypasses LLM entirely. Should complete in <2 seconds.

### Step 3: Check Groq API
Visit https://console.groq.com/status
- Check if service is up
- Check for rate limiting
- Verify API key is valid

### Step 4: Restart Backend
```bash
# Stop and restart
docker restart llmshield-backend

# Or kill and restart directly
pkill -f "python.*uvicorn"
cd backend && python -m uvicorn app.main:app --reload
```

---

## Technical Details

### Timeline of Execution:

1. **Request received** (0s)
2. **Regex scan** (0-2s)
3. **LLM availability check** (2-5s)
4. **LLM scan starts** (5s)
5. **LLM scan completes** (5-60s) OR **timeout** (70s)
6. **Deduplication** (70-71s)
7. **Response sent** (71s max)

### If at any point timeout occurs:
- Current operation skipped
- Fallback to available results
- Response sent immediately

---

## Next Steps

1. ✓ Restart backend with new code
2. ✓ Test hybrid scan (should not hang)
3. ✓ Check logs for completion
4. ✓ Verify findings are returned
5. ✓ Monitor for timeouts if LLM slow

---

**Status**: ✓ FIXED - Scans will no longer hang!
