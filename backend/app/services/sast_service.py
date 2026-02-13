"""
SAST Service - Integrates Semgrep and TruffleHog for code analysis
Uses SAST-MCP for proper vulnerability detection in C/C++ code
"""

import json
import re
import tempfile
import subprocess
import os
import sys
import shutil
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime

# Windows PATH fix: Add Python Scripts directory to PATH
if sys.platform == "win32":
    try:
        scripts_dir = os.path.join(
            os.path.dirname(os.path.dirname(sys.prefix)),
            "AppData", "Roaming", "Python", f"Python{sys.version_info.major}{sys.version_info.minor}", "Scripts"
        )
        if os.path.exists(scripts_dir) and scripts_dir not in os.environ.get('PATH', ''):
            os.environ['PATH'] = scripts_dir + os.pathsep + os.environ.get('PATH', '')
    except Exception:
        pass

@dataclass
class Vulnerability:
    """Vulnerability finding from SAST tools"""
    id: str
    type: str
    category: str
    severity: str
    severity_score: int
    cwe: List[str]
    message: str
    remediation: str
    confidence: float
    file: str
    line: int
    column: Optional[int] = None
    snippet: str = ""
    evidence: Dict = field(default_factory=dict)
    priority_rank: int = 1
    confidence_label: str = ""
    severity_emoji: str = ""


class SASTService:
    """
    Service for Static Application Security Testing using Semgrep and TruffleHog
    Provides unified interface for analyzing C/C++ code
    """

    # Severity emoji mapping (ASCII-safe for Windows compatibility)
    SEVERITY_EMOJIS = {
        "Critical": "[!!!]",
        "High": "[!]",
        "Medium": "[*]",
        "Low": "[+]",
        "Info": "[i]"
    }

    def __init__(self):
        """Initialize SAST service"""
        self.semgrep_available = self._check_semgrep()
        self.trufflehog_available = self._check_trufflehog()
        self.semgrep_cmd = self._find_tool_command("semgrep")
        self.trufflehog_cmd = self._find_tool_command("trufflehog")

    def _check_semgrep(self) -> bool:
        """Check if Semgrep is installed"""
        # Try multiple ways to find semgrep
        attempts = [
            lambda: subprocess.run(["semgrep", "--version"], capture_output=True, timeout=30),
            lambda: subprocess.run([sys.executable, "-m", "semgrep", "--version"], capture_output=True, timeout=30),
            lambda: subprocess.run([shutil.which("semgrep") or "semgrep", "--version"], capture_output=True, timeout=30) if shutil.which("semgrep") else None,
        ]

        # Windows: try pysemgrep.exe and semgrep.exe in user Scripts directory
        if sys.platform == "win32":
            user_scripts = os.path.expanduser("~")
            user_scripts = os.path.join(
                user_scripts,
                "AppData", "Roaming", "Python",
                f"Python{sys.version_info.major}{sys.version_info.minor}",
                "Scripts"
            )
            # Try pysemgrep.exe first (more reliable on Windows)
            pysemgrep = os.path.join(user_scripts, "pysemgrep.exe")
            if os.path.exists(pysemgrep):
                attempts.insert(0, lambda: subprocess.run([pysemgrep, "--version"], capture_output=True, timeout=30))
            # Then try semgrep.exe
            semgrep_exe = os.path.join(user_scripts, "semgrep.exe")
            if os.path.exists(semgrep_exe):
                attempts.insert(1, lambda: subprocess.run([semgrep_exe, "--version"], capture_output=True, timeout=30))

        for attempt in attempts:
            try:
                result = attempt()
                if result is None:
                    continue
                if isinstance(result, bool):
                    return result
                if isinstance(result, subprocess.CompletedProcess):
                    return result.returncode == 0
            except (subprocess.TimeoutExpired, FileNotFoundError, Exception, TypeError):
                continue

        return False

    def _check_trufflehog(self) -> bool:
        """Check if TruffleHog is installed"""
        # Try multiple ways to find trufflehog
        attempts = [
            lambda: subprocess.run(["trufflehog", "--version"], capture_output=True, timeout=5),
            lambda: subprocess.run([sys.executable, "-m", "trufflehog", "--version"], capture_output=True, timeout=5),
            lambda: shutil.which("trufflehog") is not None,
        ]

        for attempt in attempts:
            try:
                result = attempt()
                if isinstance(result, bool):
                    return result
                if isinstance(result, subprocess.CompletedProcess):
                    return result.returncode == 0
            except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
                continue

        return False

    def _find_tool_command(self, tool_name: str) -> Optional[List[str]]:
        """
        Find the correct command to run a tool
        Returns command as list suitable for subprocess.run()
        """
        tool_path = shutil.which(tool_name)
        attempts = [
            [tool_name],
            [sys.executable, "-m", tool_name],
            [tool_path] if tool_path else None,
        ]

        # Windows: try pysemgrep.exe and other executables in user Scripts directory
        if sys.platform == "win32":
            user_scripts = os.path.expanduser("~")
            user_scripts = os.path.join(
                user_scripts,
                "AppData", "Roaming", "Python",
                f"Python{sys.version_info.major}{sys.version_info.minor}",
                "Scripts"
            )

            # For semgrep, try pysemgrep first
            if tool_name == "semgrep":
                pysemgrep = os.path.join(user_scripts, "pysemgrep.exe")
                if os.path.exists(pysemgrep):
                    attempts.insert(0, [pysemgrep])
                semgrep_exe = os.path.join(user_scripts, "semgrep.exe")
                if os.path.exists(semgrep_exe):
                    attempts.insert(1, [semgrep_exe])
            else:
                # For other tools, try {tool_name}.exe
                tool_exe = os.path.join(user_scripts, f"{tool_name}.exe")
                if os.path.exists(tool_exe):
                    attempts.insert(0, [tool_exe])

        for cmd in attempts:
            if cmd is None:
                continue
            try:
                result = subprocess.run(
                    cmd + ["--version"],
                    capture_output=True,
                    timeout=30
                )
                if result.returncode == 0:
                    return cmd
            except (subprocess.TimeoutExpired, FileNotFoundError, Exception, TypeError):
                continue

        return None

    async def scan_text(self, content: str, filename: str = "code.c") -> List[Vulnerability]:
        """
        Scan text content for vulnerabilities

        Args:
            content: C/C++ source code as string
            filename: Name of the file

        Returns:
            List of vulnerabilities found
        """
        findings = []

        # Create temporary file with content
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.c',
            delete=False,
            dir=tempfile.gettempdir()
        ) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name

        try:
            # Run Semgrep analysis
            if self.semgrep_available:
                semgrep_findings = await self._run_semgrep(tmp_path, filename)
                findings.extend(semgrep_findings)

            # Run TruffleHog for secrets
            trufflehog_findings = await self._run_trufflehog(tmp_path, filename)
            findings.extend(trufflehog_findings)

        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_path)
            except:
                pass

        return findings

    async def scan_file(self, file_path: str) -> List[Vulnerability]:
        """
        Scan a single file for vulnerabilities

        Args:
            file_path: Path to the C/C++ file

        Returns:
            List of vulnerabilities found
        """
        findings = []

        if not os.path.exists(file_path):
            return findings

        try:
            # Get filename
            filename = os.path.basename(file_path)

            # Run Semgrep analysis
            if self.semgrep_available:
                semgrep_findings = await self._run_semgrep(file_path, filename)
                findings.extend(semgrep_findings)

            # Run TruffleHog for secrets
            trufflehog_findings = await self._run_trufflehog(file_path, filename)
            findings.extend(trufflehog_findings)

        except Exception as e:
            print(f"Error scanning file {file_path}: {str(e)}")

        return findings

    async def scan_directory(self, dir_path: str) -> List[Vulnerability]:
        """
        Scan entire directory for vulnerabilities

        Args:
            dir_path: Path to directory containing C/C++ files

        Returns:
            List of vulnerabilities found
        """
        findings = []

        if not os.path.isdir(dir_path):
            return findings

        try:
            # Run Semgrep on directory
            if self.semgrep_available:
                semgrep_findings = await self._run_semgrep(dir_path)
                findings.extend(semgrep_findings)

            # Run TruffleHog on directory
            trufflehog_findings = await self._run_trufflehog(dir_path)
            findings.extend(trufflehog_findings)

        except Exception as e:
            print(f"Error scanning directory {dir_path}: {str(e)}")

        return findings

    async def _run_semgrep(self, target_path: str, filename: Optional[str] = None) -> List[Vulnerability]:
        """
        Run Semgrep analysis on target

        Args:
            target_path: Path to file or directory
            filename: Optional filename for tracking

        Returns:
            List of vulnerabilities found by Semgrep
        """
        if not self.semgrep_available or not self.semgrep_cmd:
            return []

        findings = []

        try:
            # Run semgrep with C-specific rules
            cmd = self.semgrep_cmd + [
                "--json",
                "--config=p/c",  # C/C++ rules
                target_path
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=60,
                text=True
            )

            if result.returncode == 0 or result.returncode == 1:  # 1 means findings found
                try:
                    output = json.loads(result.stdout)
                    results = output.get("results", [])

                    for result_item in results:
                        vuln = self._parse_semgrep_result(result_item, filename)
                        if vuln:
                            findings.append(vuln)
                except json.JSONDecodeError:
                    pass

        except subprocess.TimeoutExpired:
            print("Semgrep scan timed out")
        except Exception as e:
            print(f"Error running Semgrep: {str(e)}")

        return findings

    async def _run_trufflehog(self, target_path: str, filename: Optional[str] = None) -> List[Vulnerability]:
        """
        Run TruffleHog analysis on target for secrets

        Args:
            target_path: Path to file or directory
            filename: Optional filename for tracking

        Returns:
            List of secrets found by TruffleHog
        """
        if not self.trufflehog_available or not self.trufflehog_cmd:
            return []

        findings = []

        try:
            # Run trufflehog with JSON output
            cmd = self.trufflehog_cmd + [
                "filesystem",
                target_path,
                "--json",
                "--only-verified"
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=60,
                text=True
            )

            # Parse output (trufflehog outputs JSONL)
            if result.stdout:
                for line in result.stdout.strip().split('\n'):
                    if line.strip():
                        try:
                            result_item = json.loads(line)
                            vuln = self._parse_trufflehog_result(result_item, filename)
                            if vuln:
                                findings.append(vuln)
                        except json.JSONDecodeError:
                            pass

        except subprocess.TimeoutExpired:
            print("TruffleHog scan timed out")
        except Exception as e:
            print(f"Error running TruffleHog: {str(e)}")

        return findings

    def _parse_semgrep_result(self, result: Dict, filename: Optional[str] = None) -> Optional[Vulnerability]:
        """
        Parse Semgrep JSON result into Vulnerability object

        Args:
            result: Semgrep result dictionary
            filename: Optional filename override

        Returns:
            Vulnerability object or None
        """
        try:
            # Extract information from semgrep result
            rule_id = result.get("check_id", "unknown")
            message = result.get("extra", {}).get("message", "")
            path = result.get("path", filename or "unknown")
            start_line = result.get("start", {}).get("line", 1)
            start_col = result.get("start", {}).get("col", 0)
            end_line = result.get("end", {}).get("line", start_line)

            # Determine severity
            severity_level = result.get("extra", {}).get("severity", "INFO").upper()
            severity_map = {
                "ERROR": ("Critical", 5),
                "WARNING": ("High", 4),
                "INFO": ("Medium", 3)
            }
            severity, severity_score = severity_map.get(severity_level, ("Low", 2))

            # Extract CWE if available
            cwe_list = result.get("extra", {}).get("cwe", [])
            if isinstance(cwe_list, str):
                cwe_list = [cwe_list]
            cwe_list = [f"CWE-{cwe}" if not cwe.startswith("CWE-") else cwe for cwe in cwe_list]

            # Create vulnerability object
            vuln = Vulnerability(
                id=f"SEMGREP-{rule_id}-{start_line}",
                type=rule_id,
                category="C/C++ Vulnerability",
                severity=severity,
                severity_score=severity_score,
                cwe=cwe_list or ["CWE-0"],
                message=message or f"Semgrep rule {rule_id} triggered",
                remediation=result.get("extra", {}).get("fix", "Review code and apply fix"),
                confidence=0.85,
                file=path,
                line=start_line,
                column=start_col,
                snippet=result.get("extra", {}).get("lines", ""),
                evidence={"rule": rule_id},
                confidence_label=self._get_confidence_label(0.85),
                severity_emoji=self.SEVERITY_EMOJIS.get(severity, "")
            )

            return vuln

        except Exception as e:
            print(f"Error parsing Semgrep result: {str(e)}")
            return None

    def _parse_trufflehog_result(self, result: Dict, filename: Optional[str] = None) -> Optional[Vulnerability]:
        """
        Parse TruffleHog JSON result into Vulnerability object

        Args:
            result: TruffleHog result dictionary
            filename: Optional filename override

        Returns:
            Vulnerability object or None
        """
        try:
            # Extract information from trufflehog result
            detector_name = result.get("DetectorName", "Secret")
            raw_value = result.get("RawV2", "")
            file_path = result.get("SourceMetadata", {}).get("Data", {}).get("Filesystem", {}).get("file", filename or "unknown")
            line_num = result.get("SourceMetadata", {}).get("Data", {}).get("Filesystem", {}).get("line", 1)

            # Redact the secret
            redacted = self._redact_secret(raw_value)

            # Create vulnerability object for secret
            vuln = Vulnerability(
                id=f"TRUFFLEHOG-{detector_name}-{line_num}",
                type=detector_name,
                category="Secret",
                severity="Critical",
                severity_score=5,
                cwe=["CWE-798", "CWE-200"],
                message=f"{detector_name} detected - hardcoded credential found",
                remediation="IMMEDIATE ACTION: 1) Remove secret from code, 2) Rotate credential, 3) Use environment variables",
                confidence=0.95,
                file=file_path,
                line=line_num,
                column=0,
                snippet=raw_value[:100],
                evidence={
                    "detector": detector_name,
                    "redacted": redacted
                },
                confidence_label="Very High",
                severity_emoji=self.SEVERITY_EMOJIS["Critical"]
            )

            return vuln

        except Exception as e:
            print(f"Error parsing TruffleHog result: {str(e)}")
            return None

    def _redact_secret(self, secret: str) -> str:
        """Redact secret showing only last 4 chars"""
        if not secret or len(secret) <= 8:
            return secret[:2] + ("*" * max(0, len(secret) - 4)) + secret[-2:]
        return "*" * (len(secret) - 4) + secret[-4:]

    def _get_confidence_label(self, confidence: float) -> str:
        """Convert confidence score to human-readable label"""
        if confidence >= 0.95:
            return "Very High"
        elif confidence >= 0.85:
            return "High"
        elif confidence >= 0.75:
            return "Medium"
        elif confidence >= 0.65:
            return "Low"
        else:
            return "Uncertain"

    def get_status(self) -> Dict:
        """Get SAST service status"""
        return {
            "sast_available": True,
            "semgrep": {
                "available": self.semgrep_available,
                "tool": "Semgrep",
                "purpose": "C/C++ vulnerability detection"
            },
            "trufflehog": {
                "available": self.trufflehog_available,
                "tool": "TruffleHog",
                "purpose": "Secret detection"
            },
            "capabilities": [
                "C/C++ vulnerability detection",
                "Secret/credential detection",
                "File and directory scanning",
                "Text content analysis"
            ]
        }


# Initialize global SAST service
sast_service = SASTService()
