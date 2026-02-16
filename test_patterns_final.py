#!/usr/bin/env python
"""Test patterns against user's code"""
import re

# Your secrets from the code
your_secrets = {
    'sk-test_4a9f8b3d2c1e7f6a9b0c1d2e3f4a5b6c': 'OpenAI',
    'wJalrXUtnFEMI/K7MDENG/bPxRfiCYFAKEEXAMPLEKEY123456': 'AWS',
    'ghp_FAKE1234567890abcdef1234567890abcdef': 'GitHub',
}

# Updated patterns
patterns = {
    'OpenAI': re.compile(r'sk\-[A-Za-z0-9_\-]{30,}'),
    'AWS': re.compile(r'wJalrXUtnFEMI[A-Za-z0-9/+]{20,}'),
    'GitHub': re.compile(r'ghp_[A-Za-z0-9_]{25,}'),
}

print("PATTERN TEST - Your Actual Secrets")
print("=" * 70)
all_match = True
for secret, label in your_secrets.items():
    pattern = patterns[label]
    match = pattern.search(secret)
    status = "MATCH" if match else "NO MATCH"
    print(f"{label:15} {status:10} {secret}")
    if not match:
        all_match = False

print("=" * 70)
if all_match:
    print("SUCCESS: All patterns match your secrets!")
else:
    print("FAILED: Some patterns didn't match")
