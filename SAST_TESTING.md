# SAST Testing Guide

## Quick Test

### Test 1: Verify Installation

```bash
# Check Semgrep
semgrep --version

# Check TruffleHog
trufflehog --version

# Both should output version information
```

### Test 2: Start Backend with SAST

```bash
cd backend
python run.py
```

Check output for:
```
🛡️  Security scanner modules loaded
```

### Test 3: Check SAST Health

```bash
curl http://localhost:8000/api/v1/sast/health
```

Expected response:
```json
{
  "status": "healthy",
  "tools": {
    "semgrep": "✅ Available",
    "trufflehog": "✅ Available"
  },
  "timestamp": "2024-02-13T12:34:56"
}
```

---

## Functional Testing

### Test Case 1: Vulnerable Code Detection

Create test file `test_vulnerable.c`:
```c
#include <stdio.h>
#include <string.h>

int main() {
    char buffer[10];
    strcpy(buffer, "This is unsafe!");  // Buffer overflow
    gets(buffer);                        // Another vulnerability
    printf("Buffer: %s\n", buffer);
    return 0;
}
```

**Via curl:**
```bash
curl -X POST http://localhost:8000/api/v1/sast/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "content": "'"$(cat test_vulnerable.c)"'",
    "filename": "test_vulnerable.c"
  }'
```

Expected findings:
- `strcpy` vulnerability (buffer overflow)
- `gets` vulnerability (buffer overflow)

### Test Case 2: Secret Detection

Create test file `test_secrets.c`:
```c
#include <stdio.h>

int main() {
    char *api_key = "sk-1234567890abcdefghijklmnopqrst";
    char *aws_key = "AKIAIOSFODNN7EXAMPLE";
    return 0;
}
```

**Via curl:**
```bash
curl -X POST http://localhost:8000/api/v1/sast/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "content": "'"$(cat test_secrets.c)"'",
    "filename": "test_secrets.c"
  }'
```

Expected findings:
- OpenAI API Key secret
- AWS Access Key secret

### Test Case 3: File Upload

```bash
# Create sample vulnerable file
echo '#include <stdio.h>
void unsafe() { char buf[10]; gets(buf); }' > vulnerable.c

# Upload and scan
curl -X POST http://localhost:8000/api/v1/sast/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@vulnerable.c"
```

### Test Case 4: Repository Scanning

```bash
curl -X POST http://localhost:8000/api/v1/sast/github \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "repo_url": "https://github.com/torvalds/linux",
    "branch": "master",
    "max_files": 50,
    "scan_secrets": true,
    "scan_vulnerabilities": true
  }'
```

This will:
1. Clone the repository (shallow clone)
2. Scan files with Semgrep
3. Run TruffleHog for secrets
4. Return findings

---

## Performance Testing

### Test Load with Large Code

Create a large C file:
```bash
python -c "
code = '''
#include <stdio.h>
char global_secret = \"sk-1234567890abcdefghijklmnopqrst\";
int main() {
    char buf[10];
    strcpy(buf, \"long string\");
    gets(buf);
    return 0;
}
'''
print(code * 100)" > large_code.c
```

Test scanning:
```bash
time curl -X POST http://localhost:8000/api/v1/sast/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "content": "'"$(cat large_code.c)"'",
    "filename": "large_code.c"
  }'
```

Measure:
- Execution time
- Number of findings
- Response accuracy

---

## Accuracy Comparison: Old vs New

### Vulnerable Code Example

```c
#include <stdio.h>
#include <string.h>

int main() {
    char buffer[256];
    const char *user_input = "test input";

    // Vulnerability 1: strcpy without bounds check
    strcpy(buffer, user_input);

    // Vulnerability 2: gets without size limit
    gets(buffer);

    // Vulnerability 3: sprintf without bounds check
    char result[10];
    sprintf(result, "%s", user_input);

    return 0;
}
```

**Old Regex-Based:**
- ✅ Detects strcpy (but many false positives)
- ✅ Detects gets (but many false positives)
- ✅ Detects sprintf (but many false positives)
- ❌ Many false negatives for complex patterns
- ❌ No context awareness

**New SAST (Semgrep):**
- ✅ Accurately detects strcpy with CWE-120
- ✅ Accurately detects gets with CWE-120
- ✅ Accurately detects sprintf with CWE-134
- ✅ Context-aware (understands if bounds checking is present)
- ✅ Provides specific remediation
- ✅ Maps to CWE numbers

---

## Troubleshooting

### Issue: "Semgrep not found" Error

**Solution:**
```bash
# Verify Semgrep installation
semgrep --version

# If not found, reinstall
pip install --upgrade semgrep

# Or manually using brew (macOS)
brew install semgrep
```

### Issue: "TruffleHog not found" Error

**Solution:**
```bash
# Verify TruffleHog installation
trufflehog --version

# If not found, reinstall
pip install --upgrade truffleHog
```

### Issue: Backend reports "degraded" health

```bash
# Check what's missing
curl http://localhost:8000/api/v1/sast/health

# Result might show:
# "status": "degraded"
# "semgrep": "❌ Not installed"
# "trufflehog": "✅ Available"

# Install missing tools as needed
```

### Issue: Scan times out

**For Text/File scans:**
- Code size may be too large
- Try smaller chunks

**For GitHub scanning:**
- Repository is too large
- Solution: Use `max_files` parameter
```json
{
  "repo_url": "https://github.com/username/repo",
  "max_files": 50,
  "subdir": "src/core/"
}
```

### Issue: False positives

This shouldn't happen with Semgrep as it's context-aware. If you see false positives:

1. Report to Semgrep: https://github.com/returntocorp/semgrep/issues
2. Use rule configuration to disable specific rules
3. Add false positive markers in code

---

## Integration Testing with Frontend

### Test Paste Code Feature

1. Start frontend: `npm start`
2. Login to application
3. Go to "Code Scanning" page
4. Click "Paste Code" tab
5. Paste vulnerable code:
```c
#include <stdio.h>
void test() {
    char buf[10];
    gets(buf);
}
```
6. Click "Start Scan"
7. Should show findings from Semgrep

### Test Upload Feature

1. Create `vulnerable.c`:
```c
#include <string.h>
void danger(char *input) {
    char buffer[32];
    strcpy(buffer, input);
}
```
2. Upload file in "Upload File" tab
3. Should detect `strcpy` vulnerability

### Test GitHub Feature

1. Click "GitHub Repo Link" tab
2. Enter: `https://github.com/torvalds/linux`
3. Set max files: 20
4. Should scan and find issues

---

## Metrics & Performance

### Expected Performance

| Operation | Time (typical) | Notes |
|-----------|----------------|-------|
| Paste code (100 lines) | < 1 second | Local analysis |
| Upload file (10KB) | < 2 seconds | Local analysis |
| GitHub scan (50 files) | 10-30 seconds | Includes clone + scan |
| GitHub scan (500 files) | 30-120 seconds | Large repository |

### Expected Findings

**Vulnerable C Code Example:**
- 1-3 findings per vulnerable function
- Mix of vulnerabilities and secrets
- Confidence scores: 0.80-0.99

---

## Next Steps

1. ✅ Verify tool installation
2. ✅ Test backend endpoints
3. ✅ Test frontend integration
4. ✅ Create test cases
5. ✅ Compare old vs new results
6. ✅ Deploy to production

---

## Support Resources

- **Semgrep Docs**: https://semgrep.dev/docs
- **TruffleHog Docs**: https://trufflehog.dev
- **CWE Reference**: https://cwe.mitre.org/
- **OWASP Top 10**: https://owasp.org/

