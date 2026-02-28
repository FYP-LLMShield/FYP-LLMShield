"""
LLM-based Code Scanner Service using Groq API
==============================================
Integrates Groq Cloud API (llama-3.1-70b-versatile) for LLM-powered vulnerability analysis.
Complements regex scanner with AI-driven code understanding.
"""

import asyncio
import json
import re
import os
from typing import List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import httpx
import logging

logger = logging.getLogger(__name__)


@dataclass
class LLMFinding:
    """LLM-based finding from code analysis."""
    type: str
    severity: str  # Critical/High/Medium/Low
    severity_score: int  # 1-5
    cwe: List[str]
    message: str
    remediation: str
    file: str
    line: int
    snippet: str
    confidence: float  # LLM provides this (0.0-1.0)
    source: str = "llm"

    def to_dict(self):
        """Convert to dictionary."""
        return asdict(self)


class LLMScannerService:
    """LLM scanner using Groq API for code analysis."""

    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    MODEL = "llama-3.1-70b-versatile"
    TIMEOUT = 60.0  # 60 second timeout

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=self.TIMEOUT)
        self.api_key = os.getenv('GROQ_API_KEY')

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def is_available(self) -> bool:
        """Check if Groq API is available and API key is configured."""
        try:
            if not self.api_key:
                logger.debug("Groq API key not configured")
                return False

            async with httpx.AsyncClient(timeout=3.0) as client:
                # Make a quick test request to verify API connectivity
                response = await client.post(
                    self.GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.MODEL,
                        "messages": [{"role": "user", "content": "test"}],
                        "max_tokens": 10,
                        "temperature": 0.1
                    },
                    timeout=3.0
                )
                is_available = response.status_code in [200, 400, 429]
                logger.info(f"[LLM] Availability check: {is_available} (status: {response.status_code})")
                return is_available
        except Exception as e:
            logger.warning(f"[LLM] Availability check failed: {str(e)}")
        return False

    def _build_prompt(self, content: str, filename: str) -> str:
        """Build the LLM prompt for security analysis - validating and contextualizing findings."""
        return f"""You are a professional C/C++ security auditor with code understanding expertise. Your role is to:
1. VALIDATE pattern-detected vulnerabilities (understand context and reduce false positives)
2. FIND issues that pattern matching CANNOT detect

VALIDATION RULES FOR COMMON PATTERN DETECTIONS:
================================================
When you see these patterns, analyze the CONTEXT:

A. sprintf/printf with format string:
   - REAL VULNERABILITY: User input controls the format string
   - FALSE POSITIVE: Format string is hardcoded literal
   Example SAFE: sprintf(buf, "Result: %d", user_value)
   Example VULNERABLE: sprintf(buf, user_input)  // Format string from user!

B. strcpy/strcat operations:
   - REAL VULNERABILITY: Source size unknown or destination buffer too small
   - FALSE POSITIVE: Copying hardcoded literal into large enough buffer
   Example SAFE: strcpy(cmd, "clear")  // 5 bytes into 64-byte buffer
   Example VULNERABLE: strcpy(dest, src)  // sizes unknown

C. system() calls:
   - REAL VULNERABILITY: Command derived from user input
   - ACCEPTABLE RISK: Command is hardcoded (but still risky, flag with lower confidence)
   Example SAFE but FLAG: system(cmd)  // if cmd is hardcoded "cls"
   Example VULNERABLE: system(user_input)  // User controls command!

ISSUES TO FIND (Pattern matching will miss these):
==================================================
1. LOGIC BUGS:
   - Assignment in if condition (if (x = 1) instead of if (x == 1))
   - Integer overflows/underflows without checks
   - Off-by-one errors in loops and array access
   - Race conditions (concurrent access without locks)
   - Null pointer dereferences after checks

2. ADVANCED MEMORY ISSUES:
   - Use-after-free patterns
   - Double-free conditions
   - Memory leaks (allocated but never freed)
   - Buffer underflow scenarios
   - Heap corruption risks

3. SEMANTIC VULNERABILITIES:
   - Format string vulnerabilities (user-controlled format)
   - Type confusion or casting errors
   - Incorrect array bounds calculations
   - Sign/unsigned comparison bugs
   - Resource exhaustion (infinite loops, excessive allocation)

4. DATA FLOW ISSUES:
   - Unvalidated user input in critical operations
   - Information disclosure
   - Path traversal possibilities
   - Control flow hijacking

INSTRUCTIONS:
==============
FILENAME: {filename}
CODE:
```
{content}
```

Return ONLY a valid JSON array of findings. For each vulnerability:
- type: clear vulnerability type
- severity: "Critical" | "High" | "Medium" | "Low"
- line: line number (must be accurate)
- message: WHY this is vulnerable (reference context if validating pattern)
- cwe: array of CWE identifiers
- remediation: specific fix or how to validate safety
- snippet: actual code snippet
- confidence: 0.0-1.0 (lower if context makes it safe but pattern flagged it)

EXAMPLES OF YOUR ANALYSIS:

Finding 1 - Validating a pattern detection:
{{
  "type": "sprintf - Safe Pattern",
  "severity": "Low",
  "line": 30,
  "message": "Pattern detected sprintf, but analysis shows format string is hardcoded ('You entered: %s'). User input is passed as argument, not format. SAFE.",
  "cwe": ["CWE-134"],
  "remediation": "No action needed. Format string is hardcoded and safe.",
  "snippet": "sprintf(buffer, \"You entered: %s\", expr)",
  "confidence": 0.1
}}

Finding 2 - Finding a real logic bug:
{{
  "type": "Assignment in Condition",
  "severity": "High",
  "line": 15,
  "message": "Assignment operator used in if condition instead of comparison operator.",
  "cwe": ["CWE-481"],
  "remediation": "Change = to == for comparison",
  "snippet": "if (x = value)",
  "confidence": 0.95
}}

Return [] if no real vulnerabilities found after validation."""

    def _extract_json_from_response(self, response_text: str) -> Optional[List[dict]]:
        """Extract JSON array from LLM response, with fallback parsing."""
        try:
            # Try direct JSON parsing
            data = json.loads(response_text)
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass

        # Fallback: extract JSON array using regex
        try:
            # Match [ ... ] pattern
            match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if match:
                json_str = match.group(0)
                data = json.loads(json_str)
                if isinstance(data, list):
                    return data
        except Exception:
            pass

        logger.warning("Failed to extract JSON from LLM response")
        return None

    async def scan_code(self, content: str, filename: str) -> List[LLMFinding]:
        """
        Scan code using Groq LLM.

        Args:
            content: Code content to scan
            filename: Filename for context

        Returns:
            List of LLMFinding objects
        """
        if not content.strip():
            logger.debug(f"[LLM] Skipping empty content for {filename}")
            return []

        try:
            if not self.api_key:
                logger.error("[LLM] Groq API key not configured")
                return []

            logger.info(f"[LLM] SCAN STARTED for {filename} ({len(content)} bytes)")
            prompt = self._build_prompt(content, filename)
            logger.debug(f"[LLM] Prompt length: {len(prompt)} characters")

            # Call Groq API
            logger.info("[LLM] Calling Groq API...")
            response = await self.client.post(
                self.GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a professional C/C++ security code reviewer."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1,  # Lower temp for more deterministic output
                },
                timeout=self.TIMEOUT
            )

            if response.status_code != 200:
                logger.error(f"[LLM] Groq API request failed: {response.status_code}")
                logger.debug(f"[LLM] Response: {response.text[:500]}")
                return []

            response_data = response.json()
            response_text = response_data["choices"][0]["message"]["content"]
            logger.info(f"[LLM] Got response ({len(response_text)} chars)")
            logger.debug(f"[LLM] Response text: {response_text[:300]}")

            # Extract JSON findings
            findings_data = self._extract_json_from_response(response_text)
            logger.info(f"[LLM] Extracted {len(findings_data or [])} findings from JSON")
            if not findings_data:
                logger.warning("[LLM] No findings extracted from LLM response")
                return []

            # Convert to LLMFinding objects
            findings = []
            for i, finding_dict in enumerate(findings_data):
                try:
                    finding = LLMFinding(
                        type=finding_dict.get("type", "Unknown"),
                        severity=finding_dict.get("severity", "Medium"),
                        severity_score=self._severity_to_score(finding_dict.get("severity", "Medium")),
                        cwe=finding_dict.get("cwe", []),
                        message=finding_dict.get("message", ""),
                        remediation=finding_dict.get("remediation", ""),
                        file=filename,
                        line=finding_dict.get("line", 1),
                        snippet=finding_dict.get("snippet", ""),
                        confidence=float(finding_dict.get("confidence", 0.5)),
                        source="llm"
                    )
                    findings.append(finding)
                    logger.info(f"[LLM]   Finding {i+1}: {finding.type} at line {finding.line} (severity: {finding.severity}, conf: {finding.confidence})")
                except Exception as e:
                    logger.error(f"[LLM] Failed to parse LLM finding {i}: {str(e)}")
                    logger.debug(f"[LLM] Finding dict: {finding_dict}")
                    continue

            logger.info(f"[LLM] SCAN COMPLETED - Returning {len(findings)} findings")
            return findings

        except asyncio.TimeoutError:
            logger.error(f"[LLM] TIMEOUT for {filename}")
            return []
        except Exception as e:
            logger.error(f"[LLM] SCAN FAILED: {str(e)}")
            import traceback
            logger.debug(f"[LLM] Traceback: {traceback.format_exc()}")
            return []

    @staticmethod
    def _severity_to_score(severity: str) -> int:
        """Convert severity string to numeric score."""
        mapping = {
            "Critical": 5,
            "High": 4,
            "Medium": 3,
            "Low": 2,
            "Info": 1,
        }
        return mapping.get(severity, 3)


# Global instance
llm_scanner_service = LLMScannerService()
