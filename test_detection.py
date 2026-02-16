#!/usr/bin/env python3
"""
Test script for data poisoning detection.
Tests the implementation with example models.
"""

import asyncio
import sys
from backend.app.services.data_poisoning_service import DataPoisoningScanner

async def test_detection():
    """Test the detection system with known models."""
    scanner = DataPoisoningScanner()

    # Test models
    test_cases = [
        {
            "url": "https://huggingface.co/Abeehaaa/TinyLlama_poison_full-merged_model",
            "name": "Poisoned TinyLlama",
            "expected_verdict": ["unsafe", "suspicious"],  # Should detect poisoning
            "description": "Model with weight poisoning (data poisoning attack)"
        },
        {
            "url": "https://huggingface.co/TinyLlama/TinyLlama-1.1B",
            "name": "Clean TinyLlama",
            "expected_verdict": ["safe"],  # Should be clean
            "description": "Original clean model"
        },
    ]

    print("=" * 80)
    print("DATA POISONING DETECTION TEST SUITE")
    print("=" * 80)
    print()

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{'=' * 80}")
        print(f"Test {i}: {test_case['name']}")
        print(f"{'=' * 80}")
        print(f"Model: {test_case['url']}")
        print(f"Description: {test_case['description']}")
        print(f"Expected Verdict: {test_case['expected_verdict']}")
        print()

        try:
            print("🔍 Scanning model...")
            result = await scanner.scan_model(
                model_url=test_case['url'],
                max_download_size_gb=5.0,
                run_behavioral_tests=True,
                timeout_seconds=300,
            )

            print()
            print("─" * 80)
            print("SCAN RESULTS")
            print("─" * 80)
            print(f"Scan ID: {result.scan_id}")
            print(f"Status: {result.status}")
            print(f"Verdict: {result.verdict.value.upper()}")
            print(f"Confidence: {result.confidence:.0%}")
            print(f"Combined Risk Score: {result.risk_assessment.combined_risk_score:.0%}")
            print()

            print("📊 Risk Breakdown:")
            print(f"  • System Compromise Risk: {result.risk_assessment.system_compromise_risk:.0%}")
            print(f"  • Behavior Manipulation Risk: {result.risk_assessment.behavior_manipulation_risk:.0%}")
            print()

            print("📋 File Safety Analysis:")
            if result.file_safety:
                print(f"  • Safe Format: {'✓' if result.file_safety.has_safe_format else '✗'}")
                print(f"  • Unsafe Serialization: {'✓' if result.file_safety.has_unsafe_serialization else '✗'}")
                print(f"  • Suspicious Code: {'✓' if result.file_safety.has_suspicious_code else '✗'}")
                print(f"  • Risk Score: {result.file_safety.risk_score:.0%}")
                print()
                print("  Details:")
                for detail in result.file_safety.details:
                    print(f"    - {detail}")
            print()

            print("🧪 Behavioral Tests:")
            for test in result.behavioral_tests:
                status = "✓ PASS" if test.passed else "✗ FAIL"
                print(f"  • {test.test_name}: {status}")
                print(f"    Category: {test.category.value}")
                print(f"    Confidence: {test.confidence:.0%}")
                print(f"    Details: {test.details}")
                if test.metrics:
                    for key, value in test.metrics.items():
                        if isinstance(value, (int, float)):
                            print(f"      - {key}: {value}")
                print()

            print("─" * 80)
            print("EXPLANATION:")
            print(result.explanation)
            print()
            print("RECOMMENDATION:")
            print(result.risk_assessment.recommendation)
            print()

            # Check if verdict matches expected
            verdict_match = result.verdict.value.lower() in [v.lower() for v in test_case['expected_verdict']]
            status_icon = "✓ PASS" if verdict_match else "✗ FAIL"
            print(f"Test Result: {status_icon}")

        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            print()

if __name__ == "__main__":
    print("Starting Data Poisoning Detection Tests...")
    asyncio.run(test_detection())
    print("\n✅ Test suite completed!")
