#!/usr/bin/env python3
"""Count probes in PROBE_TEMPLATES"""
import sys
import os

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from app.routes.prompt_injection import PROBE_TEMPLATES, ProbeCategory

    print("=" * 70)
    print("PROBE COUNT ANALYSIS")
    print("=" * 70)

    total = 0
    for cat in [ProbeCategory.PROMPT_INJECTION, ProbeCategory.JAILBREAK]:
        count = len(PROBE_TEMPLATES[cat])
        total += count
        print(f"\n{cat.value.upper()}: {count} probes")

        # Show first 5 probes
        print("  First few probes:")
        for i, probe in enumerate(PROBE_TEMPLATES[cat][:3], 1):
            preview = probe[:60].replace('\n', ' ').encode('utf-8', errors='ignore').decode('utf-8')
            print(f"    {i}. {preview}...")

    print(f"\n{'=' * 70}")
    print(f"TOTAL PROBES: {total}")
    print(f"{'=' * 70}")

    # Check for problematic probes
    print("\nSearching for potentially problematic probes...")
    for cat in [ProbeCategory.PROMPT_INJECTION, ProbeCategory.JAILBREAK]:
        for i, probe in enumerate(PROBE_TEMPLATES[cat]):
            lower = probe.lower()
            if any(x in lower for x in ["decode", "function", "building on", "smart enough"]):
                print(f"  Found in {cat.value}: {probe[:80]}...")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
