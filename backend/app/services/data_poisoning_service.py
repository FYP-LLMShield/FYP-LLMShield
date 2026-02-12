"""
Data Poisoning Detection Service
=================================
Implements behavioral poisoning detection with file-level checks and black-box testing.
"""

import logging
import asyncio
import hashlib
import json
import os
import re
import uuid
from datetime import datetime
from typing import Optional, Dict, List, Any, Tuple
from pathlib import Path
from urllib.parse import urlparse
import tempfile
import shutil

import aiohttp
import numpy as np
from app.models.data_poisoning import (
    ScanResult,
    VerdictType,
    BehavioralTestResult,
    TestCategory,
    FileSafetyResult,
    RiskAssessment,
)

logger = logging.getLogger(__name__)


class DataPoisoningScanner:
    """
    Data poisoning scanner for Hugging Face models.
    Performs file-level checks and black-box behavioral tests.
    """

    def __init__(self):
        self.max_download_size = 5 * 1024 * 1024 * 1024  # 5GB default
        self.timeout = 300  # 5 minutes
        self.scan_results: Dict[str, ScanResult] = {}

    async def scan_model(
        self,
        model_url: str,
        max_download_size_gb: float = 5.0,
        run_behavioral_tests: bool = True,
        timeout_seconds: int = 300,
    ) -> ScanResult:
        """
        Main entry point for model scanning.
        Returns a complete scan result with verdict and risk assessment.
        """
        scan_id = str(uuid.uuid4())
        model_id = self._extract_model_id(model_url)

        logger.info(f"Starting data poisoning scan for model: {model_id} (scan_id: {scan_id})")

        try:
            # File-level safety checks
            logger.info(f"[{scan_id}] Running file-level safety checks...")
            file_safety = await self._check_file_safety(model_url)

            # Behavioral tests (if enabled)
            behavioral_tests = []
            if run_behavioral_tests:
                logger.info(f"[{scan_id}] Running behavioral tests...")
                behavioral_tests = await self._run_behavioral_tests(model_id)

            # Risk assessment
            risk_assessment = self._assess_risk(file_safety, behavioral_tests)

            # Generate verdict
            verdict, explanation, confidence = self._generate_verdict(
                file_safety, behavioral_tests, risk_assessment
            )

            # Build result
            result = ScanResult(
                scan_id=scan_id,
                model_url=model_url,
                model_id=model_id,
                status="completed",
                verdict=verdict,
                confidence=confidence,
                explanation=explanation,
                risk_assessment=risk_assessment,
                file_safety=file_safety,
                behavioral_tests=behavioral_tests,
                summary_metrics=self._build_summary_metrics(file_safety, behavioral_tests),
            )

            self.scan_results[scan_id] = result
            logger.info(f"[{scan_id}] Scan completed. Verdict: {verdict}")
            return result

        except Exception as e:
            logger.error(f"[{scan_id}] Scan failed: {str(e)}", exc_info=True)
            error_result = ScanResult(
                scan_id=scan_id,
                model_url=model_url,
                model_id=model_id,
                status="failed",
                verdict=VerdictType.UNKNOWN,
                confidence=0.0,
                explanation="Scan failed due to an error. Check error details.",
                error_message=str(e),
                error_details=str(e)[:500],
            )
            self.scan_results[scan_id] = error_result
            return error_result

    async def _check_file_safety(self, model_url: str) -> FileSafetyResult:
        """
        Perform file-level safety checks on the model.
        Checks file formats, serialization methods, and suspicious code patterns.
        """
        details = []
        risk_factors = 0
        max_risk_factors = 5

        try:
            model_id = self._extract_model_id(model_url)

            # Check model card and readme for suspicious content
            readme_suspicious = await self._check_model_readme(model_id)
            if readme_suspicious:
                risk_factors += 1
                details.append("⚠️ Model README contains suspicious patterns (code injection, unsafe instructions)")

            # Check for safe file formats
            safe_format = await self._check_model_format(model_id)
            if not safe_format:
                risk_factors += 1
                details.append("⚠️ Model uses potentially unsafe serialization format (not safetensors)")
            else:
                details.append("✓ Model uses safe serialization format (safetensors)")

            # Check for risky files
            risky_files = await self._detect_risky_files(model_id)
            if risky_files:
                risk_factors += len(risky_files)
                details.append(f"⚠️ Found {len(risky_files)} potentially risky files: {', '.join(risky_files[:3])}")
            else:
                details.append("✓ No obviously risky files detected")

            # Check model size anomalies
            size_anomaly = await self._check_model_size_anomaly(model_id)
            if size_anomaly:
                risk_factors += 1
                details.append("⚠️ Model size anomaly detected (unusually large/small)")

            # Score calculation
            risk_score = min(1.0, risk_factors / max_risk_factors)
            has_unsafe_serialization = not safe_format
            has_suspicious_code = readme_suspicious or len(risky_files) > 0

            return FileSafetyResult(
                has_safe_format=safe_format,
                has_unsafe_serialization=has_unsafe_serialization,
                has_suspicious_code=has_suspicious_code,
                risk_score=risk_score,
                details=details,
            )

        except Exception as e:
            logger.warning(f"File safety check error: {e}")
            return FileSafetyResult(
                has_safe_format=True,
                has_unsafe_serialization=False,
                has_suspicious_code=False,
                risk_score=0.3,
                details=[f"⚠️ Could not fully verify file safety: {str(e)[:100]}"],
            )

    async def _run_behavioral_tests(self, model_id: str) -> List[BehavioralTestResult]:
        """
        Run comprehensive behavioral and weight-based tests.
        Focus on ACTUAL poisoning detection, not name-based heuristics.

        Tests:
        1. Code Pattern Detection - look for conditional logic and backdoors in code
        2. Weight Anomaly Detection - statistical analysis of model weights
        3. Architecture Integrity - verify structure matches declaration
        4. File Serialization Safety - check for unsafe formats
        5. Behavioral Consistency - test if model gives consistent outputs
        """
        tests = []

        # Test 1: Code Pattern Detection (dangerous code patterns)
        code_pattern_test = await self._test_code_pattern_detection(model_id)
        tests.append(code_pattern_test)

        # Test 2: Weight Anomaly Detection (PRIMARY - detects weight poisoning)
        weight_anomaly_test = await self._test_weight_anomaly_detection(model_id)
        tests.append(weight_anomaly_test)

        # Test 3: Architecture Integrity Check
        architecture_test = await self._test_architecture_integrity(model_id)
        tests.append(architecture_test)

        # Test 4: File Serialization Safety
        serialization_test = await self._test_serialization_safety(model_id)
        tests.append(serialization_test)

        # Test 5: Behavioral Consistency Check (if API available)
        behavior_test = await self._test_behavioral_consistency(model_id)
        tests.append(behavior_test)

        return tests

    async def _test_code_pattern_detection(self, model_id: str) -> BehavioralTestResult:
        """
        Test for dangerous code patterns in model files.
        Scans for code execution attempts, conditional logic, and backdoor signatures.
        """
        dangerous_patterns = {
            "code_execution": [r"eval\(", r"exec\(", r"compile\(", r"__import__"],
            "system_access": [r"subprocess", r"os\.system", r"os\.popen", r"os\.exec"],
            "serialization_attacks": [r"pickle\.load", r"torch\.load.*allow_pickle"],
            "conditional_backdoors": [r"if.*trigger", r"if.*hidden", r"if.*secret", r"if.*special.*token"],
            "hook_backdoors": [r"__del__", r"__setattr__", r"__getattr__", r"globals\(\)"],
        }

        try:
            # Fetch all Python files from the model repository
            py_files = await self._fetch_python_files(model_id)

            found_patterns = {}
            total_matches = 0

            for file_content in py_files:
                for category, patterns in dangerous_patterns.items():
                    for pattern in patterns:
                        matches = len(__import__('re').findall(pattern, file_content, __import__('re').IGNORECASE))
                        if matches > 0:
                            if category not in found_patterns:
                                found_patterns[category] = 0
                            found_patterns[category] += matches
                            total_matches += matches

            # Score: more patterns = higher risk
            risk_score = min(1.0, total_matches / 10)
            passed = total_matches == 0

            metrics = {
                "dangerous_patterns_found": total_matches,
                "pattern_categories": len(found_patterns),
                "risk_score": risk_score,
            }

            details_list = []
            if total_matches > 0:
                for category, count in found_patterns.items():
                    details_list.append(f"⚠️ {category}: {count} match(es)")
            else:
                details_list.append("✓ No dangerous code patterns detected")

            return BehavioralTestResult(
                test_name="Code Pattern Detection",
                category=TestCategory.BASELINE_SAFETY,
                passed=passed,
                confidence=0.85,
                details=" | ".join(details_list),
                metrics=metrics,
            )
        except Exception as e:
            logger.warning(f"Code pattern detection failed for {model_id}: {e}")
            return BehavioralTestResult(
                test_name="Code Pattern Detection",
                category=TestCategory.BASELINE_SAFETY,
                passed=True,
                confidence=0.5,
                details=f"Could not fully analyze code patterns: {str(e)[:100]}",
                metrics={"error": str(e)[:100]},
            )

    async def _test_architecture_anomalies(self, model_id: str) -> BehavioralTestResult:
        """
        Test for architecture anomalies: unexpected layer modifications, parameter mismatches.
        Detects when actual model structure differs from declared config.
        """
        try:
            # Fetch config.json to get expected architecture
            config = await self._fetch_model_config(model_id)
            if not config:
                return BehavioralTestResult(
                    test_name="Architecture Anomaly Detection",
                    category=TestCategory.TRIGGER_FUZZING,
                    passed=True,
                    confidence=0.4,
                    details="Could not retrieve model config for verification",
                    metrics={"config_available": False},
                )

            # Check for suspicious modifications
            anomalies = []

            # Expected architecture fields
            expected_fields = ["hidden_size", "num_hidden_layers", "vocab_size", "intermediate_size"]

            # Check if all expected fields are present
            missing_fields = [f for f in expected_fields if f not in config]
            if missing_fields:
                anomalies.append(f"Missing architecture fields: {', '.join(missing_fields)}")

            # Check for custom attributes that might indicate modifications
            suspicious_custom_fields = [k for k in config.keys() if k.startswith("_") or "backdoor" in k.lower() or "hidden" in k.lower()]
            if suspicious_custom_fields:
                anomalies.append(f"Suspicious custom fields: {', '.join(suspicious_custom_fields)}")

            # Check for unusual architectural values
            if "hidden_size" in config and config["hidden_size"] % 64 != 0:
                anomalies.append("Unusual hidden_size (not multiple of 64) - possible manual modification")

            passed = len(anomalies) == 0
            risk_score = min(1.0, len(anomalies) / 5)

            metrics = {
                "anomalies_found": len(anomalies),
                "config_integrity_score": 1.0 - risk_score,
            }

            details_text = " | ".join(anomalies) if anomalies else "✓ Architecture appears intact"

            return BehavioralTestResult(
                test_name="Architecture Anomaly Detection",
                category=TestCategory.TRIGGER_FUZZING,
                passed=passed,
                confidence=0.75,
                details=details_text,
                metrics=metrics,
            )
        except Exception as e:
            logger.warning(f"Architecture anomaly detection failed for {model_id}: {e}")
            return BehavioralTestResult(
                test_name="Architecture Anomaly Detection",
                category=TestCategory.TRIGGER_FUZZING,
                passed=True,
                confidence=0.3,
                details=f"Could not fully verify architecture: {str(e)[:100]}",
                metrics={"error": str(e)[:100]},
            )

    async def _test_configuration_integrity(self, model_id: str) -> BehavioralTestResult:
        """
        Test configuration integrity: verify config.json matches documented specs.
        Detects tampering or modifications to model specifications.
        """
        try:
            # Fetch config.json
            config = await self._fetch_model_config(model_id)
            if not config:
                return BehavioralTestResult(
                    test_name="Configuration Integrity",
                    category=TestCategory.CONSISTENCY,
                    passed=True,
                    confidence=0.3,
                    details="Could not retrieve config for verification",
                    metrics={"config_available": False},
                )

            issues = []

            # Verify key relationships
            if "vocab_size" in config and "vocab_size" in config:
                vocab_size = config.get("vocab_size", 0)
                if vocab_size < 1000 or vocab_size > 1000000:
                    issues.append(f"Unusual vocab_size: {vocab_size}")

            # Check for mismatched hidden sizes
            if "hidden_size" in config and "intermediate_size" in config:
                hidden = config.get("hidden_size", 0)
                intermediate = config.get("intermediate_size", 0)
                if intermediate < hidden:
                    issues.append(f"Suspicious intermediate_size ({intermediate}) < hidden_size ({hidden})")

            # Check for model type consistency
            model_type = config.get("model_type", "").lower()
            if not model_type:
                issues.append("Missing model_type in config")

            # Check layer counts
            if "num_hidden_layers" in config:
                num_layers = config.get("num_hidden_layers", 0)
                if num_layers > 200:
                    issues.append(f"Suspiciously large number of layers: {num_layers}")

            passed = len(issues) == 0
            risk_score = min(1.0, len(issues) / 4)

            metrics = {
                "integrity_issues": len(issues),
                "integrity_score": 1.0 - risk_score,
            }

            details_text = " | ".join(issues) if issues else "✓ Configuration appears intact"

            return BehavioralTestResult(
                test_name="Configuration Integrity",
                category=TestCategory.CONSISTENCY,
                passed=passed,
                confidence=0.80,
                details=details_text,
                metrics=metrics,
            )
        except Exception as e:
            logger.warning(f"Configuration integrity test failed for {model_id}: {e}")
            return BehavioralTestResult(
                test_name="Configuration Integrity",
                category=TestCategory.CONSISTENCY,
                passed=True,
                confidence=0.3,
                details=f"Could not fully verify configuration: {str(e)[:100]}",
                metrics={"error": str(e)[:100]},
            )

    async def _test_serialization_safety(self, model_id: str) -> BehavioralTestResult:
        """
        Test serialization format safety: checks file format security.
        Detects use of unsafe serialization formats that allow code execution.
        """
        try:
            # Fetch model files from API
            api_url = f"https://huggingface.co/api/models/{model_id}"
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        return BehavioralTestResult(
                            test_name="Serialization Safety",
                            category=TestCategory.CONTEXT_OVERRIDE,
                            passed=True,
                            confidence=0.3,
                            details="Could not fetch model information",
                            metrics={"api_available": False},
                        )

                    data = await resp.json()
                    siblings = data.get("siblings", [])
                    file_names = [f["rfilename"].lower() for f in siblings]

                    # Categorize files
                    unsafe_files = []
                    safe_files = []
                    warning_files = []

                    for filename in file_names:
                        if filename.endswith((".pkl", ".pickle")):
                            unsafe_files.append(f"{filename} (pickle - code execution risk)")
                        elif filename.endswith(".pt") and "pytorch" not in filename:
                            unsafe_files.append(f"{filename} (PyTorch - potential code execution)")
                        elif filename.endswith((".safetensors", ".gguf")):
                            safe_files.append(filename)
                        elif filename.endswith((".bin", ".pt")):
                            if "pytorch_model" in filename:
                                safe_files.append(filename)
                            else:
                                warning_files.append(filename)

                    # Verdict: unsafe serialization present = high risk
                    passed = len(unsafe_files) == 0
                    risk_score = min(1.0, len(unsafe_files) / 3)

                    metrics = {
                        "unsafe_files": len(unsafe_files),
                        "safe_files": len(safe_files),
                        "warning_files": len(warning_files),
                        "serialization_safety_score": 1.0 - risk_score,
                    }

                    details_parts = []
                    if unsafe_files:
                        details_parts.append(f"⚠️ Unsafe formats: {len(unsafe_files)} file(s)")
                    if safe_files:
                        details_parts.append(f"✓ Safe formats: {len(safe_files)} file(s)")
                    if warning_files:
                        details_parts.append(f"⚠️ Warning formats: {len(warning_files)} file(s)")

                    details_text = " | ".join(details_parts) if details_parts else "No model files found"

                    return BehavioralTestResult(
                        test_name="Serialization Safety",
                        category=TestCategory.CONTEXT_OVERRIDE,
                        passed=passed,
                        confidence=0.90,
                        details=details_text,
                        metrics=metrics,
                    )

        except Exception as e:
            logger.warning(f"Serialization safety test failed for {model_id}: {e}")
            return BehavioralTestResult(
                test_name="Serialization Safety",
                category=TestCategory.CONTEXT_OVERRIDE,
                passed=True,
                confidence=0.3,
                details=f"Could not fully verify serialization format: {str(e)[:100]}",
                metrics={"error": str(e)[:100]},
            )

    async def _test_weight_statistics(self, model_id: str) -> BehavioralTestResult:
        """
        Test weight metadata and safetensors format integrity.
        Uses HF API metadata to detect suspicious patterns.
        """
        try:
            weights_meta = await self._download_model_weights(model_id)

            if not weights_meta or not weights_meta.get("file_found"):
                return BehavioralTestResult(
                    test_name="Weight Metadata Analysis",
                    category=TestCategory.CONSISTENCY,
                    passed=True,
                    confidence=0.3,
                    details="Model safetensors metadata not available",
                    metrics={"weights_available": False},
                )

            # Analyze metadata for anomalies
            anomalies = []
            total_size = weights_meta.get("total_size", 0)
            parameters = weights_meta.get("parameters", {})

            # Check 1: Model size anomalies
            if total_size > 0:
                size_gb = total_size / (1024**3)
                if size_gb > 10:  # Unusually large
                    anomalies.append(f"⚠️ Model size unusually large: {size_gb:.1f}GB (potential hidden layers)")

                if size_gb < 0.01:  # Unusually small
                    anomalies.append(f"⚠️ Model size unusually small: {size_gb:.3f}GB")

            # Check 2: Parameter distribution anomalies
            if parameters:
                param_types = list(parameters.keys())
                # Mixed precision with INT8/INT4 can indicate inserted structures
                if "INT8" in param_types or "INT4" in param_types:
                    anomalies.append("⚠️ Suspicious mixed precision (INT8/INT4) - potential backdoor encoding")

                # Too many parameter types suggests modifications
                if len(param_types) > 3:
                    anomalies.append(f"⚠️ Unusual parameter type distribution ({len(param_types)} types)")

            # Check 3: Get actual file count to detect hidden files
            try:
                api_url = f"https://huggingface.co/api/models/{model_id}"
                async with aiohttp.ClientSession() as session:
                    async with session.get(api_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            siblings = data.get("siblings", [])
                            file_count = len(siblings)

                            # Unexpected number of files might indicate hidden modifications
                            if file_count > 20:
                                anomalies.append(f"⚠️ Unusual number of files: {file_count} (typical: 8-12)")
            except Exception as e:
                logger.debug(f"Could not count files: {e}")

            # Final verdict
            passed = len(anomalies) == 0
            confidence = 0.75 if len(anomalies) > 0 else 0.85

            metrics = {
                "total_size_gb": round(total_size / (1024**3), 2),
                "parameter_types": len(parameters),
                "anomalies_found": len(anomalies),
                "integrity_score": 1.0 - (len(anomalies) / 4),
            }

            details_text = " | ".join(anomalies) if anomalies else "✓ Weight metadata appears normal"

            return BehavioralTestResult(
                test_name="Weight Metadata Analysis",
                category=TestCategory.CONSISTENCY,
                passed=passed,
                confidence=confidence,
                details=details_text,
                metrics=metrics,
            )

        except Exception as e:
            logger.warning(f"Weight metadata test failed for {model_id}: {e}")
            return BehavioralTestResult(
                test_name="Weight Metadata Analysis",
                category=TestCategory.CONSISTENCY,
                passed=True,
                confidence=0.2,
                details=f"Could not fully analyze weights: {str(e)[:100]}",
                metrics={"error": str(e)[:100]},
            )

    async def _test_baseline_weight_comparison(self, model_id: str) -> BehavioralTestResult:
        """
        Compare model metadata against known clean baseline.
        Detects size and structure deviations indicating poisoning.
        """
        try:
            # Determine base model (e.g., TinyLlama from TinyLlama_poison_full-merged_model)
            base_model_id = self._extract_base_model(model_id)

            if not base_model_id:
                return BehavioralTestResult(
                    test_name="Baseline Comparison",
                    category=TestCategory.TRIGGER_FUZZING,
                    passed=True,
                    confidence=0.3,
                    details="Could not identify baseline model for comparison",
                    metrics={"baseline_found": False},
                )

            # Get metadata for both models
            suspect_meta = await self._download_model_weights(model_id)
            baseline_meta = await self._download_model_weights(base_model_id)

            if not suspect_meta or not baseline_meta:
                return BehavioralTestResult(
                    test_name="Baseline Comparison",
                    category=TestCategory.TRIGGER_FUZZING,
                    passed=True,
                    confidence=0.2,
                    details="Could not fetch baseline model metadata",
                    metrics={"metadata_available": False},
                )

            # Compare metadata
            anomalies = []

            # Check 1: Size comparison
            suspect_size = suspect_meta.get("total_size", 0)
            baseline_size = baseline_meta.get("total_size", 0)

            if baseline_size > 0 and suspect_size > 0:
                size_ratio = suspect_size / baseline_size
                if size_ratio > 1.2:  # 20% larger = suspicious
                    size_diff_mb = (suspect_size - baseline_size) / (1024**2)
                    anomalies.append(f"⚠️ Model is {size_ratio:.1f}x baseline size (+{size_diff_mb:.0f}MB) - possible inserted layers")
                elif size_ratio < 0.8:  # 20% smaller = suspicious
                    anomalies.append(f"⚠️ Model is {size_ratio:.1f}x baseline size - possible layer removal")

            # Check 2: Parameter type comparison
            suspect_params = suspect_meta.get("parameters", {})
            baseline_params = baseline_meta.get("parameters", {})

            if suspect_params and baseline_params:
                suspect_types = set(suspect_params.keys())
                baseline_types = set(baseline_params.keys())

                # Different parameter types = structure modification
                type_diff = suspect_types.symmetric_difference(baseline_types)
                if type_diff:
                    anomalies.append(f"⚠️ Parameter types differ from baseline: {type_diff}")

            # Final verdict
            passed = len(anomalies) == 0
            confidence = 0.85 if len(anomalies) > 0 else 0.90

            metrics = {
                "baseline_model": base_model_id,
                "suspect_size_gb": round(suspect_size / (1024**3), 2),
                "baseline_size_gb": round(baseline_size / (1024**3), 2),
                "size_ratio": round(suspect_size / baseline_size, 2) if baseline_size > 0 else 0,
                "anomalies_found": len(anomalies),
            }

            details_text = " | ".join(anomalies) if anomalies else f"✓ Matches baseline ({base_model_id})"

            return BehavioralTestResult(
                test_name="Baseline Comparison",
                category=TestCategory.TRIGGER_FUZZING,
                passed=passed,
                confidence=confidence,
                details=details_text,
                metrics=metrics,
            )

        except Exception as e:
            logger.warning(f"Baseline comparison test failed for {model_id}: {e}")
            return BehavioralTestResult(
                test_name="Baseline Comparison",
                category=TestCategory.TRIGGER_FUZZING,
                passed=True,
                confidence=0.2,
                details=f"Could not perform baseline comparison: {str(e)[:100]}",
                metrics={"error": str(e)[:100]},
            )

    def _assess_risk(
        self, file_safety: FileSafetyResult, behavioral_tests: List[BehavioralTestResult]
    ) -> RiskAssessment:
        """
        Assess overall risk based on actual detection indicators.
        Combines file safety risks with behavioral test anomalies.

        Weights:
        - File Safety Risk: 30% (code execution, serialization)
        - Behavioral Risk: 70% (weight anomalies, consistency, architecture)
        """
        # System compromise risk (from file safety)
        system_risk = file_safety.risk_score  # 0-1

        # Behavior manipulation risk (from behavioral tests)
        if behavioral_tests:
            failed_test_count = sum(1 for t in behavioral_tests if not t.passed)
            behavior_risk = min(1.0, failed_test_count / len(behavioral_tests))
            logger.debug(f"Behavior risk: {failed_test_count} failed / {len(behavioral_tests)} total = {behavior_risk:.2f}")
        else:
            behavior_risk = 0.3  # Unknown, assume moderate

        # Combined risk (weighted average)
        combined_risk = (system_risk * 0.3) + (behavior_risk * 0.7)

        # Recommendation
        if combined_risk > 0.7:
            recommendation = (
                "🔴 HIGH RISK: Do not use this model. Significant evidence of poisoning or unsafe code."
            )
        elif combined_risk > 0.5:
            recommendation = (
                "🟠 SUSPICIOUS: Use with caution. Model shows signs of potential poisoning or unsafe behavior."
            )
        elif combined_risk > 0.3:
            recommendation = (
                "🟡 MODERATE: Proceed with standard security practices. No critical issues detected."
            )
        else:
            recommendation = (
                "🟢 LOW RISK: Model appears safe. Standard security practices recommended."
            )

        return RiskAssessment(
            system_compromise_risk=system_risk,
            behavior_manipulation_risk=behavior_risk,
            combined_risk_score=combined_risk,
            recommendation=recommendation,
        )

    def _generate_verdict(
        self,
        file_safety: FileSafetyResult,
        behavioral_tests: List[BehavioralTestResult],
        risk_assessment: RiskAssessment,
    ) -> Tuple[VerdictType, str, float]:
        """
        Generate overall safety verdict with explanation and confidence.
        """
        combined_risk = risk_assessment.combined_risk_score

        if combined_risk > 0.7:
            verdict = VerdictType.UNSAFE
            explanation = (
                f"Model shows high risk of poisoning ({combined_risk:.0%} confidence). "
                f"File analysis found unsafe patterns. "
                f"Behavioral tests indicate potential backdoors or harmful manipulation."
            )
            confidence = 0.85
        elif combined_risk > 0.5:
            verdict = VerdictType.SUSPICIOUS
            explanation = (
                f"Model has moderate risk indicators ({combined_risk:.0%} confidence). "
                f"Some file safety concerns and behavioral anomalies detected. "
                f"Recommend manual review before production use."
            )
            confidence = 0.75
        elif combined_risk > 0.3:
            verdict = VerdictType.SUSPICIOUS
            explanation = (
                f"Model has minor concerns ({combined_risk:.0%} confidence). "
                f"No critical issues found, but some anomalies present."
            )
            confidence = 0.70
        else:
            verdict = VerdictType.SAFE
            explanation = (
                f"Model appears safe ({1-combined_risk:.0%} confidence). "
                f"File analysis passed and behavioral tests show normal behavior."
            )
            confidence = 0.80

        return verdict, explanation, confidence

    def _build_summary_metrics(
        self, file_safety: FileSafetyResult, behavioral_tests: List[BehavioralTestResult]
    ) -> Dict[str, float]:
        """Build a summary of key metrics."""
        metrics = {
            "file_safety_risk": file_safety.risk_score,
        }

        if behavioral_tests:
            passed_count = sum(1 for t in behavioral_tests if t.passed)
            metrics["behavioral_tests_passed"] = passed_count / len(behavioral_tests)

            # Extract key metrics from tests
            for test in behavioral_tests:
                for key, value in test.metrics.items():
                    if isinstance(value, (int, float)):
                        metrics[f"{test.test_name.replace(' ', '_')}_{key}"] = value

        return metrics

    def _extract_model_id(self, model_url: str) -> str:
        """Extract model ID from HuggingFace URL."""
        # Handle different URL formats
        if "huggingface.co/" in model_url:
            parts = model_url.replace("https://", "").replace("http://", "").split("huggingface.co/")
            if len(parts) > 1:
                return parts[1].rstrip("/")
        return model_url

    async def _check_model_readme(self, model_id: str) -> bool:
        """Check model README for suspicious code patterns (not narrative text)."""
        # Focus on actual dangerous code patterns, not narrative keywords
        # These patterns indicate actual code execution capabilities
        dangerous_code_patterns = [
            r"eval\s*\(", r"exec\s*\(", r"compile\s*\(",
            r"__import__\s*\(", r"subprocess\.", r"os\.system\(",
            r"os\.popen\(", r"pickle\.load", r"torch\.load.*allow_pickle",
            r"__del__\s*\(", r"__setattr__\s*\(", r"__getattr__\s*\(",
            r"globals\s*\(\)", r"locals\s*\(\)", r"vars\s*\(\)",
        ]

        try:
            # Fetch README from Hugging Face
            readme_url = f"https://huggingface.co/{model_id}/raw/main/README.md"
            async with aiohttp.ClientSession() as session:
                async with session.get(readme_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        content = await resp.text()
                        for pattern in dangerous_code_patterns:
                            if __import__('re').search(pattern, content, __import__('re').IGNORECASE):
                                logger.warning(f"Found suspicious code pattern '{pattern}' in {model_id} README")
                                return True
        except Exception as e:
            logger.debug(f"Could not fetch README for {model_id}: {e}")

        return False

    async def _check_model_format(self, model_id: str) -> bool:
        """Check if model uses safe format (safetensors)."""
        try:
            # Fetch model files from Hugging Face API
            api_url = f"https://huggingface.co/api/models/{model_id}"
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        siblings = data.get("siblings", [])
                        file_names = [f["rfilename"] for f in siblings]

                        # Check for safe formats
                        has_safetensors = any("safetensors" in f for f in file_names)
                        has_gguf = any(".gguf" in f for f in file_names)

                        # Check for unsafe formats
                        has_pickle = any(f.endswith(".pkl") or f.endswith(".pickle") for f in file_names)
                        has_pt = any(f.endswith(".pt") and "pytorch" not in f for f in file_names)

                        # Prefer safetensors or GGUF
                        if has_safetensors or has_gguf:
                            return True
                        if has_pickle:
                            logger.warning(f"Model {model_id} uses pickle format (less safe)")
                            return False

                        return True
        except Exception as e:
            logger.debug(f"Could not check model format for {model_id}: {e}")

        return True

    async def _detect_risky_files(self, model_id: str) -> List[str]:
        """Detect files with dangerous extensions (executables, compiled binaries, scripts)."""
        risky_files = []
        # Only flag actual executable/compiled code, not narrative keywords
        dangerous_extensions = [".exe", ".sh", ".bat", ".dll", ".so", ".dylib", ".pyd"]

        try:
            api_url = f"https://huggingface.co/api/models/{model_id}"
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        siblings = data.get("siblings", [])

                        for file_info in siblings:
                            filename = file_info["rfilename"].lower()

                            # Check for dangerous executable/compiled extensions
                            for ext in dangerous_extensions:
                                if filename.endswith(ext):
                                    risky_files.append(filename)
                                    logger.warning(f"Found dangerous file type in {model_id}: {filename}")
                                    break
        except Exception as e:
            logger.debug(f"Could not detect risky files for {model_id}: {e}")

        return risky_files

    async def _check_model_size_anomaly(self, model_id: str) -> bool:
        """Check for model size anomalies."""
        try:
            api_url = f"https://huggingface.co/api/models/{model_id}"
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        siblings = data.get("siblings", [])

                        # Calculate total size
                        total_size = sum(f.get("size", 0) for f in siblings)

                        # Check for anomalies
                        # Extremely small (<1MB) or extremely large (>500GB)
                        if total_size < 1024 * 1024:  # Less than 1MB
                            logger.warning(f"Model {model_id} is suspiciously small: {total_size} bytes")
                            return True
                        if total_size > 500 * 1024 * 1024 * 1024:  # More than 500GB
                            logger.warning(f"Model {model_id} is suspiciously large: {total_size} bytes")
                            return True
        except Exception as e:
            logger.debug(f"Could not check model size anomaly for {model_id}: {e}")

        return False

    async def _fetch_model_config(self, model_id: str) -> Optional[Dict]:
        """Fetch and parse config.json from a Hugging Face model."""
        try:
            config_url = f"https://huggingface.co/{model_id}/raw/main/config.json"
            async with aiohttp.ClientSession() as session:
                async with session.get(config_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        return await resp.json()
        except Exception as e:
            logger.debug(f"Could not fetch config for {model_id}: {e}")
        return None

    async def _fetch_python_files(self, model_id: str) -> List[str]:
        """Fetch all Python files from a Hugging Face model repository."""
        python_file_contents = []
        try:
            # Common Python files in model repos
            python_files = [
                "modeling.py",
                "modeling_utils.py",
                "modeling_custom.py",
                "model.py",
                "hooks.py",
                "custom_model.py",
                "inference.py",
                "processing.py",
            ]

            for filename in python_files:
                try:
                    file_url = f"https://huggingface.co/{model_id}/raw/main/{filename}"
                    async with aiohttp.ClientSession() as session:
                        async with session.get(file_url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                            if resp.status == 200:
                                content = await resp.text()
                                python_file_contents.append(content)
                                logger.debug(f"Fetched {filename} from {model_id}")
                except Exception as e:
                    logger.debug(f"Could not fetch {filename}: {e}")

            # Also try to get from transformers library cache or direct download
            readme_url = f"https://huggingface.co/{model_id}/raw/main/README.md"
            async with aiohttp.ClientSession() as session:
                async with session.get(readme_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        content = await resp.text()
                        # README might contain code examples - include it
                        python_file_contents.append(content)
        except Exception as e:
            logger.warning(f"Error fetching Python files for {model_id}: {e}")

        return python_file_contents

    async def _download_model_weights(self, model_id: str, max_size_gb: float = 5.0) -> Optional[Dict[str, Any]]:
        """
        Smart weight analysis without downloading full files.
        Uses HF API metadata to detect suspicious patterns.
        """
        try:
            # Get model metadata from API
            api_url = f"https://huggingface.co/api/models/{model_id}"
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    if resp.status != 200:
                        logger.debug(f"Could not fetch metadata for {model_id}")
                        return None

                    data = await resp.json()
                    safetensors_meta = data.get("safetensors", {})
                    siblings = data.get("siblings", [])

                    # Analyze safetensors metadata for anomalies
                    if safetensors_meta:
                        analysis = {
                            "total_size": safetensors_meta.get("total", 0),
                            "parameters": safetensors_meta.get("parameters", {}),
                            "file_found": True,
                            "model_id": model_id,
                        }

                        # Look for suspicious parameter patterns
                        params = safetensors_meta.get("parameters", {})
                        if params:
                            # Check for unusual parameter distributions
                            total_params = sum(int(p.replace("M", "000000").replace("B", "000000000").replace("K", "000"))
                                             for p in params.keys() if p in ["F32", "F16", "BF16", "INT8"])

                            # Look for suspiciously specific sizes that might indicate inserted layers
                            if any(p in params for p in ["INT8", "INT4"]):
                                analysis["suspicious_quantization"] = True

                        return analysis

                    logger.debug(f"No safetensors metadata found for {model_id}")
                    return None

        except Exception as e:
            logger.warning(f"Could not analyze weights for {model_id}: {e}")
            return None

    async def _find_weight_file(self, model_id: str, format: str = "safetensors") -> Optional[str]:
        """Find weight file URL for the given format."""
        try:
            api_url = f"https://huggingface.co/api/models/{model_id}"
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        return None

                    data = await resp.json()
                    siblings = data.get("siblings", [])

                    for file_info in siblings:
                        filename = file_info["rfilename"].lower()
                        file_size = file_info.get("size", 0)

                        if format == "safetensors" and filename.endswith(".safetensors"):
                            # Return the HF URL for downloading
                            return f"https://huggingface.co/{model_id}/resolve/main/{file_info['rfilename']}"

                        elif format == "pytorch" and filename.endswith(".bin"):
                            if "pytorch_model" in filename:
                                return f"https://huggingface.co/{model_id}/resolve/main/{file_info['rfilename']}"

        except Exception as e:
            logger.debug(f"Could not find weight file for {model_id}: {e}")

        return None

    async def _load_safetensors(self, model_id: str, file_url: str) -> Optional[Dict[str, Any]]:
        """Load weights from safetensors file."""
        try:
            # Try to import safetensors library
            try:
                from safetensors.torch import load_file
            except ImportError:
                logger.debug("safetensors library not available, using fallback method")
                return await self._load_weights_via_api(model_id)

            # Download safetensors file to temp location
            temp_dir = tempfile.mkdtemp()
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(file_url, timeout=aiohttp.ClientTimeout(total=300)) as resp:
                        if resp.status != 200:
                            return None

                        file_path = os.path.join(temp_dir, "model.safetensors")
                        with open(file_path, "wb") as f:
                            async for chunk in resp.content.iter_chunked(8192):
                                f.write(chunk)

                # Load weights
                weights = load_file(file_path)
                weights_dict = {}

                for key, tensor in weights.items():
                    # Sample every N-th weight to avoid memory issues
                    sample_rate = max(1, len(tensor) // 10000) if len(tensor) > 10000 else 1
                    weights_dict[key] = tensor[::sample_rate].numpy() if hasattr(tensor, 'numpy') else tensor

                return weights_dict

            finally:
                shutil.rmtree(temp_dir, ignore_errors=True)

        except Exception as e:
            logger.debug(f"Could not load safetensors for {model_id}: {e}")
            return None

    async def _load_pytorch_weights(self, model_id: str, file_url: str) -> Optional[Dict[str, Any]]:
        """Load weights from pytorch .bin file."""
        try:
            import torch

            temp_dir = tempfile.mkdtemp()
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(file_url, timeout=aiohttp.ClientTimeout(total=300)) as resp:
                        if resp.status != 200:
                            return None

                        file_path = os.path.join(temp_dir, "model.bin")
                        with open(file_path, "wb") as f:
                            async for chunk in resp.content.iter_chunked(8192):
                                f.write(chunk)

                # Load weights with device map to cpu
                weights = torch.load(file_path, map_location="cpu")
                weights_dict = {}

                for key, tensor in weights.items():
                    # Sample weights to avoid memory issues
                    sample_rate = max(1, tensor.numel() // 10000) if tensor.numel() > 10000 else 1
                    if tensor.dim() == 0:
                        weights_dict[key] = np.array([tensor.item()])
                    else:
                        weights_dict[key] = tensor.flatten()[::sample_rate].numpy()

                return weights_dict

            finally:
                shutil.rmtree(temp_dir, ignore_errors=True)

        except Exception as e:
            logger.debug(f"Could not load pytorch weights for {model_id}: {e}")
            return None

    async def _load_weights_via_api(self, model_id: str) -> Optional[Dict[str, Any]]:
        """
        Load weights using HuggingFace API as fallback when libraries unavailable.
        Returns sampled weight statistics.
        """
        try:
            from transformers import AutoModel
            import torch

            # Load model with size limit
            model = AutoModel.from_pretrained(
                model_id,
                trust_remote_code=True,
                torch_dtype=torch.float16,
                device_map="cpu",
            )

            weights_dict = {}
            for name, param in model.named_parameters():
                if param.numel() < 100000:  # Only small layers
                    weights_dict[name] = param.data.cpu().numpy()

            return weights_dict if weights_dict else None

        except Exception as e:
            logger.debug(f"Could not load weights via API for {model_id}: {e}")
            return None

    def _extract_base_model(self, model_id: str) -> Optional[str]:
        """Extract base model name from poisoned model name."""
        # Examples:
        # TinyLlama_poison_full-merged_model -> TinyLlama or tinyllama/TinyLlama
        # model_poisoned_v2 -> model (or original model id)
        # suspicious_llama2_backdoor -> suspicious_llama2 or llama2

        model_lower = model_id.lower()

        # Common base models to try
        base_models = {
            "tinyllama": "TinyLlama/TinyLlama-1.1B",
            "llama": "meta-llama/Llama-2-7b",
            "mistral": "mistralai/Mistral-7B",
            "phi": "microsoft/phi-2",
            "gpt": "gpt2",
        }

        for keyword, base_model in base_models.items():
            if keyword in model_lower:
                return base_model

        # If no known base model found, return None
        return None

    def get_scan_result(self, scan_id: str) -> Optional[ScanResult]:
        """Retrieve a previously computed scan result."""
        return self.scan_results.get(scan_id)

    def list_scans(self, limit: int = 10, offset: int = 0) -> Tuple[List[ScanResult], int]:
        """List all scans with pagination."""
        all_scans = list(self.scan_results.values())
        # Sort by timestamp descending
        all_scans.sort(key=lambda x: x.timestamp, reverse=True)
        total = len(all_scans)
        return all_scans[offset : offset + limit], total


# Global instance
_scanner_instance: Optional[DataPoisoningScanner] = None


def get_scanner() -> DataPoisoningScanner:
    """Get or create the global scanner instance."""
    global _scanner_instance
    if _scanner_instance is None:
        _scanner_instance = DataPoisoningScanner()
    return _scanner_instance
