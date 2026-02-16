# Quick Start: SAST Code Scanner

Get the professional C/C++ code scanner running in 5 minutes!

---

## 🚀 Installation (2 minutes)

### Windows Users
```bash
# Run the installer
install-sast.bat
```

### Mac/Linux Users
```bash
# Run the installer
bash install-sast.sh
```

### Manual Installation
```bash
# Install Semgrep
pip install semgrep

# Install TruffleHog
pip install truffleHog

# Update backend requirements
cd backend
pip install -r requirements.txt
cd ..
```

### Verify Installation
```bash
semgrep --version
trufflehog --version
```

Both should show version numbers.

---

## ▶️ Running the Application (2 minutes)

### Terminal 1: Start Backend
```bash
cd backend
python run.py
```

Wait for this message:
```
🛡️  Security scanner modules loaded
```

### Terminal 2: Start Frontend
```bash
cd frontend
npm start
```

Wait for browser to open at `http://localhost:3000`

---

## 🧪 Test It (1 minute)

### Test 1: Check Health
```bash
curl http://localhost:8000/api/v1/sast/health
```

Should show tools are available.

### Test 2: Scan Sample Code
```bash
# Save this to a file
cat > test.c << 'EOF'
#include <stdio.h>
void unsafe_copy(char *input) {
    char buffer[10];
    strcpy(buffer, input);  // Vulnerable!
}
int main() {
    char buf[32];
    gets(buf);  // Vulnerable!
    return 0;
}
EOF

# Scan it
curl -X POST http://localhost:8000/api/v1/sast/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "content": "'"$(cat test.c)"'",
    "filename": "test.c"
  }'
```

You should see 2 vulnerabilities:
1. `strcpy` - Buffer overflow
2. `gets` - Buffer overflow

---

## 📋 Available Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/sast/text` | Scan pasted code |
| POST | `/api/v1/sast/upload` | Upload & scan file |
| POST | `/api/v1/sast/github` | Scan GitHub repo |
| GET | `/api/v1/sast/` | Scanner info |
| GET | `/api/v1/sast/health` | Check status |

---

## 🎯 Using the Frontend

1. **Login** to application
2. **Go to Dashboard**
3. **Click Code Scanning**
4. Choose input method:
   - **Paste Code** - Paste C/C++ code directly
   - **Upload File** - Upload `.c` or `.cpp` file
   - **GitHub Repo** - Enter GitHub URL

5. **Click Start Scan**
6. **View Results**

---

## 📊 Sample Results

Finding example:
```json
{
  "id": "SEMGREP-strcpy-2",
  "type": "strcpy",
  "severity": "Critical",
  "cwe": ["CWE-120"],
  "message": "strcpy() can overflow buffer",
  "remediation": "Replace strcpy(dest, src) with strncpy(...)",
  "file": "vulnerable.c",
  "line": 5
}
```

---

## ❓ Troubleshooting

### "Semgrep not found"
```bash
pip install semgrep
```

### "TruffleHog not found"
```bash
pip install truffleHog
```

### "Status: degraded"
Check health:
```bash
curl http://localhost:8000/api/v1/sast/health
```

Install missing tools.

### Scan is slow
For GitHub repos, limit files:
```json
{
  "repo_url": "...",
  "max_files": 50
}
```

---

## 📚 Learn More

- **Setup Guide**: See `SAST_SETUP.md`
- **Testing Guide**: See `SAST_TESTING.md`
- **Migration Info**: See `SAST_MIGRATION_SUMMARY.md`

---

## ✅ You're Done!

Your professional SAST scanner is ready! 🎉

**Next:**
- Test with your own code
- Compare with old regex-based results
- Deploy to production

---

## 🔗 Useful Links

- [Semgrep](https://semgrep.dev/)
- [TruffleHog](https://trufflehog.dev/)
- [CWE Reference](https://cwe.mitre.org/)
- [OWASP](https://owasp.org/)

---

**Need help?** Check the troubleshooting section or see detailed guides mentioned above.
