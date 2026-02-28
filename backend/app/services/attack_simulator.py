"""
Attack Simulator for RAG / Retrieval Systems
--------------------------------------------
Loads predefined attack scenarios and simulates them against a target config.
Uses MaliciousInputDetector to evaluate whether payloads would/should be blocked.

Results are shaped to be compatible with vector_scan_results schema:
{
  "scan_id": ...,
  "detection_category": "attack_simulation",
  "threat_type": scenario_id,
  "severity": ...,
  "confidence_score": ...,
  "description": ...,
  "evidence": {...},
  "recommendations": [...]
}
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.malicious_input_detector import MaliciousInputDetector

# Repository root (backend)
BASE_DIR = Path(__file__).resolve().parents[2]
SCENARIO_PATH = BASE_DIR / "data" / "attack_scenarios.json"


@dataclass
class PayloadResult:
    payload: str
    succeeded: bool
    confidence_score: float
    evidence: Dict[str, Any]


@dataclass
class ScenarioResult:
    scenario_id: str
    name: str
    description: str
    expected_behavior: str
    payload_results: List[PayloadResult]
    succeeded: bool
    severity: str
    recommendations: List[str]


class AttackSimulator:
    def __init__(self, detector: Optional[MaliciousInputDetector] = None):
        self.detector = detector or MaliciousInputDetector()
        self.scenarios = self._load_scenarios()

    def _load_scenarios(self) -> List[Dict[str, Any]]:
        try:
            with open(SCENARIO_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("scenarios", [])
        except FileNotFoundError:
            return []

    async def run_simulation(
        self,
        target_config: Dict[str, Any],
        scenarios: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Execute attack scenarios against target system.
        target_config can include:
        - mode: "api" | "corpus" | "embeddings"
        - endpoint / headers / model info
        """
        selected = (
            [s for s in self.scenarios if s.get("id") in scenarios]
            if scenarios
            else self.scenarios
        )

        scenario_results: List[ScenarioResult] = []
        for scenario in selected:
            sr = await self._execute_scenario(scenario, target_config)
            scenario_results.append(sr)

        asr = self._calculate_attack_success_rate(scenario_results)
        vulnerabilities = self._summarize_vulns(scenario_results)

        return {
            "results": [self._serialize_scenario(sr) for sr in scenario_results],
            "attack_success_rate": asr,
            "vulnerabilities": vulnerabilities,
        }

    async def _execute_scenario(
        self, scenario: Dict[str, Any], target: Dict[str, Any]
    ) -> ScenarioResult:
        payloads = scenario.get("payloads", [])
        payload_results: List[PayloadResult] = []

        for payload in payloads:
            result = await self._execute_payload(payload, target)
            payload_results.append(result)

        # Attack considered succeeded if ANY payload succeeded
        succeeded = any(p.succeeded for p in payload_results)
        severity = self._map_severity(succeeded, scenario.get("expected_behavior"))
        recommendations = self._recommendations_for(scenario.get("id", ""))

        return ScenarioResult(
            scenario_id=scenario.get("id", "unknown"),
            name=scenario.get("name", "Unknown Scenario"),
            description=scenario.get("description", ""),
            expected_behavior=scenario.get("expected_behavior", ""),
            payload_results=payload_results,
            succeeded=succeeded,
            severity=severity,
            recommendations=recommendations,
        )

    async def _execute_payload(
        self, payload: str, target: Dict[str, Any]
    ) -> PayloadResult:
        """
        We use MaliciousInputDetector to estimate whether the payload should be blocked.
        If detector risk is low (<0.4), we treat it as a potential success (i.e., slipped through).
        This is a conservative heuristic until live API integration is added.
        """
        detection = await self.detector.analyze_text(payload)
        risk = detection.risk_score
        succeeded = risk < 0.4  # lower risk => more likely it would bypass defenses

        evidence = {
            "risk_score": risk,
            "findings": [f.description for f in detection.findings][:3],
        }

        return PayloadResult(
            payload=payload,
            succeeded=succeeded,
            confidence_score=1.0 - risk,
            evidence=evidence,
        )

    @staticmethod
    def _calculate_attack_success_rate(results: List[ScenarioResult]) -> float:
        if not results:
            return 0.0
        successful = sum(1 for r in results if r.succeeded)
        return successful / len(results)

    @staticmethod
    def _map_severity(succeeded: bool, expected_behavior: str) -> str:
        if not succeeded:
            return "low"
        if expected_behavior in ("rejection", "no_results_or_filtered"):
            return "high"
        return "medium"

    @staticmethod
    def _recommendations_for(scenario_id: str) -> List[str]:
        common = [
            "Strengthen retrieval filters and apply allow/deny lists.",
            "Add prompt-injection defenses and canonicalization before embedding.",
            "Validate and sanitize user queries; enforce rate limits.",
        ]
        specific = {
            "prompt_injection_retrieval": [
                "Strip or neutralize system-level directives before retrieval.",
                "Add guardrails to ignore instruction-like patterns in queries.",
            ],
            "data_extraction": [
                "Tighten access control on sensitive indices.",
                "Mask or redact secrets in retrieved chunks.",
            ],
            "jailbreak_embedding": [
                "Normalize and filter adversarial tokens before embedding.",
                "Use embedding-level anomaly detection for jailbreak payloads.",
            ],
            "retrieval_poisoning": [
                "Verify data ingestion pipelines; scan for malicious chunks.",
                "Apply trust scores to sources; down-rank untrusted content.",
            ],
        }
        return specific.get(scenario_id, []) + common

    @staticmethod
    def _summarize_vulns(results: List[ScenarioResult]) -> List[Dict[str, Any]]:
        vulns = []
        for r in results:
            if not r.succeeded:
                continue
            vulns.append(
                {
                    "scenario_id": r.scenario_id,
                    "name": r.name,
                    "severity": r.severity,
                    "description": r.description,
                    "reproduction": [p.payload for p in r.payload_results if p.succeeded],
                    "recommendations": r.recommendations,
                }
            )
        return vulns

    @staticmethod
    def _serialize_scenario(sr: ScenarioResult) -> Dict[str, Any]:
        return {
            "scenario_id": sr.scenario_id,
            "name": sr.name,
            "description": sr.description,
            "expected_behavior": sr.expected_behavior,
            "succeeded": sr.succeeded,
            "severity": sr.severity,
            "recommendations": sr.recommendations,
            "payload_results": [
                {
                    "payload": pr.payload,
                    "succeeded": pr.succeeded,
                    "confidence_score": pr.confidence_score,
                    "evidence": pr.evidence,
                }
                for pr in sr.payload_results
            ],
        }


