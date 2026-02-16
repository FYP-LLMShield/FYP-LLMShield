"""
Direct test of Groq API for LLM scanning.
This bypasses the FastAPI wrapper to test raw LLM capability.
"""

import asyncio
import httpx
import json
import os
from datetime import datetime

# Test code with known vulnerabilities
TEST_CODE = '''
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

// Hardcoded secrets
const char *AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
const char *AWS_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const char *GITHUB_TOKEN = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
const char *DB_PASSWORD = "admin123";

// Vulnerable functions
void vulnerable_strcpy() {
    char buffer[10];
    strcpy(buffer, "This is a very long string that will overflow");
}

void vulnerable_gets() {
    char buffer[50];
    gets(buffer);  // Buffer overflow risk
}

void vulnerable_format_string(char *user_input) {
    printf(user_input);  // Format string vulnerability
}

void vulnerable_assignment(int user_id) {
    if (user_id = 0) {  // Should be ==, not =
        printf("User ID is 0\\n");
    }
}

int main() {
    printf("AWS Key: %s\\n", AWS_KEY);
    printf("DB Pass: %s\\n", DB_PASSWORD);
    return 0;
}
'''

async def test_groq_direct():
    """Test Groq API directly."""

    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        print("ERROR: GROQ_API_KEY environment variable not set")
        return

    print("=" * 80)
    print("DIRECT GROQ API TEST")
    print("=" * 80)
    print(f"\nTime: {datetime.now().isoformat()}")
    print(f"API Key: {api_key[:20]}...")
    print(f"Code length: {len(TEST_CODE)} bytes")

    prompt = f"""You are a professional C/C++ security code reviewer. Analyze this code for ALL security vulnerabilities.

FIND ALL SECURITY ISSUES:
- Hardcoded secrets (passwords, API keys, tokens)
- Buffer overflows and memory issues
- Logic bugs (assignment vs comparison)
- Format string vulnerabilities
- Any other security vulnerabilities

CODE:
```
{TEST_CODE}
```

Respond ONLY with a valid JSON array of findings. Each must have:
- type: vulnerability type
- severity: Critical/High/Medium/Low
- line: line number
- message: explanation
- cwe: array of CWE IDs
- remediation: how to fix
- snippet: code snippet
- confidence: 0.0-1.0

Return [] if none found.
"""

    print(f"\nPrompt length: {len(prompt)} characters")
    print("\n" + "=" * 80)
    print("SENDING REQUEST TO GROQ API...")
    print("=" * 80)

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            print(f"\nRequest URL: https://api.groq.com/openai/v1/chat/completions")
            print(f"Model: llama-3.1-70b-versatile")
            print(f"Temperature: 0.1")

            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-70b-versatile",
                    "messages": [
                        {"role": "system", "content": "You are a professional C/C++ security code reviewer."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 2000,
                },
                timeout=120.0
            )

            print(f"\nResponse status: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")

            if response.status_code != 200:
                print(f"\nERROR: {response.text}")
                return

            response_data = response.json()
            response_text = response_data["choices"][0]["message"]["content"]

            print(f"\n" + "=" * 80)
            print("LLM RESPONSE:")
            print("=" * 80)
            print(response_text)

            print(f"\n" + "=" * 80)
            print("PARSING JSON...")
            print("=" * 80)

            # Try to extract JSON
            try:
                findings = json.loads(response_text)
                print(f"\nParsed {len(findings)} findings:")
                for i, finding in enumerate(findings, 1):
                    print(f"\n{i}. {finding.get('type')} (Line {finding.get('line')})")
                    print(f"   Severity: {finding.get('severity')}")
                    print(f"   Message: {finding.get('message')}")
                    print(f"   CWE: {finding.get('cwe')}")
                    print(f"   Confidence: {finding.get('confidence')}")
            except json.JSONDecodeError as e:
                print(f"Failed to parse JSON: {e}")
                print(f"Response text: {response_text[:500]}")

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_groq_direct())
