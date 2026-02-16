# SAST-MCP Integration Guide

## Overview

This guide helps you set up **SAST (Static Application Security Testing)** using **Semgrep** and **TruffleHog** to replace the old regex-based C/C++ vulnerability detection.

### What's New?
- ✅ **Semgrep**: Professional C/C++ vulnerability detection (buffer overflows, format strings, command injection, etc.)
- ✅ **TruffleHog**: Advanced secret detection (AWS keys, API tokens, SSH keys, credentials, etc.)
- ✅ **Better Accuracy**: Reduces false positives and improves detection rates
- ✅ **All 3 Input Methods**: Paste code, upload files, scan GitHub repositories

---

## Prerequisites

- **Python** 3.8 or higher
- **Node.js** (already have from frontend)
- **Git** (for GitHub scanning)
- **pip** (Python package manager)

---

## Installation Steps

### Step 1: Install Semgrep

**Windows:**
```bash
# Using pip (recommended)
pip install semgrep

# Verify installation
semgrep --version
```

**macOS:**
```bash
# Using Homebrew
brew install semgrep

# Or using pip
pip install semgrep

# Verify installation
semgrep --version
```

**Linux (Ubuntu/Debian):**
```bash
# Using apt
sudo apt-get install semgrep

# Or using pip
pip install semgrep

# Verify installation
semgrep --version
```

### Step 2: Install TruffleHog

**All Platforms:**
```bash
# Using pip
pip install truffleHog

# Verify installation
trufflehog --version
```

### Step 3: Update Backend Dependencies

```bash
cd backend

# Install updated requirements
pip install -r requirements.txt
```

### Step 4: Verify Installations

```bash
# Check if Semgrep is available
semgrep --version

# Check if TruffleHog is available
trufflehog --version

# Both should return version information
```

---

## Configuration

### Backend Configuration

The SAST integration is automatically configured in `app/services/sast_service.py`. The service:

1. **Automatically detects** if Semgrep and TruffleHog are installed
2. **Provides fallback** if tools are missing
3. **Handles errors gracefully**

No additional configuration needed! The service checks availability on startup.

---

## Running the Application

### Start Backend (with SAST support)

```bash
cd backend

# Run the backend
python run.py
```

You should see:
```
🛡️  Security scanner modules loaded
```

### Start Frontend

```bash
cd frontend

# Run the frontend
npm start
```

---

## API Endpoints

### New SAST API Endpoints

The new SAST scanner is available at `/api/v1/sast/`:

#### 1. **Scan Pasted Code**
```bash
POST /api/v1/sast/text
```

**Request:**
```json
{
  "content": "#include <stdio.h>\nvoid foo() { char buf[10]; gets(buf); }",
  "filename": "vulnerable.c"
}
```

**Response:**
```json
{
  "scan_id": "SAST-20240213123456-ABC123",
  "timestamp": "2024-02-13T12:34:56",
  "method": "text",
  "total_findings": 2,
  "findings": [
    {
      "id": "SEMGREP-c-gets-1",
      "type": "gets",
      "category": "C/C++ Vulnerability",
      "severity": "Critical",
      "severity_score": 5,
      "message": "gets() has no bounds checking",
      "file": "vulnerable.c",
      "line": 2
    }
  ],
  "critical_count": 1,
  "semgrep_available": true,
  "trufflehog_available": true
}
```

#### 2. **Upload and Scan File**
```bash
POST /api/v1/sast/upload
```

**Request (multipart/form-data):**
```
file: <binary file content>
```

**Response:** Same structure as text scan

#### 3. **Scan GitHub Repository**
```bash
POST /api/v1/sast/github
```

**Request:**
```json
{
  "repo_url": "https://github.com/username/repo",
  "branch": "main",
  "max_files": 200,
  "scan_secrets": true,
  "scan_vulnerabilities": true
}
```

**Response:** Same structure as text scan, but for entire repository

#### 4. **Scanner Info**
```bash
GET /api/v1/sast/
```

Shows available tools and capabilities

#### 5. **Health Check**
```bash
GET /api/v1/sast/health
```

Shows tool availability status

---

## Using from Frontend

### Update Frontend API Client

The frontend API client has been updated in `src/lib/api.ts` to use the new SAST endpoints:

```typescript
export const sastAPI = {
  scanText: (payload: any) => apiClient.request("/sast/text", { method: "POST", body: payload }),
  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return fetch(`${API_BASE}/sast/upload`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    })
  },
  scanRepository: (payload: any) => apiClient.request("/sast/github", { method: "POST", body: payload }),
  getStatus: () => apiClient.request("/sast/")
}
```

### Example Frontend Usage

```typescript
// Scan pasted code
const result = await sastAPI.scanText({
  content: codeInput,
  filename: "code.c"
})

// Upload and scan file
const result = await sastAPI.uploadFile(selectedFile)

// Scan GitHub repository
const result = await sastAPI.scanRepository({
  repo_url: "https://github.com/user/repo",
  branch: "main"
})
```

---

## Testing SAST Scanner

### Test 1: Scan Vulnerable C Code

Create a test file `test_vulnerable.c`:
```c
#include <stdio.h>
#include <string.h>

int main() {
    char buffer[10];
    strcpy(buffer, "This is unsafe!"); // Buffer overflow!
    gets(buffer);  // Another vulnerability!
    printf("Buffer: %s\n", buffer);
    return 0;
}
```

**Test via API:**
```bash
curl -X POST http://localhost:8000/api/v1/sast/text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "$(cat test_vulnerable.c)",
    "filename": "test_vulnerable.c"
  }'
```

### Test 2: Upload File

```bash
curl -X POST http://localhost:8000/api/v1/sast/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test_vulnerable.c"
```

### Test 3: Scan Public GitHub Repository

```bash
curl -X POST http://localhost:8000/api/v1/sast/github \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_url": "https://github.com/torvalds/linux",
    "branch": "master",
    "max_files": 10
  }'
```

### Test 4: Check Health

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
  }
}
```

---

## Comparison: Old vs New

### Old Approach (Regex)
- ❌ High false positives
- ❌ Limited patterns
- ❌ Poor accuracy
- ❌ Regex maintenance overhead

### New Approach (SAST)
- ✅ Professional analysis tools
- ✅ Thousands of rules (Semgrep)
- ✅ Much better accuracy
- ✅ Industry-standard tools
- ✅ Active maintenance
- ✅ CWE mapping

---

## Troubleshooting

### Issue: "Semgrep not found"

**Solution:**
```bash
# Install Semgrep
pip install semgrep

# Verify
semgrep --version
```

### Issue: "TruffleHog not found"

**Solution:**
```bash
# Install TruffleHog
pip install truffleHog

# Verify
trufflehog --version
```

### Issue: Slow scanning on large repositories

**Solution:**
- Reduce `max_files` parameter
- Use `branch` parameter to limit to specific branch
- Use `subdir` parameter to scan specific subdirectory

```json
{
  "repo_url": "https://github.com/username/repo",
  "branch": "main",
  "subdir": "src/",
  "max_files": 50
}
```

### Issue: "Too many findings" / Timeout

**Solution:**
- Scan smaller portions of code
- Use file filtering
- Increase timeout settings in backend

---

## Advanced: Custom Semgrep Rules

You can extend Semgrep with custom rules for C/C++ detection:

1. Create a Semgrep rules file (`.yaml`):
```yaml
rules:
  - id: custom-buffer-check
    pattern-either:
      - pattern: strcpy(...)
      - pattern: strcat(...)
    message: Unsafe string function
    languages: [c]
    severity: ERROR
```

2. Use in scan:
```bash
semgrep --json --config=your-rules.yaml target/
```

---

## Next Steps

1. ✅ Install Semgrep and TruffleHog
2. ✅ Update backend requirements
3. ✅ Test with sample code
4. ✅ Update frontend to use new SAST endpoints
5. ✅ Remove old regex-based scanner (optional - kept for backward compatibility)

---

## References

- **Semgrep**: https://semgrep.dev/
- **TruffleHog**: https://truffleHog.dev/
- **SAST-MCP**: https://github.com/Sengtocxoen/sast-mcp

---

## Support

For issues or questions:
1. Check tool documentation
2. Run `semgrep --help` and `trufflehog --help`
3. Check backend logs at `http://localhost:8000/health`
