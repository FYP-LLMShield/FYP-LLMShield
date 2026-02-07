"""
Malicious Input Detector
------------------------
Analyzes raw text and documents for prompt injection, jailbreak patterns,
adversarial inputs, and unsafe content before embedding.

Integration notes:
- Reuses existing prompt-injection logic via EmbeddingInspector in
  `app.routes.prompt_injection`.
- Outputs findings compatible with vector_scan_results schema.
"""

from __future__ import annotations

import asyncio
import io
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import string

# Optional imports for file parsing
try:
    import pdfplumber  # type: ignore
except Exception:  # pragma: no cover
    pdfplumber = None

try:
    import docx  # python-docx
except Exception:  # pragma: no cover
    docx = None

try:
    import openai  # type: ignore
except Exception:  # pragma: no cover
    openai = None

# Reuse existing detection logic from prompt_injection
try:
    from app.routes.prompt_injection import EmbeddingInspector
except Exception:
    EmbeddingInspector = None  # pragma: no cover


# ---------- Data models ----------
@dataclass
class Finding:
    detection_category: str  # malicious_input | embedding_security | attack_simulation
    threat_type: str  # prompt_injection | jailbreak | anomaly | collision | etc.
    severity: str  # low | medium | high | critical
    confidence_score: float
    description: str
    evidence: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DetectionResult:
    findings: List[Finding]
    risk_score: float
    severity: str
    summary: Dict[str, Any] = field(default_factory=dict)


# ---------- Detector Implementation ----------
class MaliciousInputDetector:
    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 100,
        enable_moderation: bool = True,
    ):
        self.chunk_size = max(100, chunk_size)
        self.chunk_overlap = max(0, min(chunk_overlap, self.chunk_size - 1))
        self.enable_moderation = enable_moderation

        # Jailbreak / prompt-injection regexes (lightweight)
        self.jailbreak_patterns = [
            r"(?i)\bDAN\b",
            r"(?i)do anything now",
            r"(?i)ignore (all|any) previous (instructions|prompts|rules)",
            r"(?i)pretend to be (an? )?(unfiltered|uncensored)",
            r"(?i)reveal (system|internal|hidden|confidential)",
            r"(?i)begin jailbreak",
            r"(?i)### system prompt ###",
        ]

        # Adversarial / obfuscation patterns
        self.adversarial_patterns = [
            r"(?i)base64[:\s]*[A-Za-z0-9+/=]{12,}",
            r"(0x[0-9a-fA-F]{16,})",
            r"(\\u[0-9a-fA-F]{4}\\u[0-9a-fA-F]{4,})",
            r"(?:\s|^)[\u200b-\u200f\u2060\u2061\u2062\u2063]+",  # invisible chars
        ]

    # Public API
    async def analyze_text(self, text: str) -> DetectionResult:
        """
        Analyze text for security threats before embedding.
        - Prompt injection (reuses EmbeddingInspector patterns)
        - Jailbreak patterns
        - Adversarial inputs / obfuscation
        - Content safety (OpenAI moderation if available)
        """
        findings: List[Finding] = []

        chunks = self._chunk_text(text)

        # Prompt injection-style pattern detection (reuse EmbeddingInspector if available)
        if EmbeddingInspector:
            inspector = EmbeddingInspector(chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap)
            for chunk in chunks:
                for f in inspector.analyze_chunk(chunk):
                    findings.append(
                        Finding(
                            detection_category="malicious_input",
                            threat_type=f.reason_label,
                            severity=self._score_to_severity(f.risk_score),
                            confidence_score=f.risk_score,
                            description=f.snippet,
                            evidence={"location": f.location, "chunk_id": f.chunk_id},
                            recommendations=[f.recommended_action] if f.recommended_action else [],
                        )
                    )

        # Jailbreak patterns
        for chunk in chunks:
            for pat in self.jailbreak_patterns:
                for m in re.finditer(pat, chunk.text):
                    findings.append(
                        Finding(
                            detection_category="malicious_input",
                            threat_type="jailbreak",
                            severity="high",
                            confidence_score=0.72,
                            description="Jailbreak-like pattern detected",
                            evidence={
                                "pattern": pat,
                                "match": chunk.text[max(0, m.start() - 40) : m.end() + 40],
                                "chunk_id": chunk.chunk_id,
                            },
                            recommendations=[
                                "Sanitize or denylist jailbreak trigger phrases",
                                "Add defense-in-depth guardrails at retrieval layer",
                            ],
                        )
                    )

        # Adversarial / obfuscation patterns
        for chunk in chunks:
            for pat in self.adversarial_patterns:
                for m in re.finditer(pat, chunk.text):
                    findings.append(
                        Finding(
                            detection_category="malicious_input",
                            threat_type="adversarial_obfuscation",
                            severity="medium",
                            confidence_score=0.6,
                            description="Potential adversarial/obfuscated content",
                            evidence={
                                "pattern": pat,
                                "match": chunk.text[max(0, m.start() - 30) : m.end() + 30],
                                "chunk_id": chunk.chunk_id,
                            },
                            recommendations=[
                                "Normalize/strip obfuscated tokens before embedding",
                                "Flag and review high-entropy or encoded payloads",
                            ],
                        )
                    )

        # Content safety via OpenAI moderation (best-effort, optional)
        if self.enable_moderation and openai is not None and chunks:
            moderation_findings = await self._run_moderation(chunks)
            findings.extend(moderation_findings)

        risk_score, severity = self._aggregate_risk(findings)
        summary = {
            "total_findings": len(findings),
            "severity": severity,
            "risk_score": risk_score,
        }

        return DetectionResult(findings=findings, risk_score=risk_score, severity=severity, summary=summary)

    # ---------- File helpers ----------
    async def analyze_file(self, content: bytes, content_type: str) -> DetectionResult:
        text = self._extract_text(content, content_type)
        if not text.strip():
            return DetectionResult(findings=[], risk_score=0.0, severity="low", summary={"total_findings": 0})
        return await self.analyze_text(text)

    # ---------- Internal helpers ----------
    def _chunk_text(self, text: str) -> List[Any]:
        """
        Use EmbeddingInspector's chunking if available; otherwise word-based chunking.
        Returns list of EmbeddingChunk-like objects with required fields.
        """
        if EmbeddingInspector:
            inspector = EmbeddingInspector(chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap)
            return inspector.chunk_text(text)

        words = text.split()
        chunks = []
        start = 0
        chunk_id = 0
        while start < len(words):
            end = min(len(words), start + self.chunk_size)
            chunk_words = words[start:end]
            chunk_text = " ".join(chunk_words)
            chunks.append(
                type(
                    "SimpleChunk",
                    (),
                    {
                        "chunk_id": chunk_id,
                        "text": chunk_text,
                        "start_line": 0,
                        "end_line": 0,
                        "start_idx": start,
                        "end_idx": end,
                    },
                )()
            )
            chunk_id += 1
            start = max(end - self.chunk_overlap, end)
        return chunks

    def _extract_text(self, content: bytes, content_type: str) -> str:
        if content_type in ("text/plain", "text/markdown"):
            return content.decode("utf-8", errors="ignore")
        if content_type == "application/pdf" and pdfplumber:
            try:
                with pdfplumber.open(io.BytesIO(content)) as pdf:
                    return "\n".join(page.extract_text() or "" for page in pdf.pages)
            except Exception:
                return ""
        if (
            content_type
            == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            and docx
        ):
            try:
                document = docx.Document(io.BytesIO(content))
                return "\n".join(p.text for p in document.paragraphs)
            except Exception:
                return ""
        # Fallback
        try:
            return content.decode("utf-8", errors="ignore")
        except Exception:
            return ""

    async def _run_moderation(self, chunks: List[Any]) -> List[Finding]:
        findings: List[Finding] = []
        if openai is None:
            return findings

        # Take a subset to limit calls
        sample_texts = [c.text[:2000] for c in chunks[:5]]

        async def moderate(text: str) -> Optional[Dict[str, Any]]:
            try:
                resp = await openai.Moderation.acreate(input=text)
                return resp  # raw response; we'll parse flags
            except Exception:
                return None

        tasks = [moderate(t) for t in sample_texts]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for res in results:
            if not res or isinstance(res, Exception):
                continue
            categories = res.get("results", [{}])[0].get("categories", {}) if isinstance(res, dict) else {}
            flagged = res.get("results", [{}])[0].get("flagged", False) if isinstance(res, dict) else False
            if flagged:
                findings.append(
                    Finding(
                        detection_category="malicious_input",
                        threat_type="content_safety",
                        severity="high",
                        confidence_score=0.8,
                        description="OpenAI moderation flagged unsafe content",
                        evidence={"categories": categories},
                        recommendations=[
                            "Filter or redact unsafe content before embedding",
                            "Apply stricter allowlist/denylist rules",
                        ],
                    )
                )
        return findings

    def _aggregate_risk(self, findings: List[Finding]) -> Tuple[float, str]:
        if not findings:
            return 0.0, "low"
        # Use max confidence as risk score (aligned with best-of-best approach)
        score = max(f.confidence_score for f in findings)
        severity = self._score_to_severity(score)
        return score, severity

    @staticmethod
    def _score_to_severity(score: float) -> str:
        if score >= 0.85:
            return "critical"
        if score >= 0.7:
            return "high"
        if score >= 0.5:
            return "medium"
        return "low"





