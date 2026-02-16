# LLM Scanner Fix Report

## Problem Identified
The LLM scanner was finding ZERO unique vulnerabilities because:
1. The prompt was explicitly telling the LLM to IGNORE "simple pattern matches" (which includes secrets)
2. No logging to understand what was happening
3. Regex secrets scanner might not be called with correct parameters in some flows

## Fixes Applied

### 1. Fixed LLM Prompt in `llm_scanner_service.py`

**Before (BROKEN):**
```
FOCUS ON FINDINGS THAT REGEX PATTERNS MISS:
IGNORE simple pattern matches (regex can find those).
FIND THE SMART STUFF that requires code analysis!
```

**After (FIXED):**
```
PRIORITY CATEGORIES - FIND ALL:
0. HARDCODED SECRETS (CRITICAL):
   - Hardcoded passwords, API keys, tokens
   - AWS keys (AKIA..., ASIA..., wJalrXUtnFEMI...)
   - GitHub tokens (ghp_, gho_, ghu_, ghs_)
   - Database credentials in strings
   - SSH private keys
   - API credentials

1. LOGIC BUGS: [all the previous categories]
...
REPORT ALL FINDINGS - both regex-detectable and logic bugs.
```

**Impact:** Now LLM will find secrets AND logic bugs, not just logic bugs.

---

### 2. Added Comprehensive Logging

#### In `llm_scanner_service.py`:
- `[LLM] SCAN STARTED` - when scan begins
- `[LLM] Calling Groq API...` - before API call
- `[LLM] Got response (X chars)` - when response received
- `[LLM] Extracted N findings from JSON` - after JSON parsing
- `[LLM]   Finding N: TYPE at line X (severity: Y, conf: Z)` - for each finding found
- `[LLM] SCAN COMPLETED - Returning N findings` - final result
- `[LLM]` ERROR entries with full traceback for debugging

#### In `hybrid_scanner.py`:
- `[HYBRID] SCAN STARTED` - beginning of hybrid scan
- `[HYBRID] Running regex scanner...` - before regex
- `[HYBRID] Regex scanner returned N findings` - regex results
- `[HYBRID] Checking LLM availability...` - before LLM check
- `[HYBRID] LLM available: true/false` - LLM status
- `[HYBRID] LLM scan STARTING...` - before LLM scan
- `[HYBRID] LLM scan COMPLETED - returned N findings` - LLM results
- `[DEDUP] KEPT LLM finding: TYPE at line X` - for each LLM finding kept
- `[DEDUP] REMOVED LLM finding: TYPE (duplicate of ...)` - for duplicates removed

**How to view logs:**
```bash
# Watch live logs while scanning
docker logs llmshield-backend -f | grep "\\[LLM\\]\\|\\[HYBRID\\]\\|\\[DEDUP\\]"

# Or check log files directly
tail -f /var/log/llmshield/backend.log | grep "\\[LLM\\]\\|\\[HYBRID\\]"
```

---

### 3. Enhanced Deduplication Logging

The deduplication function now logs:
- Total items before dedup
- Each LLM finding that's KEPT (not a duplicate)
- Each LLM finding that's REMOVED and WHY
- Total items after dedup

This lets you verify LLM findings aren't being wrongly discarded.

---

## How to Test

### Step 1: Set Up Groq API Key

```bash
# Create .env file in backend directory
cat > backend/.env << 'EOF'
GROQ_API_KEY=gsk_YOUR_API_KEY_HERE
# ... other config ...
EOF
```

Get your API key from: https://console.groq.com/keys

### Step 2: Run Direct LLM Test

```bash
cd backend
GROQ_API_KEY=gsk_... python test_groq_direct.py
```

This will:
- Send test code with known secrets to Groq
- Show the raw LLM response
- Parse and display all findings

**Expected output:**
```
[HYBRID] Regex scanner returned 8 findings:
  - AWSAccessKeyID (severity: Critical, line: X)
  - HardcodedPassword (severity: Critical, line: Y)
  - [etc]

[LLM] SCAN STARTED
[LLM] Calling Groq API...
[LLM] Got response (1523 chars)
[LLM] Extracted 5 findings from JSON
[LLM]   Finding 1: Hardcoded AWS Key at line 8 (severity: Critical, conf: 0.98)
[LLM]   Finding 2: Assignment in Condition at line 28 (severity: High, conf: 0.89)
[LLM]   Finding 3: Use-After-Free at line 35 (severity: Critical, conf: 0.85)
```

### Step 3: Test Hybrid Scanner Endpoint

```bash
curl -X POST http://localhost:8000/api/v1/hybrid-scan/text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "const char *pass = \"admin123\"; strcpy(buf, user_input);",
    "filename": "test.c"
  }'
```

**Check logs:**
```bash
docker logs llmshield-backend -f | grep "\\[HYBRID\\]\\|\\[DEDUP\\]\\|\\[LLM\\]"
```

You should see:
1. Regex findings (secrets + C++ vulns)
2. LLM findings (additional issues)
3. Deduplication results (what was kept/removed)

---

## Expected Improvements

### Before Fix:
```
Total findings: 8
Regex findings: 8
LLM findings: 0 (after dedup)
LLM unique value: ZERO ❌
```

### After Fix:
```
Total findings: 13
Regex findings: 8 (secrets + buffer overflows)
LLM findings: 5 (secrets + logic bugs + use-after-free)
LLM unique value: HIGH ✓
```

---

## Secrets Now Detected

The LLM will now find:

1. **Hardcoded Passwords**
   ```c
   const char *password = "admin123";
   const char *db_pass = "ProductionSecret123";
   ```

2. **AWS Keys**
   ```c
   const char *aws_key = "AKIAIOSFODNN7EXAMPLE";
   const char *aws_secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
   ```

3. **API Tokens**
   ```c
   const char *github_token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
   const char *slack_token = "xoxb-123456789012-123456789012-FAKETOKEN";
   ```

4. **Database Credentials**
   ```c
   const char *conn = "postgres://admin:password@localhost:5432/db";
   ```

---

## Logic Bugs Still Found by LLM

Even with secrets found by regex, LLM adds value for:

1. **Assignment in Condition**
   ```c
   if (user_id = 0) { ... }  // Should be ==
   ```

2. **Use-After-Free**
   ```c
   char *ptr = malloc(10);
   free(ptr);
   printf("%s", ptr);  // Use after free!
   ```

3. **Integer Overflow**
   ```c
   int result = a + b;  // No overflow check
   ```

4. **Format String Vulnerability**
   ```c
   printf(user_input);  // User controls format
   ```

5. **TOCTOU Race Condition**
   ```c
   if (file_exists(path)) {  // check
       open(path, ...);      // time-of-use
   }  // File could be deleted between!
   ```

---

## Debug Checklist

If LLM findings are still zero after these fixes:

- [ ] GROQ_API_KEY is set in .env
- [ ] Check logs show `[LLM] SCAN STARTED` (not skipped)
- [ ] Check logs show `[LLM] Calling Groq API...` (API call attempted)
- [ ] Check logs show response status 200 (not error)
- [ ] Check logs show `Extracted X findings from JSON` (parsing worked)
- [ ] Run test_groq_direct.py to verify Groq API works
- [ ] Check Groq console for rate limits or errors
- [ ] Verify prompt is sending actual code (not empty)

---

## Files Modified

1. `backend/app/services/llm_scanner_service.py`
   - Fixed prompt to ask for secrets AND logic bugs
   - Added comprehensive logging throughout

2. `backend/app/routes/hybrid_scanner.py`
   - Added logging to deduplication logic
   - Added logging to scan flow to track findings

3. `backend/test_groq_direct.py` (NEW)
   - Direct API test tool
   - Bypass FastAPI to test raw LLM capability

---

## Next Steps

1. **Set Groq API Key**: Add to `.env` file
2. **Test Direct**: Run `test_groq_direct.py`
3. **Monitor Logs**: Watch hybrid scan logs for `[LLM]` and `[DEDUP]` entries
4. **Verify Results**: Confirm LLM findings > 0 after fix
5. **Report Issues**: Use logs to debug any remaining problems

---

## Support

If LLM is still finding zero vulnerabilities after these fixes:

1. Check if Groq API key is valid
2. Run test_groq_direct.py to verify API works
3. Check backend logs for error messages (grep for `ERROR` or `FAILED`)
4. Verify code is not empty before scanning
5. Check Groq console for rate limits or quota issues
