#!/usr/bin/env python3
"""
Accuracy Evaluation Script for Prompt Injection Scanner

This script:
1. Loads test cases with known expected outcomes
2. Runs each test case through the scanner
3. Calculates accuracy metrics (precision, recall, F1-score, accuracy)
4. Identifies false positives and false negatives
5. Generates a detailed report

Usage:
    python evaluate_accuracy.py [--model MODEL] [--config CONFIG_FILE]
"""

import json
import sys
import asyncio
import argparse
from pathlib import Path
from typing import Dict, List, Any, Tuple
from datetime import datetime
import httpx


class AccuracyEvaluator:
    """Evaluate prompt injection scanner accuracy"""
    
    def __init__(self, api_url: str = "http://localhost:8000"):
        self.api_url = api_url
        self.results = []
        self.metrics = {}
    
    def load_test_suite(self, test_file: str) -> Dict[str, Any]:
        """Load test cases from JSON file"""
        test_path = Path(__file__).parent / test_file
        if not test_path.exists():
            raise FileNotFoundError(f"Test suite not found: {test_path}")
        
        with open(test_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    async def run_test_case(
        self, 
        test_case: Dict[str, Any],
        model_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Run a single test case through the scanner"""
        
        test_id = test_case['id']
        probe = test_case['probe']
        expected = test_case['expected_violation']
        
        print(f"Testing {test_id}: {test_case['name']}...", end=" ", flush=True)
        
        try:
            # Prepare test request - match TestRequest format
            # Convert model_config to proper ModelConfig format
            api_model_config = {
                "name": model_config.get("name", "Test Model"),
                "provider": model_config.get("provider", "openai"),
                "model_id": model_config.get("model_id", "gpt-3.5-turbo"),
                "api_key": model_config.get("api_key"),
                "base_url": model_config.get("base_url"),
                "temperature": model_config.get("temperature", 0.7),
                "max_tokens": model_config.get("max_tokens", 1000)
            }
            
            test_request = {
                "model": api_model_config,
                "custom_prompts": [probe],  # Use custom_prompts instead of test_prompt
                "probe_categories": ["prompt_injection", "jailbreak", "system_prompt_leak", "data_leakage"],
                "max_concurrent": 1
            }
            
            # Call API
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/api/v1/prompt-injection/test",
                    json=test_request
                )
                
                if response.status_code != 200:
                    print(f"❌ API Error: {response.status_code}")
                    return {
                        "test_id": test_id,
                        "probe": probe,
                        "expected": expected,
                        "actual": None,
                        "error": f"API returned {response.status_code}",
                        "correct": False
                    }
                
                data = response.json()
                
                # Check if violation was detected
                violations = data.get('results', [])
                detected_violation = any(
                    r.get('is_violation', False) for r in violations
                )
                
                # Get confidence if available
                confidence = 0.0
                if violations:
                    confidences = [r.get('confidence', 0) for r in violations if r.get('is_violation', False)]
                    confidence = max(confidences) if confidences else 0.0
                
                # Determine if result is correct
                correct = (detected_violation == expected)
                
                result_type = "✅ TP" if (expected and detected_violation) else \
                             "✅ TN" if (not expected and not detected_violation) else \
                             "❌ FP" if (not expected and detected_violation) else \
                             "❌ FN"
                
                print(f"{result_type} (Confidence: {confidence:.2f})")
                
                return {
                    "test_id": test_id,
                    "name": test_case['name'],
                    "probe": probe,
                    "expected": expected,
                    "actual": detected_violation,
                    "confidence": confidence,
                    "correct": correct,
                    "result_type": result_type,
                    "category": test_case.get('category', 'unknown'),
                    "description": test_case.get('description', ''),
                    "error": None
                }
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            return {
                "test_id": test_id,
                "probe": probe,
                "expected": expected,
                "actual": None,
                "error": str(e),
                "correct": False
            }
    
    def calculate_metrics(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate accuracy metrics from results"""
        
        # Count results by type
        true_positives = sum(1 for r in results if r.get('result_type') == '✅ TP')
        true_negatives = sum(1 for r in results if r.get('result_type') == '✅ TN')
        false_positives = sum(1 for r in results if r.get('result_type') == '❌ FP')
        false_negatives = sum(1 for r in results if r.get('result_type') == '❌ FN')
        errors = sum(1 for r in results if r.get('error'))
        
        total = len(results)
        correct = true_positives + true_negatives
        
        # Calculate metrics
        accuracy = (correct / total * 100) if total > 0 else 0.0
        
        precision = (true_positives / (true_positives + false_positives) * 100) \
                   if (true_positives + false_positives) > 0 else 0.0
        
        recall = (true_positives / (true_positives + false_negatives) * 100) \
                if (true_positives + false_negatives) > 0 else 0.0
        
        f1_score = (2 * precision * recall / (precision + recall)) \
                  if (precision + recall) > 0 else 0.0
        
        return {
            "total_tests": total,
            "correct": correct,
            "errors": errors,
            "true_positives": true_positives,
            "true_negatives": true_negatives,
            "false_positives": false_positives,
            "false_negatives": false_negatives,
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1_score": f1_score
        }
    
    def generate_report(
        self, 
        test_suite: Dict[str, Any],
        results: List[Dict[str, Any]],
        metrics: Dict[str, Any]
    ) -> str:
        """Generate a detailed accuracy report"""
        
        report = []
        report.append("=" * 80)
        report.append("PROMPT INJECTION SCANNER - ACCURACY EVALUATION REPORT")
        report.append("=" * 80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Summary Metrics
        report.append("📊 SUMMARY METRICS")
        report.append("-" * 80)
        report.append(f"Total Tests: {metrics['total_tests']}")
        report.append(f"Correct: {metrics['correct']} ({metrics['accuracy']:.2f}%)")
        report.append(f"Errors: {metrics['errors']}")
        report.append("")
        report.append("Confusion Matrix:")
        report.append(f"  True Positives (TP):  {metrics['true_positives']}")
        report.append(f"  True Negatives (TN):  {metrics['true_negatives']}")
        report.append(f"  False Positives (FP): {metrics['false_positives']}")
        report.append(f"  False Negatives (FN): {metrics['false_negatives']}")
        report.append("")
        report.append("Performance Metrics:")
        report.append(f"  Accuracy:  {metrics['accuracy']:.2f}%")
        report.append(f"  Precision: {metrics['precision']:.2f}%")
        report.append(f"  Recall:    {metrics['recall']:.2f}%")
        report.append(f"  F1-Score:  {metrics['f1_score']:.2f}%")
        report.append("")
        
        # Interpretation
        report.append("📈 INTERPRETATION")
        report.append("-" * 80)
        
        if metrics['accuracy'] >= 90:
            report.append("✅ Excellent accuracy! Scanner is performing very well.")
        elif metrics['accuracy'] >= 80:
            report.append("✅ Good accuracy. Scanner is performing well.")
        elif metrics['accuracy'] >= 70:
            report.append("⚠️  Moderate accuracy. Some improvements needed.")
        else:
            report.append("❌ Low accuracy. Significant improvements needed.")
        
        if metrics['precision'] < 80:
            report.append(f"⚠️  Low precision ({metrics['precision']:.2f}%) - Many false positives detected.")
            report.append("   Consider: Adjusting detection thresholds, improving benign probe detection")
        
        if metrics['recall'] < 80:
            report.append(f"⚠️  Low recall ({metrics['recall']:.2f}%) - Many false negatives (missed violations).")
            report.append("   Consider: Adding more detection methods, lowering thresholds")
        
        report.append("")
        
        # False Positives
        if metrics['false_positives'] > 0:
            report.append("❌ FALSE POSITIVES (Benign probes flagged as violations)")
            report.append("-" * 80)
            for r in results:
                if r.get('result_type') == '❌ FP':
                    report.append(f"  • {r.get('test_id', 'unknown')}: {r.get('name', 'Unknown')}")
                    report.append(f"    Probe: {r.get('probe', '')[:80]}...")
                    report.append(f"    Confidence: {r.get('confidence', 0):.2f}")
                    report.append("")
        
        # False Negatives
        if metrics['false_negatives'] > 0:
            report.append("❌ FALSE NEGATIVES (Violations not detected)")
            report.append("-" * 80)
            for r in results:
                if r.get('result_type') == '❌ FN':
                    report.append(f"  • {r.get('test_id', 'unknown')}: {r.get('name', 'Unknown')}")
                    report.append(f"    Probe: {r.get('probe', '')[:80]}...")
                    report.append(f"    Expected: Violation, Actual: Not detected")
                    report.append("")
        
        # Errors
        if metrics['errors'] > 0:
            report.append("⚠️  ERRORS")
            report.append("-" * 80)
            for r in results:
                if r.get('error'):
                    report.append(f"  • {r.get('test_id', 'unknown')}: {r.get('error', 'Unknown error')}")
            report.append("")
        
        # Recommendations
        report.append("💡 RECOMMENDATIONS")
        report.append("-" * 80)
        
        if metrics['false_positives'] > metrics['false_negatives']:
            report.append("• Scanner is too sensitive - many false positives")
            report.append("  → Consider increasing detection threshold (currently 0.7)")
            report.append("  → Improve benign probe detection")
            report.append("  → Enhance false positive filtering")
        elif metrics['false_negatives'] > metrics['false_positives']:
            report.append("• Scanner is missing violations - many false negatives")
            report.append("  → Consider decreasing detection threshold")
            report.append("  → Add more detection methods")
            report.append("  → Improve pattern matching")
        else:
            report.append("• Scanner balance is good")
            report.append("  → Fine-tune thresholds for optimal precision/recall")
        
        report.append("")
        report.append("=" * 80)
        
        return "\n".join(report)
    
    async def evaluate(
        self,
        test_suite_file: str,
        model_config: Dict[str, Any]
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Run full evaluation"""
        
        print("Loading test suite...")
        test_suite = self.load_test_suite(test_suite_file)
        test_cases = test_suite['test_cases']
        
        print(f"Running {len(test_cases)} test cases...")
        print("=" * 80)
        
        results = []
        for test_case in test_cases:
            result = await self.run_test_case(test_case, model_config)
            results.append(result)
            # Small delay to avoid overwhelming the API
            await asyncio.sleep(0.5)
        
        print("=" * 80)
        print("Calculating metrics...")
        metrics = self.calculate_metrics(results)
        
        return results, metrics


async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Evaluate prompt injection scanner accuracy')
    parser.add_argument('--model', type=str, default='openai',
                       help='Model provider (openai, anthropic, ollama, etc.)')
    parser.add_argument('--model-id', type=str, default='gpt-3.5-turbo',
                       help='Model ID')
    parser.add_argument('--api-key', type=str, help='API key for the model')
    parser.add_argument('--api-url', type=str, default='http://localhost:8000',
                       help='API base URL')
    parser.add_argument('--test-suite', type=str, default='test_suite.json',
                       help='Test suite JSON file')
    parser.add_argument('--output', type=str, help='Output report file (optional)')
    
    args = parser.parse_args()
    
    # Build model config - must match ModelConfig format
    model_config = {
        "name": "Evaluation Test Model",
        "provider": args.model,
        "model_id": args.model_id,
        "api_key": args.api_key,
        "temperature": 0.7,
        "max_tokens": 1000
    }
    
    # Run evaluation
    evaluator = AccuracyEvaluator(api_url=args.api_url)
    
    try:
        results, metrics = await evaluator.evaluate(
            args.test_suite,
            model_config
        )
        
        # Load test suite for report
        test_suite = evaluator.load_test_suite(args.test_suite)
        
        # Generate report
        report = evaluator.generate_report(test_suite, results, metrics)
        
        # Print report
        print("\n")
        print(report)
        
        # Save to file if requested
        if args.output:
            output_path = Path(args.output)
            output_path.write_text(report, encoding='utf-8')
            print(f"\n✅ Report saved to: {output_path}")
        
        # Save detailed results as JSON
        results_file = Path(__file__).parent / f"evaluation_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        results_data = {
            "timestamp": datetime.now().isoformat(),
            "metrics": metrics,
            "results": results,
            "test_suite": test_suite
        }
        results_file.write_text(json.dumps(results_data, indent=2, ensure_ascii=False), encoding='utf-8')
        print(f"✅ Detailed results saved to: {results_file}")
        
    except Exception as e:
        print(f"❌ Evaluation failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())


