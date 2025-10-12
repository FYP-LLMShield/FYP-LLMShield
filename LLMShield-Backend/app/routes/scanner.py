"""
Security Scanner Router - FastAPI routes for vulnerability and secret detection
=============================================================================
Handles text scanning, file uploads, and GitHub repository analysis.
Enhanced version with improved visual reporting and better readability.
"""

import os
import re
import math
import json
import tempfile
import zipfile
import shutil
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Iterable, Union
from collections import Counter, defaultdict
import concurrent.futures
from functools import partial
from datetime import datetime
import hashlib
import time

#pdf generation
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from io import BytesIO

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel, Field

# Import authentication dependencies
from app.utils.auth import get_current_user
from app.models.user import UserInDB
from app.services.scan_history_service import save_scan_to_history

try:
    from git import Repo
    _GIT_OK = True
except ImportError:
    _GIT_OK = False
    print("Warning: GitPython not installed. GitHub scanning disabled.")

router = APIRouter()

# Cache for GitHub scans
_SCAN_CACHE = {}  # {repo_hash: (timestamp, scan_response)}
CACHE_TTL_SECONDS = 3600  # 1 hour

def get_repo_cache_key(repo_url: str, branch: Optional[str], scan_types: List[str]) -> str:
    """Generate cache key for repo scan."""
    cache_string = f"{repo_url}:{branch or 'default'}:{','.join(sorted(scan_types))}"
    return hashlib.sha256(cache_string.encode()).hexdigest()

def get_cached_scan(cache_key: str) -> Optional[dict]:
    """Get cached scan if still valid."""
    if cache_key in _SCAN_CACHE:
        timestamp, response = _SCAN_CACHE[cache_key]
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            return response
        else:
            del _SCAN_CACHE[cache_key]
    return None

def cache_scan(cache_key: str, response: dict):
    """Cache scan response."""
    _SCAN_CACHE[cache_key] = (time.time(), response)
    
    # Cleanup old cache entries
    current_time = time.time()
    keys_to_delete = [k for k, (ts, _) in _SCAN_CACHE.items() 
                      if current_time - ts > CACHE_TTL_SECONDS]
    for k in keys_to_delete:
        del _SCAN_CACHE[k]

# =========================
# Models & Configuration
# =========================

class TextScanRequest(BaseModel):
    content: str
    filename: Optional[str] = "<paste>"
    scan_types: List[str] = Field(default=["secrets", "cpp_vulns"], description="Types to scan: 'secrets', 'cpp_vulns'")

class RepoScanRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None
    subdir: Optional[str] = None
    token: Optional[str] = None
    scan_types: List[str] = Field(default=["secrets", "cpp_vulns"], description="Types to scan: 'secrets', 'cpp_vulns'")
    max_file_size_mb: Optional[float] = Field(default=1.0, description="Skip files larger than this (MB)")
    max_files: Optional[int] = Field(default=500, description="Maximum files to scan")
    use_cache: Optional[bool] = Field(default=True, description="Use cached results if available")

class FindingModel(BaseModel):
    type: str
    category: str
    severity: str
    severity_score: int = Field(description="Numeric severity 1-5")
    severity_emoji: str = Field(default="", description="Visual indicator for severity")
    cwe: List[str]
    message: str
    remediation: str
    confidence: float = Field(description="Confidence score 0.0-1.0")
    confidence_label: str = Field(default="", description="Human-readable confidence level")
    file: str
    line: int
    column: Optional[int] = None
    snippet: str
    evidence: Dict[str, str] = Field(default_factory=dict)
    priority_rank: int = Field(default=0, description="Priority for fixing (1=highest)")

class SeverityDistribution(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    info: int = 0
    
class CategoryBreakdown(BaseModel):
    secrets: int = 0
    cpp_vulnerabilities: int = 0
    
class FileIssues(BaseModel):
    filename: str
    issue_count: int
    critical_count: int
    high_count: int
    lines_affected: List[int]
    
class ExecutiveSummary(BaseModel):
    risk_level: str = Field(description="Overall risk: CRITICAL, HIGH, MEDIUM, LOW, SAFE")
    risk_emoji: str = Field(default="", description="Visual risk indicator")
    total_issues: int
    files_affected: int
    critical_issues: int
    immediate_actions_required: int
    top_risks: List[str] = Field(default_factory=list, description="Top 3 risk categories")
    compliance_concerns: List[str] = Field(default_factory=list, description="CWE/Security standard violations")

class DetailedStats(BaseModel):
    scan_duration_ms: Optional[int] = None
    files_scanned: int = 0
    total_lines_analyzed: int = 0
    scan_coverage: str = ""
    performance_notes: List[str] = Field(default_factory=list)
    
class ImpactAnalysis(BaseModel):
    business_impact: str = Field(default="", description="Potential business impact")
    technical_impact: str = Field(default="", description="Technical security impact")
    exploitation_difficulty: str = Field(default="", description="How easy to exploit")
    
class ScanResponse(BaseModel):
    # Core Info
    engine: str = "LLMShield-Unified"
    scan_id: str = Field(default="", description="Unique scan identifier")
    timestamp: str = Field(default="", description="Scan timestamp")
    method: str
    scan_types: List[str]
    
    # Executive Summary
    executive_summary: ExecutiveSummary
    
    # Results
    total_findings: int
    findings: List[FindingModel]
    
    # Enhanced Analytics 
    severity_distribution: SeverityDistribution
    category_breakdown: CategoryBreakdown
    
    # Top Issues (
    critical_findings: List[FindingModel] = Field(default_factory=list, description="Critical issues requiring immediate attention")
    most_affected_files: List[FileIssues] = Field(default_factory=list, description="Files with most issues")
    
    # Visual Summary (NEW)
    risk_matrix: Dict[str, Dict[str, int]] = Field(default_factory=dict, description="Risk matrix by category and severity")
    
    # Legacy fields (kept for compatibility)
    summary: Dict[str, int]
    stats: Dict[str, Union[int, str]] = Field(default_factory=dict)
    
    # Recommendations (NEW)
    recommendations: List[str] = Field(default_factory=list, description="Prioritized fix recommendations")
    next_steps: List[str] = Field(default_factory=list, description="Immediate next steps")

# File extensions and constants
CPP_EXTS = {".c", ".cc", ".cpp", ".cxx", ".h", ".hh", ".hpp", ".hxx"}
SECRET_EXTS = {".env", ".ini", ".json", ".pem", ".key", ".cfg", ".toml", ".yml", ".yaml", ".txt", ".py", ".js", ".ts", ".go", ".java", ".rb", ".php"}
ALL_EXTS = CPP_EXTS | SECRET_EXTS
IGNORE_MARKER = "LLMShield: ignore"

# Maximum file size for processing (1MB default)
MAX_FILE_SIZE = 1024 * 1024

# Severity emojis and indicators
SEVERITY_EMOJIS = {
    "Critical": "🔴",
    "High": "🟠", 
    "Medium": "🟡",
    "Low": "🔵",
    "Info": "⚪"
}

RISK_LEVEL_EMOJIS = {
    "CRITICAL": "🚨",
    "HIGH": "⚠️",
    "MEDIUM": "⚡",
    "LOW": "ℹ️",
    "SAFE": "✅"
}

# =========================
# Security Detection Logic
# =========================

def generate_scan_id() -> str:
    """Generate unique scan ID."""
    from datetime import datetime
    import random
    import string
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"SCAN-{timestamp}-{random_suffix}"

def get_confidence_label(confidence: float) -> str:
    """Convert confidence score to human-readable label."""
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

def calculate_priority_rank(severity_score: int, confidence: float) -> int:
    """Calculate priority rank for fixing (1 = highest priority)."""
    # Priority based on severity * confidence
    priority_score = severity_score * confidence
    if priority_score >= 4.5:
        return 1  # Urgent
    elif priority_score >= 3.5:
        return 2  # High
    elif priority_score >= 2.5:
        return 3  # Medium
    elif priority_score >= 1.5:
        return 4  # Low
    else:
        return 5  # Minimal

def estimate_fix_time(findings: List[FindingModel]) -> str:
    """Estimate time to fix all issues."""
    if not findings:
        return "No fixes needed"
    
    total_minutes = 0
    for finding in findings:
        if finding.severity_score == 5:  # Critical
            total_minutes += 30
        elif finding.severity_score == 4:  # High
            total_minutes += 20
        elif finding.severity_score == 3:  # Medium
            total_minutes += 10
        else:
            total_minutes += 5
    
    if total_minutes < 60:
        return f"~{total_minutes} minutes"
    elif total_minutes < 480:  # 8 hours
        hours = total_minutes // 60
        return f"~{hours} hours"
    else:
        days = total_minutes // 480  # Assuming 8-hour workday
        return f"~{days} days"

def determine_risk_level(findings: List[FindingModel]) -> Tuple[str, str]:
    """Determine overall risk level and emoji."""
    if not findings:
        return "SAFE", RISK_LEVEL_EMOJIS["SAFE"]
    
    critical_count = sum(1 for f in findings if f.severity_score == 5)
    high_count = sum(1 for f in findings if f.severity_score == 4)
    
    if critical_count > 0:
        return "CRITICAL", RISK_LEVEL_EMOJIS["CRITICAL"]
    elif high_count > 2:
        return "HIGH", RISK_LEVEL_EMOJIS["HIGH"]
    elif high_count > 0:
        return "MEDIUM", RISK_LEVEL_EMOJIS["MEDIUM"]
    else:
        return "LOW", RISK_LEVEL_EMOJIS["LOW"]

def get_top_risks(findings: List[FindingModel]) -> List[str]:
    """Get top 3 risk categories."""
    risk_counts = defaultdict(int)
    for finding in findings:
        if finding.severity_score >= 4:  # High and Critical only
            risk_counts[finding.type] += finding.severity_score
    
    sorted_risks = sorted(risk_counts.items(), key=lambda x: x[1], reverse=True)
    return [f"{risk[0]} ({risk[1]} risk points)" for risk in sorted_risks[:3]]

def get_compliance_concerns(findings: List[FindingModel]) -> List[str]:
    """Get unique CWE violations."""
    cwe_set = set()
    for finding in findings:
        cwe_set.update(finding.cwe)
    return sorted(list(cwe_set))[:5]  # Top 5 CWE concerns

def create_risk_matrix(findings: List[FindingModel]) -> Dict[str, Dict[str, int]]:
    """Create risk matrix by category and severity."""
    matrix = defaultdict(lambda: defaultdict(int))
    for finding in findings:
        category = finding.category.replace(" ", "_").lower()
        severity = finding.severity.lower()
        matrix[category][severity] += 1
    return dict(matrix)

def get_most_affected_files(findings: List[FindingModel], top_n: int = 5) -> List[FileIssues]:
    """Get files with most issues."""
    file_data = defaultdict(lambda: {"count": 0, "critical": 0, "high": 0, "lines": set()})
    
    for finding in findings:
        file_data[finding.file]["count"] += 1
        file_data[finding.file]["lines"].add(finding.line)
        if finding.severity_score == 5:
            file_data[finding.file]["critical"] += 1
        elif finding.severity_score == 4:
            file_data[finding.file]["high"] += 1
    
    # Sort by critical count, then total count
    sorted_files = sorted(
        file_data.items(),
        key=lambda x: (x[1]["critical"], x[1]["count"]),
        reverse=True
    )
    
    result = []
    for filename, data in sorted_files[:top_n]:
        result.append(FileIssues(
            filename=filename,
            issue_count=data["count"],
            critical_count=data["critical"],
            high_count=data["high"],
            lines_affected=sorted(list(data["lines"]))
        ))
    
    return result

def generate_recommendations(findings: List[FindingModel]) -> List[str]:
    """Generate prioritized recommendations."""
    recommendations = []
    
    # Group findings by type and severity
    critical_secrets = sum(1 for f in findings if f.severity_score == 5 and f.category == "Secret")
    critical_vulns = sum(1 for f in findings if f.severity_score == 5 and f.category == "C++ Vulnerability")
    high_issues = sum(1 for f in findings if f.severity_score == 4)
    
    if critical_secrets > 0:
        recommendations.append(f"🔴 URGENT: Rotate {critical_secrets} exposed credential(s) immediately and remove from code")
    
    if critical_vulns > 0:
        recommendations.append(f"🔴 CRITICAL: Fix {critical_vulns} severe vulnerability(ies) that could lead to code execution")
    
    if high_issues > 0:
        recommendations.append(f"🟠 HIGH: Address {high_issues} high-severity issue(s) within 24-48 hours")
    
    # Add general recommendations
    if critical_secrets > 0:
        recommendations.append("📋 Implement secret management solution (e.g., HashiCorp Vault, AWS Secrets Manager)")
    
    if critical_vulns > 0:
        recommendations.append("🛡️ Enable compiler security flags (-fstack-protector-strong, -D_FORTIFY_SOURCE=2)")
    
    if len(findings) > 10:
        recommendations.append("🔍 Consider integrating automated security scanning in CI/CD pipeline")
    
    return recommendations[:5]  # Top 5 recommendations

def generate_next_steps(findings: List[FindingModel]) -> List[str]:
    """Generate immediate next steps."""
    steps = []
    
    critical_findings = [f for f in findings if f.severity_score == 5]
    if critical_findings:
        steps.append(f"1. Review and fix {len(critical_findings)} CRITICAL issue(s) immediately")
        steps.append("2. Check logs for any unauthorized access or suspicious activity")
        steps.append("3. Rotate ALL exposed credentials and API keys")
    
    high_findings = [f for f in findings if f.severity_score == 4]
    if high_findings:
        steps.append(f"4. Schedule fixes for {len(high_findings)} HIGH severity issue(s)")
    
    if not steps:
        steps.append("1. Review all findings and prioritize based on your threat model")
        steps.append("2. Implement suggested remediations starting with highest severity")
    
    steps.append("📧 Share this report with your security team for review")
    
    return steps[:5]

def redact_secret(token: str) -> str:
    """Redact secret showing only last 4 chars."""
    if not token or len(token) <= 8:
        return token[:2] + ("*" * max(0, len(token) - 4)) + token[-2:]
    return "*" * (len(token) - 4) + token[-4:]

def shannon_entropy(s: str) -> float:
    """Calculate Shannon entropy of a string."""
    if not s:
        return 0.0
    length = len(s)
    counts = Counter(s)
    return -sum((c/length) * math.log2(c/length) for c in counts.values())

def looks_like_hex(s: str) -> bool:
    return bool(re.fullmatch(r"[0-9a-fA-F]+", s))

def looks_like_b64(s: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9+/=]+", s)) or bool(re.fullmatch(r"[A-Za-z0-9_\-]+", s))

def jwt_is_valid(token: str) -> bool:
    """Check if JWT token is structurally valid."""
    parts = token.split(".")
    if len(parts) != 3:
        return False
    try:
        import base64
        header = base64.urlsafe_b64decode(parts[0] + '==')
        payload = base64.urlsafe_b64decode(parts[1] + '==')
        hjson = json.loads(header.decode(errors="ignore"))
        pjson = json.loads(payload.decode(errors="ignore"))
        return isinstance(hjson, dict) and "alg" in hjson and isinstance(pjson, dict)
    except Exception:
        return False

# Secret detection patterns - ALL CRITICAL
SECRET_PATTERNS = {
    "AWSAccessKeyID": re.compile(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b"),
    "AWSSecretAccessKey": re.compile(r"(?i)\baws(_|)?secret(_access)?(_|)?key\b[^=\n]*[:=]\s*[\"']?([A-Za-z0-9/+=]{40})[\"']?"),
    "GoogleAPIKey": re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b"),
    "GitHubPAT": re.compile(r"\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{36}\b|github_pat_[A-Za-z0-9_]{22,255}\b"),
    "SlackToken": re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{10,}-[0-9A-Za-z-]{10,}(?:-[0-9A-Za-z-]{10,})?\b"),
    "StripeKey": re.compile(r"\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b"),
    "JWT": re.compile(r"\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b"),
    "SSHPrivateKey": re.compile(r"-----BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY-----"),
    "GenericAPIToken": re.compile(r"(?i)\b[A-Za-z0-9_]*?(api|secret|token|key)[A-Za-z0-9_]*\b\s*[:=]\s*[\"']([A-Za-z0-9_\-\/+=]{12,})[\"']"),
}

# C/C++ vulnerability patterns - Enhanced with specific remediation
CPP_VULN_PATTERNS = {
    "gets": {
        "severity": 5, 
        "cwe": "CWE-120", 
        "msg": "gets() has no bounds checking", 
        "fix": "Replace gets(buffer) with fgets(buffer, sizeof(buffer), stdin)"
    },
    "strcpy": {
        "severity": 5, 
        "cwe": "CWE-120", 
        "msg": "strcpy() can overflow buffer", 
        "fix": "Replace strcpy(dest, src) with strncpy(dest, src, sizeof(dest)-1); dest[sizeof(dest)-1] = '\\0'"
    },
    "strcat": {
        "severity": 5, 
        "cwe": "CWE-120", 
        "msg": "strcat() can overflow buffer", 
        "fix": "Replace strcat(dest, src) with strncat(dest, src, sizeof(dest)-strlen(dest)-1)"
    },
    "sprintf": {
        "severity": 5, 
        "cwe": "CWE-134", 
        "msg": "sprintf() can overflow buffer", 
        "fix": "Replace sprintf(buffer, format, ...) with snprintf(buffer, sizeof(buffer), format, ...)"
    },
    "vsprintf": {
        "severity": 5, 
        "cwe": "CWE-134", 
        "msg": "vsprintf() can overflow buffer", 
        "fix": "Replace vsprintf(buffer, format, args) with vsnprintf(buffer, sizeof(buffer), format, args)"
    },
    "system": {
        "severity": 5, 
        "cwe": "CWE-78", 
        "msg": "system() allows command injection", 
        "fix": "Replace system(command) with execve() family or use parameterized commands"
    },
    "popen": {
        "severity": 4, 
        "cwe": "CWE-78", 
        "msg": "popen() can execute arbitrary commands", 
        "fix": "Replace popen(command, mode) with secure process execution using execve()"
    },
    "strncpy": {
        "severity": 4, 
        "cwe": "CWE-120", 
        "msg": "strncpy() may not null-terminate", 
        "fix": "After strncpy(dest, src, n), add: dest[n-1] = '\\0'"
    },
    "strncat": {
        "severity": 4, 
        "cwe": "CWE-120", 
        "msg": "strncat() needs careful size calculation", 
        "fix": "Replace strncat(dest, src, n) with strlcat(dest, src, sizeof(dest)) if available"
    },
    "memcpy": {
        "severity": 4, 
        "cwe": "CWE-787", 
        "msg": "memcpy() needs length validation", 
        "fix": "Before memcpy(dest, src, len), validate: if (len <= sizeof(dest)) memcpy(dest, src, len)"
    },
    "tmpnam": {
        "severity": 4, 
        "cwe": "CWE-377", 
        "msg": "tmpnam() creates predictable filenames", 
        "fix": "Replace tmpnam(buffer) with mkstemp(template)"
    },
    "mktemp": {
        "severity": 4, 
        "cwe": "CWE-377", 
        "msg": "mktemp() vulnerable to race conditions", 
        "fix": "Replace mktemp(template) with mkstemp(template)"
    },
    "atoi": {
        "severity": 3, 
        "cwe": "CWE-704", 
        "msg": "atoi() has no error reporting", 
        "fix": "Replace atoi(str) with strtol(str, &endptr, 10) and check endptr"
    },
    "atol": {
        "severity": 3, 
        "cwe": "CWE-704", 
        "msg": "atol() has no error reporting", 
        "fix": "Replace atol(str) with strtol(str, &endptr, 10) and check endptr"
    },
    "rand": {
        "severity": 3, 
        "cwe": "CWE-338", 
        "msg": "Predictable random numbers", 
        "fix": "Replace rand() with secure random: getrandom(), /dev/urandom, or cryptographic RNG"
    },
    "printf": {
        "severity": 4, 
        "cwe": "CWE-134", 
        "msg": "printf() vulnerable if format controlled by user", 
        "fix": "Never use printf(user_input). Use printf(\"%s\", user_input) instead"
    },
    "fprintf": {
        "severity": 4, 
        "cwe": "CWE-134", 
        "msg": "fprintf() vulnerable if format controlled by user", 
        "fix": "Never use fprintf(file, user_input). Use fprintf(file, \"%s\", user_input) instead"
    },
}

# Special pattern-based rules with specific fixes
SPECIAL_CPP_PATTERNS = [
    {
        "name": "scanf_no_width",
        "pattern": re.compile(r"\b([sf]?scanf)\s*\([^)]*(%s)(?![0-9])[^)]*\)"),
        "severity": 5,
        "cwe": "CWE-120",
        "msg": "scanf %s without width limit",
        "fix": "Replace %s with width specifier like %99s (for 100-char buffer)"
    },
    {
        "name": "chmod_permissive",
        "pattern": re.compile(r"\bchmod\s*\([^,]+,\s*(0[67][67][67])\s*\)"),
        "severity": 4,
        "cwe": "CWE-732",
        "msg": "Overly permissive file permissions",
        "fix": "Replace with restrictive permissions: 0600 (owner only) or 0644 (owner write, others read)"
    },
    {
        "name": "md5_usage",
        "pattern": re.compile(r"\b(MD5|md5)[_A-Za-z]*\b"),
        "severity": 4,
        "cwe": "CWE-327",
        "msg": "MD5 is cryptographically broken",
        "fix": "Replace MD5 with SHA-256 or SHA-3 for security-critical applications"
    }
]

def severity_to_string(score: int) -> str:
    """Convert numeric severity to string."""
    mapping = {5: "Critical", 4: "High", 3: "Medium", 2: "Low", 1: "Info"}
    return mapping.get(score, "Medium")

def extract_function_context(line: str, func_name: str, column: int) -> str:
    """Extract the actual function call from the line for better remediation."""
    # Try to extract the function call with its arguments
    pattern = rf"{re.escape(func_name)}\s*\([^)]*\)"
    match = re.search(pattern, line[column:])
    if match:
        return line[column:column + match.end()]
    return func_name + "(...)"

def scan_secrets(text: str, filename: str) -> List[FindingModel]:
    """Scan for secrets and credentials - ALL MARKED AS CRITICAL."""
    findings = []
    
    try:
        for line_num, line in enumerate(text.splitlines(), 1):
            if IGNORE_MARKER in line:
                continue
                
            try:
                for pattern_name, pattern in SECRET_PATTERNS.items():
                    for match in pattern.finditer(line):
                        try:
                            secret_value = match.group(0)
                            if match.groups():
                                secret_value = match.group(-1)
                            
                            # Special validation for JWT
                            if pattern_name == "JWT" and not jwt_is_valid(match.group(0)):
                                continue
                            
                            # ALL secrets are CRITICAL
                            confidence = 0.95  # High confidence for pattern matches
                            
                            findings.append(FindingModel(
                                type=pattern_name,
                                category="Secret",
                                severity="Critical",  # ALWAYS Critical
                                severity_score=5,     # ALWAYS 5
                                severity_emoji=SEVERITY_EMOJIS["Critical"],
                                cwe=["CWE-798", "CWE-200"],  # Added CWE-200 for info exposure
                                message=f"{pattern_name} detected - hardcoded credential found",
                                remediation=f"IMMEDIATE ACTION: 1) Remove '{redact_secret(secret_value)}' from code, 2) Rotate this credential immediately, 3) Use environment variables or secret management service",
                                confidence=confidence,
                                confidence_label=get_confidence_label(confidence),
                                file=filename,
                                line=line_num,
                                column=match.start(),
                                snippet=line.strip(),
                                evidence={
                                    "redacted": redact_secret(secret_value),
                                    "pattern_matched": pattern_name
                                },
                                priority_rank=calculate_priority_rank(5, confidence)
                            ))
                        except Exception:
                            continue
                
                # High entropy detection - ALSO CRITICAL for confirmed patterns
                for match in re.finditer(r"[\"']([A-Za-z0-9_\-\/+=]{20,})[\"']", line):
                    try:
                        token = match.group(1)
                        entropy = shannon_entropy(token)
                        
                        # More aggressive for high entropy strings
                        if entropy > 4.5 and (looks_like_b64(token) or looks_like_hex(token)):
                            confidence = 0.85 if entropy > 5.0 else 0.75
                            findings.append(FindingModel(
                                type="HighEntropySecret",
                                category="Secret",
                                severity="Critical",  # Changed from Medium to Critical
                                severity_score=5,     # Changed from 3 to 5
                                severity_emoji=SEVERITY_EMOJIS["Critical"],
                                cwe=["CWE-798", "CWE-200"],
                                message=f"High entropy string detected (entropy: {entropy:.2f}) - likely hardcoded secret",
                                remediation=f"INVESTIGATE: This appears to be a hardcoded secret. 1) Verify if '{redact_secret(token)}' is sensitive, 2) If yes, remove and use environment variables",
                                confidence=confidence,
                                confidence_label=get_confidence_label(confidence),
                                file=filename,
                                line=line_num,
                                column=match.start(),
                                snippet=line.strip(),
                                evidence={
                                    "redacted": redact_secret(token),
                                    "entropy": f"{entropy:.2f}",
                                    "type": "base64" if looks_like_b64(token) else "hex"
                                },
                                priority_rank=calculate_priority_rank(5, confidence)
                            ))
                    except Exception:
                        continue
            except Exception:
                continue
    except Exception:
        return []
    
    return findings

def scan_cpp_vulns(text: str, filename: str) -> List[FindingModel]:
    """Scan for C/C++ vulnerabilities with specific remediation."""
    findings = []
    
    # Check if it looks like C/C++ code
    if not any(keyword in text for keyword in ["#include", "int ", "void ", "char ", "std::", "malloc", "free"]):
        return findings
    
    # Remove comments to avoid false positives
    text_cleaned = re.sub(r"/\*.*?\*/", " ", text, flags=re.DOTALL)
    text_cleaned = re.sub(r"//.*", "", text_cleaned)
    
    lines = text_cleaned.splitlines()
    original_lines = text.splitlines()  # Keep original for snippets
    
    for line_num, (line, orig_line) in enumerate(zip(lines, original_lines), 1):
        if IGNORE_MARKER in line:
            continue
        
        # Check special patterns first
        for special in SPECIAL_CPP_PATTERNS:
            match = special["pattern"].search(line)
            if match:
                # Extract what was matched for better remediation
                matched_text = match.group(0)
                specific_fix = special["fix"]
                
                # Make fix more specific based on what was found
                if special["name"] == "scanf_no_width" and match.group(2):
                    specific_fix = f"Replace '{match.group(2)}' with '%99s' (adjust size to your buffer size)"
                elif special["name"] == "chmod_permissive" and match.group(1):
                    specific_fix = f"Replace '{match.group(1)}' with '0600' for private files or '0644' for public read"
                
                confidence = 0.90
                severity_str = severity_to_string(special["severity"])
                findings.append(FindingModel(
                    type=special["name"],
                    category="C++ Vulnerability",
                    severity=severity_str,
                    severity_score=special["severity"],
                    severity_emoji=SEVERITY_EMOJIS[severity_str],
                    cwe=[special["cwe"]],
                    message=special["msg"],
                    remediation=specific_fix,
                    confidence=confidence,
                    confidence_label=get_confidence_label(confidence),
                    file=filename,
                    line=line_num,
                    column=match.start(),
                    snippet=orig_line.strip(),
                    evidence={
                        "pattern": special["name"],
                        "matched": matched_text[:50]  # First 50 chars of match
                    },
                    priority_rank=calculate_priority_rank(special["severity"], confidence)
                ))
        
        # Function-based patterns with smarter detection
        for func_name, details in CPP_VULN_PATTERNS.items():
            pattern = rf"(?<![A-Za-z0-9_]){re.escape(func_name)}\s*\("
            
            match = re.search(pattern, line)
            if match:
                # Extract the actual function call for context
                func_context = extract_function_context(line, func_name, match.start())
                
                # SMART FILTERING FOR PRINTF/FPRINTF
                # Skip if it's a safe printf/fprintf with literal string only
                if func_name in ["printf", "fprintf"]:
                    # Check if it's a safe format string (no user input)
                    # Look for patterns like printf("literal string") or printf("format", safe_vars)
                    safe_printf_pattern = rf'{func_name}\s*\([^,)]*"[^"]*"[^")]*\)'
                    
                    # Check if format string contains only safe specifiers with matching args
                    if re.match(safe_printf_pattern, func_context):
                        # Check if there's no user-controlled data
                        if not any(dangerous in func_context for dangerous in [
                            'buffer', 'input', 'user', 'data', 'str[', 'buf[', 
                            'argv', 'gets', 'scanf', 'fgets', 'read'
                        ]):
                            # Check if the format string doesn't have %s with external data
                            if '%s' in func_context:
                                # Only flag if %s is used with potentially unsafe data
                                if not re.search(r'%s.*\b(img\.|buff|data|input|user)', func_context):
                                    continue  # Skip safe printf calls
                            else:
                                continue  # Skip if no %s or user data
                
                # Create more specific remediation
                specific_remediation = details["fix"]
                if func_context != func_name + "(...)":
                    specific_remediation = f"In '{func_context[:80]}...': {details['fix']}"
                
                confidence = 0.85 if func_name in ["printf", "fprintf"] else 0.90
                severity_str = severity_to_string(details["severity"])
                findings.append(FindingModel(
                    type=func_name,
                    category="C++ Vulnerability",
                    severity=severity_str,
                    severity_score=details["severity"],
                    severity_emoji=SEVERITY_EMOJIS[severity_str],
                    cwe=[details["cwe"]],
                    message=f"{details['msg']} in {func_context[:80]}",
                    remediation=specific_remediation,
                    confidence=confidence,
                    confidence_label=get_confidence_label(confidence),
                    file=filename,
                    line=line_num,
                    column=match.start(),
                    snippet=orig_line.strip()[:100],
                    evidence={
                        "function": func_name,
                        "context": func_context[:100]
                    },
                    priority_rank=calculate_priority_rank(details["severity"], confidence)
                ))
    
    return findings

def scan_text_content(content: str, filename: str, scan_types: List[str]) -> List[FindingModel]:
    """Main scanning orchestrator."""
    all_findings = []
    
    try:
        if "secrets" in scan_types:
            try:
                all_findings.extend(scan_secrets(content, filename))
            except Exception as e:
                print(f"Error in secret scanning: {str(e)}")
        
        if "cpp_vulns" in scan_types:
            try:
                all_findings.extend(scan_cpp_vulns(content, filename))
            except Exception as e:
                print(f"Error in C++ vulnerability scanning: {str(e)}")
        
        # Remove duplicates
        seen = set()
        unique_findings = []
        for finding in all_findings:
            key = (finding.file, finding.line, finding.type)
            if key not in seen:
                seen.add(key)
                unique_findings.append(finding)
        
        # Sort by priority rank (urgent first), then severity, then line
        unique_findings.sort(key=lambda x: (x.priority_rank, -x.severity_score, x.line))
        
        return unique_findings
    except Exception as e:
        print(f"Unexpected error in scan_text_content: {str(e)}")
        return []

def is_binary_file(content: bytes) -> bool:
    """Check if file content is binary."""
    if b"\x00" in content[:1024]:
        return True
    try:
        content[:1024].decode('utf-8')
        return False
    except UnicodeDecodeError:
        return True

def scan_file_parallel(file_info: Tuple[Path, Path, List[str], float]) -> List[FindingModel]:
    """Scan a single file - used for parallel processing."""
    fpath, base_path, scan_types, max_size_mb = file_info
    
    # Skip if file is too large
    if fpath.stat().st_size > max_size_mb * 1024 * 1024:
        return []
    
    if fpath.suffix.lower() not in ALL_EXTS:
        return []
    
    try:
        file_content = fpath.read_bytes()
        if is_binary_file(file_content):
            return []
        
        text = file_content.decode('utf-8', errors='ignore')
        rel_path = str(fpath.relative_to(base_path))
        return scan_text_content(text, rel_path, scan_types)
    except Exception:
        return []

def create_summary(findings: List[FindingModel]) -> Dict[str, int]:
    """Create findings summary - legacy format for compatibility."""
    summary = {"TOTAL": len(findings)}
    
    # Count by severity
    for finding in findings:
        summary[finding.type] = summary.get(finding.type, 0) + 1
        summary[f"severity_{finding.severity.lower()}"] = summary.get(f"severity_{finding.severity.lower()}", 0) + 1
        summary[f"category_{finding.category.replace(' ', '_').lower()}"] = summary.get(f"category_{finding.category.replace(' ', '_').lower()}", 0) + 1
    
    # Add critical count at the top for visibility
    critical_count = summary.get("severity_critical", 0)
    if critical_count > 0:
        summary["CRITICAL_ISSUES"] = critical_count
    
    return summary

def create_enhanced_response(
    method: str,
    scan_types: List[str],
    findings: List[FindingModel],
    stats: Dict[str, Union[int, str]],
    start_time: Optional[datetime] = None
) -> ScanResponse:
    """Create enhanced scan response with all visual improvements."""
    
    # Calculate scan duration if start_time provided
    scan_duration_ms = None
    if start_time:
        duration = (datetime.now() - start_time).total_seconds() * 1000
        scan_duration_ms = int(duration)
    
    # Create severity distribution
    severity_dist = SeverityDistribution(
        critical=sum(1 for f in findings if f.severity_score == 5),
        high=sum(1 for f in findings if f.severity_score == 4),
        medium=sum(1 for f in findings if f.severity_score == 3),
        low=sum(1 for f in findings if f.severity_score == 2),
        info=sum(1 for f in findings if f.severity_score == 1)
    )
    
    # Create category breakdown
    category_breakdown = CategoryBreakdown(
        secrets=sum(1 for f in findings if f.category == "Secret"),
        cpp_vulnerabilities=sum(1 for f in findings if f.category == "C++ Vulnerability")
    )
    
    # Get critical findings (top 5)
    critical_findings = [f for f in findings if f.severity_score == 5][:5]
    
    # Determine risk level
    risk_level, risk_emoji = determine_risk_level(findings)
    
    # Create executive summary
    exec_summary = ExecutiveSummary(
        risk_level=risk_level,
        risk_emoji=risk_emoji,
        total_issues=len(findings),
        files_affected=len(set(f.file for f in findings)),
        critical_issues=severity_dist.critical,
        immediate_actions_required=sum(1 for f in findings if f.priority_rank == 1),
        estimated_fix_time=estimate_fix_time(findings),
        top_risks=get_top_risks(findings),
        compliance_concerns=get_compliance_concerns(findings)
    )
    
    # Create detailed stats
    detailed_stats = DetailedStats(
        scan_duration_ms=scan_duration_ms,
        files_scanned=stats.get("files_scanned", 0),
        total_lines_analyzed=stats.get("lines_scanned", 0),
        scan_coverage=f"{stats.get('files_scanned', 0)} files analyzed",
        performance_notes=[]
    )
    
    if scan_duration_ms and scan_duration_ms < 1000:
        detailed_stats.performance_notes.append("✅ Fast scan completed")
    elif scan_duration_ms and scan_duration_ms > 60000:
        detailed_stats.performance_notes.append("⚡ Large codebase scanned")
    
    # Create the response
    response = ScanResponse(
        scan_id=generate_scan_id(),
        timestamp=datetime.now().isoformat(),
        method=method,
        scan_types=scan_types,
        executive_summary=exec_summary,
        total_findings=len(findings),
        findings=findings,
        severity_distribution=severity_dist,
        category_breakdown=category_breakdown,
        critical_findings=critical_findings,
        most_affected_files=get_most_affected_files(findings),
        risk_matrix=create_risk_matrix(findings),
        summary=create_summary(findings),  # Legacy field
        stats=stats,
        recommendations=generate_recommendations(findings),
        next_steps=generate_next_steps(findings)
    )
    
    return response


def add_page_numbers(canvas_obj, doc):
    """Add page numbers and footer to PDF."""
    canvas_obj.saveState()
    canvas_obj.setFont('Helvetica', 8)
    page_num = canvas_obj.getPageNumber()
    canvas_obj.drawRightString(7.5*inch, 0.5*inch, f"Page {page_num}")
    canvas_obj.drawString(inch, 0.5*inch, "LLMShield Security Report")
    canvas_obj.drawCentredString(4.25*inch, 0.5*inch, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    canvas_obj.restoreState()

def get_severity_color(severity: str) -> colors.Color:
    """Get background color for severity."""
    color_map = {
        "Critical": colors.HexColor('#ffe6e6'),
        "High": colors.HexColor('#fff3e6'),
        "Medium": colors.HexColor('#fffbe6'),
        "Low": colors.HexColor('#e6f3ff'),
        "Info": colors.HexColor('#f5f5f5')
    }
    return color_map.get(severity, colors.white)

def generate_pdf_report(scan_response: ScanResponse) -> bytes:
    """Generate professional ISO-style PDF report with optimized layout."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch,
        leftMargin=0.75*inch,
        rightMargin=0.75*inch
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=26,
        textColor=colors.HexColor('#1a472a'),
        spaceAfter=8,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=colors.HexColor('#2ecc71'),
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=13,
        textColor=colors.white,
        spaceAfter=10,
        spaceBefore=15,
        fontName='Helvetica-Bold',
        backColor=colors.HexColor('#34495e'),
        leftIndent=10,
        rightIndent=10,
        leading=18
    )
    
    subheading_style = ParagraphStyle(
        'SubHeading',
        parent=styles['Heading3'],
        fontSize=11,
        textColor=colors.HexColor('#2c3e50'),
        spaceAfter=8,
        spaceBefore=10,
        fontName='Helvetica-Bold'
    )
    
    info_style = ParagraphStyle(
        'InfoText',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#34495e'),
        alignment=TA_LEFT,
        leading=12
    )
    
    # ==================== COVER PAGE ====================
    story.append(Spacer(1, 1*inch))
    
    # Logo
    try:
        from reportlab.platypus import Image
        logo = Image('llmshield_logo.png', width=2.5*inch, height=0.8*inch)
        logo.hAlign = 'CENTER'
        story.append(logo)
        story.append(Spacer(1, 0.3*inch))
    except:
        logo_text = Paragraph(
            '<font size=28 color="#2ecc71"><b>LLM</b></font><font size=28><b>Shield</b></font>',
            ParagraphStyle('Logo', alignment=TA_CENTER)
        )
        story.append(logo_text)
        story.append(Spacer(1, 0.2*inch))
    
    # Title
    story.append(Paragraph("SECURITY ASSESSMENT REPORT", title_style))
    story.append(Paragraph("Comprehensive Vulnerability Analysis", subtitle_style))
    
    story.append(Spacer(1, 0.5*inch))
    
    # Cover Info
    exec_sum = scan_response.executive_summary
    risk_color = {
        'CRITICAL': colors.HexColor('#e74c3c'),
        'HIGH': colors.HexColor('#e67e22'),
        'MEDIUM': colors.HexColor('#f39c12'),
        'LOW': colors.HexColor('#3498db'),
        'SAFE': colors.HexColor('#2ecc71')
    }.get(exec_sum.risk_level, colors.grey)
    
    cover_info = [
        ['Scan Method:', scan_response.method.upper()],
        ['Assessment Date:', scan_response.timestamp[:10]],
        ['Scan Type:', ', '.join(scan_response.scan_types).upper()],
        ['Scan ID:', scan_response.scan_id],
        ['', ''],
        ['Overall Risk Level:', exec_sum.risk_level],
    ]
    
    cover_table = Table(cover_info, colWidths=[2.2*inch, 3.8*inch])
    cover_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TEXTCOLOR', (1, 5), (1, 5), risk_color),
        ('FONTSIZE', (1, 5), (1, 5), 16),
        ('FONTNAME', (1, 5), (1, 5), 'Helvetica-Bold'),
        ('LINEBELOW', (0, 4), (-1, 4), 1, colors.grey),
    ]))
    
    story.append(cover_table)
    story.append(Spacer(1, 0.8*inch))
    
    # Key Metrics Box
    metrics_data = [
        ['Total Issues', 'Files Affected', 'Critical Issues'],
        [str(exec_sum.total_issues), str(exec_sum.files_affected), str(exec_sum.critical_issues)]
    ]
    
    metrics_table = Table(metrics_data, colWidths=[2*inch, 2*inch, 2*inch])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, 1), 16),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 1), (-1, 1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#ecf0f1')),
    ]))
    story.append(metrics_table)
    
    story.append(Spacer(1, 0.3*inch))
    conf_text = Paragraph(
        '<i>CONFIDENTIAL - This report contains sensitive security information</i>',
        ParagraphStyle('Conf', parent=info_style, alignment=TA_CENTER, textColor=colors.grey, fontSize=8)
    )
    story.append(conf_text)
    
    story.append(PageBreak())
    
    # ==================== EXECUTIVE SUMMARY (Compact) ====================
    story.append(Paragraph("Executive Summary", heading_style))
    story.append(Spacer(1, 0.15*inch))
    
    # Two column layout for charts
    from reportlab.platypus import Table as PLTable
    from reportlab.graphics.shapes import Drawing
    from reportlab.graphics.charts.piecharts import Pie
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    
    # Severity Pie Chart
    sev_dist = scan_response.severity_distribution
    pie_drawing = Drawing(280, 180)
    
    pie = Pie()
    pie.x = 60
    pie.y = 20
    pie.width = 100
    pie.height = 100
    
    pie_data = []
    pie_labels = []
    pie_colors = []
    
    severity_items = [
        (sev_dist.critical, 'Critical', colors.HexColor('#e74c3c')),
        (sev_dist.high, 'High', colors.HexColor('#e67e22')),
        (sev_dist.medium, 'Medium', colors.HexColor('#f39c12')),
        (sev_dist.low, 'Low', colors.HexColor('#3498db')),
        (sev_dist.info, 'Info', colors.HexColor('#95a5a6'))
    ]
    
    for count, label, color in severity_items:
        if count > 0:
            pie_data.append(count)
            pie_labels.append(f'{label}: {count}')
            pie_colors.append(color)
    
    pie.data = pie_data
    pie.labels = pie_labels
    pie.slices.strokeWidth = 0.5
    pie.slices.fontSize = 8
    
    for i, color in enumerate(pie_colors):
        pie.slices[i].fillColor = color
    
    pie_drawing.add(pie)
    
    # Bar Chart
    cat_break = scan_response.category_breakdown
    bar_drawing = Drawing(280, 180)
    
    bc = VerticalBarChart()
    bc.x = 40
    bc.y = 30
    bc.height = 110
    bc.width = 200
    bc.data = [[cat_break.secrets, cat_break.cpp_vulnerabilities]]
    
    bc.categoryAxis.categoryNames = ['Secrets', 'C++ Vulns']
    bc.categoryAxis.labels.fontSize = 8
    bc.categoryAxis.labels.angle = 0
    bc.categoryAxis.labels.boxAnchor = 'n'
    
    bc.valueAxis.valueMin = 0
    bc.valueAxis.valueMax = max(cat_break.secrets, cat_break.cpp_vulnerabilities, 1) * 1.2
    bc.valueAxis.labels.fontSize = 8
    
    bc.bars[0].fillColor = colors.HexColor('#e74c3c')
    bc.bars.strokeColor = colors.black
    bc.bars.strokeWidth = 0.5
    
    bar_drawing.add(bc)
    
    # Side by side charts
    chart_table = PLTable(
        [[Paragraph("<b>Severity Distribution</b>", subheading_style), 
          Paragraph("<b>Issue Categories</b>", subheading_style)],
         [pie_drawing, bar_drawing]],
        colWidths=[3*inch, 3*inch]
    )
    chart_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    
    story.append(chart_table)
    story.append(Spacer(1, 0.2*inch))
    
    # ==================== RISK ASSESSMENT ====================
    story.append(Paragraph("Risk Assessment & Compliance", heading_style))
    story.append(Spacer(1, 0.1*inch))
    
    if exec_sum.top_risks:
        risk_text = "<b>Top Risk Areas:</b> " + ", ".join(exec_sum.top_risks[:3])
        story.append(Paragraph(risk_text, info_style))
        story.append(Spacer(1, 0.08*inch))
    
    if exec_sum.compliance_concerns:
        compliance_text = "<b>CWE Violations:</b> " + ", ".join(exec_sum.compliance_concerns[:5])
        story.append(Paragraph(compliance_text, info_style))
    
    story.append(Spacer(1, 0.2*inch))
    
    # ==================== RECOMMENDATIONS (Compact) ====================
    story.append(Paragraph("Strategic Recommendations", heading_style))
    story.append(Spacer(1, 0.1*inch))
    
    for idx, rec in enumerate(scan_response.recommendations[:5], 1):
        clean_rec = rec.replace('🔴', '[CRITICAL]').replace('🟠', '[HIGH]').replace('🛡️', '').replace('📋', '').replace('🔍', '')
        rec_text = Paragraph(f"<b>{idx}.</b> {clean_rec}", info_style)
        story.append(rec_text)
        story.append(Spacer(1, 0.08*inch))
    
    story.append(Spacer(1, 0.15*inch))
    
    # ==================== NEXT STEPS (Compact) ====================
    story.append(Paragraph("Immediate Next Steps", heading_style))
    story.append(Spacer(1, 0.1*inch))
    
    for step in scan_response.next_steps[:5]:
        clean_step = step.replace('📧', '').replace('🔴', '').replace('🟠', '')
        step_text = Paragraph(f"• {clean_step}", info_style)
        story.append(step_text)
        story.append(Spacer(1, 0.08*inch))
    
    # ==================== MOST AFFECTED FILES ====================
    if scan_response.most_affected_files:
        story.append(Spacer(1, 0.15*inch))
        story.append(Paragraph("Most Affected Files", heading_style))
        story.append(Spacer(1, 0.1*inch))
        
        file_data = [['File', 'Issues', 'Critical', 'High']]
        for file_issue in scan_response.most_affected_files[:8]:
            file_data.append([
                Paragraph(file_issue.filename[-35:], info_style),
                str(file_issue.issue_count),
                str(file_issue.critical_count),
                str(file_issue.high_count)
            ])
        
        file_table = PLTable(file_data, colWidths=[3.5*inch, 0.8*inch, 0.8*inch, 0.8*inch])
        file_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')])
        ]))
        story.append(file_table)
    
    # ==================== DETAILED FINDINGS ====================
    if scan_response.findings:
        story.append(PageBreak())
        story.append(Paragraph("Detailed Findings", heading_style))
        story.append(Spacer(1, 0.15*inch))
        
        for idx, finding in enumerate(scan_response.findings, 1):
            finding_box_data = [
                [Paragraph(f"<b>Finding #{idx}: {finding.type}</b>", info_style), 
                 Paragraph(f"<b>Severity: {finding.severity}</b>", info_style)],
                [Paragraph(f"<b>File:</b> {finding.file}", info_style), 
                 Paragraph(f"<b>Line:</b> {finding.line}", info_style)],
                [Paragraph(f"<b>Confidence:</b> {finding.confidence_label} ({finding.confidence:.0%})", info_style),
                Paragraph(f"<b>Priority:</b> Rank {finding.priority_rank}/5", info_style)],
                [Paragraph('<b>Message:</b>', info_style), 
                 Paragraph(finding.message, info_style)],
                [Paragraph('<b>Remediation:</b>', info_style), 
                 Paragraph(finding.remediation[:150] + ('...' if len(finding.remediation) > 150 else ''), info_style)]
            ]
            
            finding_table = PLTable(finding_box_data, colWidths=[1.3*inch, 4.7*inch])
            severity_bg = get_severity_color(finding.severity)
            finding_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), severity_bg), 
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'TOP')
            ]))
            
            story.append(finding_table)
            story.append(Spacer(1, 0.12*inch))
            
            if idx % 6 == 0 and idx < len(scan_response.findings):
                story.append(PageBreak())
        
        
    
    # Build PDF
    doc.build(story, onFirstPage=add_page_numbers, onLaterPages=add_page_numbers)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
# =========================
# API Endpoints
# =========================

@router.get("/")
async def scanner_info():
    """Scanner information and capabilities."""
    return {
        "name": "LLMShield Security Scanner",
        "version": "3.0.0",
        "improvements": [
            "🎨 Enhanced visual reporting with emojis and severity indicators",
            "📊 Executive summary with risk assessment",
            "📈 Detailed analytics and risk matrices",
            "🎯 Priority-based finding rankings",
            "💡 Actionable recommendations and next steps",
            "📋 File-level issue aggregation",
            "⏱️ Performance metrics and scan duration tracking",
            "🔍 Confidence scores and labels for each finding"
        ],
        "capabilities": {
            "secrets": {
                "patterns": len(SECRET_PATTERNS),
                "types": ["AWS keys", "API tokens", "SSH keys", "JWT", "High entropy strings"],
                "severity": "ALL CRITICAL (🔴)"
            },
            "cpp_vulnerabilities": {
                "patterns": len(CPP_VULN_PATTERNS) + len(SPECIAL_CPP_PATTERNS),
                "types": ["Buffer overflows", "Format strings", "Command injection", "Weak crypto"],
                "severity_range": "🔵 Low to 🔴 Critical"
            }
        },
        "reporting_features": {
            "executive_summary": "High-level risk assessment with business impact",
            "visual_indicators": "Color-coded severity with emoji indicators",
            "priority_ranking": "Issues ranked by urgency (1-5 scale)",
            "recommendations": "Actionable fix suggestions prioritized by risk",
            "compliance_tracking": "CWE mapping for security standards",
            "performance_metrics": "Scan duration and coverage statistics"
        },
        "endpoints": [
            "POST /text - Scan pasted text",
            "POST /upload - Upload file/ZIP", 
            "POST /github - Clone and scan repository (optimized)"
        ],
        "supported_files": list(ALL_EXTS),
        "ignore_syntax": "Add '// LLMShield: ignore' to suppress findings",
        "git_available": _GIT_OK
    }

@router.post("/text", response_model=ScanResponse)
async def scan_text(
    request: TextScanRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Scan pasted text content."""
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    
    valid_types = {"secrets", "cpp_vulns"}
    if not all(t in valid_types for t in request.scan_types):
        raise HTTPException(status_code=400, detail=f"Invalid scan types. Must be subset of: {valid_types}")
    
    try:
        start_time = datetime.now()
        findings = scan_text_content(request.content, request.filename, request.scan_types)
        
        stats = {
            "lines_scanned": len(request.content.splitlines()),
            "content_size_bytes": len(request.content.encode('utf-8')),
            "scan_method": "text_paste",
            "user": current_user.email
        }
        
        response = create_enhanced_response(
            method="text",
            scan_types=request.scan_types,
            findings=findings,
            stats=stats,
            start_time=start_time
        )
        
        # Save scan to history
        print(f"DEBUG: Attempting to save scan to history for user {current_user.id}")
        try:
            await save_scan_to_history(
                user_id=str(current_user.id),
                scan_response=response,
                input_type="text",
                input_size=len(request.content.encode('utf-8'))
            )
            print(f"DEBUG: Successfully saved scan to history for user {current_user.id}")
        except Exception as history_error:
            print(f"Warning: Failed to save scan to history: {str(history_error)}")
            import traceback
            traceback.print_exc()
            # Continue with the response even if history saving fails
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

@router.post("/upload", response_model=ScanResponse)
async def scan_upload(
    file: UploadFile = File(...),
    scan_types: str = "secrets,cpp_vulns",
    current_user: UserInDB = Depends(get_current_user)
):
    """Upload and scan file or ZIP archive."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename required")
    
    scan_types_list = [t.strip() for t in scan_types.split(",") if t.strip()]
    if not scan_types_list:
        scan_types_list = ["secrets", "cpp_vulns"]
    
    valid_types = {"secrets", "cpp_vulns"}
    if not all(t in valid_types for t in scan_types_list):
        raise HTTPException(status_code=400, detail=f"Invalid scan types. Must be subset of: {valid_types}")
    
    try:
        start_time = datetime.now()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            uploaded_file = temp_path / file.filename
            
            content = await file.read()
            uploaded_file.write_bytes(content)
            
            findings = []
            stats = {"file_size": len(content), "upload_filename": file.filename}
            
            if uploaded_file.suffix.lower() == ".zip":
                try:
                    with zipfile.ZipFile(uploaded_file, 'r') as zip_ref:
                        extract_path = temp_path / "extracted"
                        zip_ref.extractall(extract_path)
                        
                        # Collect files to scan
                        files_to_scan = []
                        for root, _, files in os.walk(extract_path):
                            for fname in files:
                                fpath = Path(root) / fname
                                if fpath.suffix.lower() in ALL_EXTS and fpath.stat().st_size < MAX_FILE_SIZE:
                                    files_to_scan.append((fpath, extract_path, scan_types_list, 1.0))
                        
                        # Parallel scanning for better performance
                        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                            results = executor.map(scan_file_parallel, files_to_scan)
                            for file_findings in results:
                                findings.extend(file_findings)
                        
                        stats["archive_type"] = "zip"
                        stats["files_scanned"] = len(files_to_scan)
                        stats["total_files_in_archive"] = sum(1 for _ in extract_path.rglob("*") if _.is_file())
                except zipfile.BadZipFile:
                    raise HTTPException(status_code=400, detail="Invalid ZIP file")
            else:
                if not is_binary_file(content):
                    text = content.decode('utf-8', errors='ignore')
                    findings = scan_text_content(text, file.filename, scan_types_list)
                    stats["lines_scanned"] = len(text.splitlines())
                else:
                    raise HTTPException(status_code=400, detail="Binary files not supported")
                stats["is_binary"] = False
                stats["files_scanned"] = 1
            
            response = create_enhanced_response(
                method="upload",
                scan_types=scan_types_list,
                findings=findings,
                stats=stats,
                start_time=start_time
            )
            
            # Save scan to history
            print(f"DEBUG: Attempting to save scan to history for user {current_user.id}")
            try:
                await save_scan_to_history(
                    user_id=str(current_user.id),
                    scan_response=response,
                    input_type="file_upload",
                    input_size=len(content)
                )
                print(f"DEBUG: Successfully saved scan to history for user {current_user.id}")
            except Exception as history_error:
                print(f"Warning: Failed to save scan to history: {str(history_error)}")
                import traceback
                traceback.print_exc()
                # Continue with the response even if history saving fails
            
            return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload scan failed: {str(e)}")

@router.post("/text/pdf")
async def scan_text_pdf(request: TextScanRequest):
    """Scan text and return PDF report."""
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    
    valid_types = {"secrets", "cpp_vulns"}
    if not all(t in valid_types for t in request.scan_types):
        raise HTTPException(status_code=400, detail=f"Invalid scan types. Must be subset of: {valid_types}")
    
    try:
        start_time = datetime.now()
        findings = scan_text_content(request.content, request.filename, request.scan_types)
        
        stats = {
            "lines_scanned": len(request.content.splitlines()),
            "content_size_bytes": len(request.content.encode('utf-8')),
            "scan_method": "text_paste"
        }
        
        scan_response = create_enhanced_response(
            method="text",
            scan_types=request.scan_types,
            findings=findings,
            stats=stats,
            start_time=start_time
        )
        
        pdf_bytes = generate_pdf_report(scan_response)
        
        from fastapi.responses import Response
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=security_report_{scan_response.scan_id}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


@router.post("/upload/pdf")
async def scan_upload_pdf(
    file: UploadFile = File(...),
    scan_types: str = "secrets,cpp_vulns"
):
    """Upload file and return PDF report."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename required")
    
    scan_types_list = [t.strip() for t in scan_types.split(",") if t.strip()]
    if not scan_types_list:
        scan_types_list = ["secrets", "cpp_vulns"]
    
    valid_types = {"secrets", "cpp_vulns"}
    if not all(t in valid_types for t in scan_types_list):
        raise HTTPException(status_code=400, detail=f"Invalid scan types. Must be subset of: {valid_types}")
    
    try:
        start_time = datetime.now()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            uploaded_file = temp_path / file.filename
            
            content = await file.read()
            uploaded_file.write_bytes(content)
            
            findings = []
            stats = {"file_size": len(content), "upload_filename": file.filename}
            
            if uploaded_file.suffix.lower() == ".zip":
                try:
                    with zipfile.ZipFile(uploaded_file, 'r') as zip_ref:
                        extract_path = temp_path / "extracted"
                        zip_ref.extractall(extract_path)
                        
                        files_to_scan = []
                        for root, _, files in os.walk(extract_path):
                            for fname in files:
                                fpath = Path(root) / fname
                                if fpath.suffix.lower() in ALL_EXTS and fpath.stat().st_size < MAX_FILE_SIZE:
                                    files_to_scan.append((fpath, extract_path, scan_types_list, 1.0))
                        
                        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                            results = executor.map(scan_file_parallel, files_to_scan)
                            for file_findings in results:
                                findings.extend(file_findings)
                        
                        stats["archive_type"] = "zip"
                        stats["files_scanned"] = len(files_to_scan)
                        stats["total_files_in_archive"] = sum(1 for _ in extract_path.rglob("*") if _.is_file())
                except zipfile.BadZipFile:
                    raise HTTPException(status_code=400, detail="Invalid ZIP file")
            else:
                if not is_binary_file(content):
                    text = content.decode('utf-8', errors='ignore')
                    findings = scan_text_content(text, file.filename, scan_types_list)
                    stats["lines_scanned"] = len(text.splitlines())
                else:
                    raise HTTPException(status_code=400, detail="Binary files not supported")
                stats["is_binary"] = False
                stats["files_scanned"] = 1
            
            scan_response = create_enhanced_response(
                method="upload",
                scan_types=scan_types_list,
                findings=findings,
                stats=stats,
                start_time=start_time
            )
            
            pdf_bytes = generate_pdf_report(scan_response)
            
            from fastapi.responses import Response
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=security_report_{scan_response.scan_id}.pdf"}
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
    
@router.post("/github", response_model=ScanResponse)
async def scan_github(
    request: RepoScanRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Clone and scan GitHub repository - HIGHLY OPTIMIZED VERSION."""
    if not _GIT_OK:
        raise HTTPException(status_code=500, detail="Git not available. Install gitpython: pip install gitpython")
    
    valid_types = {"secrets", "cpp_vulns"}
    if not all(t in valid_types for t in request.scan_types):
        raise HTTPException(status_code=400, detail=f"Invalid scan types. Must be subset of: {valid_types}")
    # Check cache first
    if request.use_cache:
        cache_key = get_repo_cache_key(request.repo_url, request.branch, request.scan_types)
        cached = get_cached_scan(cache_key)
        if cached:
            return ScanResponse(**cached)
    max_file_size_mb = request.max_file_size_mb or 0.5  # Reduced default to 0.5MB
    max_files = request.max_files or 200  # Reduced default to 200 files
    
    try:
        start_time = datetime.now()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            repo_path = Path(temp_dir) / "repo"
            
            # Handle private repos with token
            repo_url = request.repo_url
            if request.token and repo_url.startswith("https://"):
                repo_url = repo_url.replace("https://", f"https://{request.token}@")
            
            # Clone repository with minimal depth and no tags
            print(f"Cloning {request.repo_url} (shallow)...")
            Repo.clone_from(
                repo_url, 
                repo_path, 
                branch=request.branch, 
                depth=1,  # Shallow clone
                single_branch=True,  # Only clone specified branch
                no_tags=True  # Don't fetch tags
            )
            
            scan_target = repo_path / (request.subdir or "")
            if not scan_target.exists():
                raise HTTPException(status_code=400, detail=f"Subdirectory not found: {request.subdir}")
            
            # Pre-filter files more aggressively
            files_to_scan = []
            files_checked = 0
            files_skipped = 0
            
            # Prioritize certain file types for scanning
            priority_exts = {".c", ".cc", ".cpp", ".h", ".env", ".key", ".pem", ".cfg", ".ini"}
            secondary_exts = ALL_EXTS - priority_exts
            
            # First pass: priority files
            for root, dirs, files in os.walk(scan_target):
                # Skip even more directories for speed
                dirs[:] = [d for d in dirs if d not in {
                    ".git", "node_modules", "__pycache__", ".vscode", 
                    "build", "dist", "vendor", ".idea", "target", 
                    "bin", "obj", ".gradle", ".mvn", "out", "cmake-build",
                    "deps", "external", "third_party", "packages",
                    ".tox", ".pytest_cache", ".coverage", "htmlcov",
                    "docs", "documentation", "test", "tests", "spec"
                }]
                
                for fname in files:
                    if files_checked >= max_files:
                        break
                        
                    fpath = Path(root) / fname
                    files_checked += 1
                    
                    # Quick size check
                    try:
                        file_stat = fpath.stat()
                        if file_stat.st_size == 0:  # Skip empty files
                            files_skipped += 1
                            continue
                        if file_stat.st_size > max_file_size_mb * 1024 * 1024:
                            files_skipped += 1
                            continue
                    except:
                        continue
                    
                    # Extension check with priority
                    if fpath.suffix.lower() in priority_exts:
                        files_to_scan.append((fpath, repo_path, request.scan_types, max_file_size_mb))
                    elif fpath.suffix.lower() in secondary_exts and len(files_to_scan) < max_files // 2:
                        files_to_scan.append((fpath, repo_path, request.scan_types, max_file_size_mb))
                
                if files_checked >= max_files:
                    break
            
            print(f"Scanning {len(files_to_scan)} files (checked {files_checked}, skipped {files_skipped})...")
            
            # Batch processing for better performance
            findings = []
            batch_size = 20  # Process files in batches
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:  # Increased workers
                # Submit jobs in batches to avoid overwhelming the system
                for i in range(0, len(files_to_scan), batch_size):
                    batch = files_to_scan[i:i+batch_size]
                    
                    # Use shorter timeout for individual files
                    future_to_file = {
                        executor.submit(scan_file_parallel, file_info): file_info 
                        for file_info in batch
                    }
                    
                    # Collect results with timeout
                    for future in concurrent.futures.as_completed(future_to_file, timeout=30):
                        try:
                            file_findings = future.result(timeout=2)  # 2 second timeout per file
                            if file_findings:
                                findings.extend(file_findings)
                        except (concurrent.futures.TimeoutError, Exception):
                            continue
            
            # Deduplicate and sort findings
            seen = set()
            unique_findings = []
            for finding in findings:
                key = (finding.file, finding.line, finding.type)
                if key not in seen:
                    seen.add(key)
                    unique_findings.append(finding)
            
            # Sort by priority rank and severity
            unique_findings.sort(key=lambda x: (x.priority_rank, -x.severity_score, x.file, x.line))
            
            # Limit total findings to prevent huge responses
            max_findings = 500
            truncated = len(unique_findings) > max_findings
            if truncated:
                unique_findings = unique_findings[:max_findings]
            
            stats = {
                "repo_url": request.repo_url,
                "branch": request.branch or "default",
                "files_scanned": len(files_to_scan),
                "files_checked": files_checked,
                "files_skipped": files_skipped,
                "max_file_size_mb": max_file_size_mb,
                "max_files": max_files,
                "performance": "optimized_parallel_scanning",
                "truncated": truncated,
                "scan_method": "github_clone"
            }
            
            scan_response = create_enhanced_response(
            method="github",
            scan_types=request.scan_types,
            findings=unique_findings,
            stats=stats,
            start_time=start_time
        )

        # ✅ Save to cache before returning
        if request.use_cache:
            cache_key = get_repo_cache_key(request.repo_url, request.branch, request.scan_types)
            cache_scan(cache_key, scan_response.dict())

        # Save scan to history
        print(f"DEBUG: Attempting to save scan to history for user {current_user.id}")
        try:
            await save_scan_to_history(
                user_id=str(current_user.id),
                scan_response=scan_response,
                input_type="github_repo",
                input_size=len(request.repo_url)
            )
            print(f"DEBUG: Successfully saved scan to history for user {current_user.id}")
        except Exception as e:
            print(f"Warning: Failed to save scan to history: {e}")
            import traceback
            traceback.print_exc()

        return scan_response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub scan failed: {str(e)[:200]}")

@router.post("/github/pdf")
async def scan_github_pdf(request: RepoScanRequest):
    """Clone GitHub repository and return PDF report."""
    if not _GIT_OK:
        raise HTTPException(status_code=500, detail="Git not available. Install gitpython: pip install gitpython")
    
    valid_types = {"secrets", "cpp_vulns"}
    if not all(t in valid_types for t in request.scan_types):
        raise HTTPException(status_code=400, detail=f"Invalid scan types. Must be subset of: {valid_types}")
    
    max_file_size_mb = request.max_file_size_mb or 0.5
    max_files = request.max_files or 200
    
    try:
        start_time = datetime.now()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            repo_path = Path(temp_dir) / "repo"
            
            repo_url = request.repo_url
            if request.token and repo_url.startswith("https://"):
                repo_url = repo_url.replace("https://", f"https://{request.token}@")
            
            Repo.clone_from(
                repo_url, 
                repo_path, 
                branch=request.branch, 
                depth=1,
                single_branch=True,
                no_tags=True
            )
            
            scan_target = repo_path / (request.subdir or "")
            if not scan_target.exists():
                raise HTTPException(status_code=400, detail=f"Subdirectory not found: {request.subdir}")
            
            files_to_scan = []
            files_checked = 0
            files_skipped = 0
            
            priority_exts = {".c", ".cc", ".cpp", ".h", ".env", ".key", ".pem", ".cfg", ".ini"}
            secondary_exts = ALL_EXTS - priority_exts
            
            for root, dirs, files in os.walk(scan_target):
                dirs[:] = [d for d in dirs if d not in {
                    ".git", "node_modules", "__pycache__", ".vscode", 
                    "build", "dist", "vendor", ".idea", "target", 
                    "bin", "obj", ".gradle", ".mvn", "out", "cmake-build",
                    "deps", "external", "third_party", "packages",
                    ".tox", ".pytest_cache", ".coverage", "htmlcov",
                    "docs", "documentation", "test", "tests", "spec"
                }]
                
                for fname in files:
                    if files_checked >= max_files:
                        break
                        
                    fpath = Path(root) / fname
                    files_checked += 1
                    
                    try:
                        file_stat = fpath.stat()
                        if file_stat.st_size == 0:
                            files_skipped += 1
                            continue
                        if file_stat.st_size > max_file_size_mb * 1024 * 1024:
                            files_skipped += 1
                            continue
                    except:
                        continue
                    
                    if fpath.suffix.lower() in priority_exts:
                        files_to_scan.append((fpath, repo_path, request.scan_types, max_file_size_mb))
                    elif fpath.suffix.lower() in secondary_exts and len(files_to_scan) < max_files // 2:
                        files_to_scan.append((fpath, repo_path, request.scan_types, max_file_size_mb))
                
                if files_checked >= max_files:
                    break
            
            findings = []
            batch_size = 20
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
                for i in range(0, len(files_to_scan), batch_size):
                    batch = files_to_scan[i:i+batch_size]
                    
                    future_to_file = {
                        executor.submit(scan_file_parallel, file_info): file_info 
                        for file_info in batch
                    }
                    
                    for future in concurrent.futures.as_completed(future_to_file, timeout=30):
                        try:
                            file_findings = future.result(timeout=2)
                            if file_findings:
                                findings.extend(file_findings)
                        except (concurrent.futures.TimeoutError, Exception):
                            continue
            
            seen = set()
            unique_findings = []
            for finding in findings:
                key = (finding.file, finding.line, finding.type)
                if key not in seen:
                    seen.add(key)
                    unique_findings.append(finding)
            
            unique_findings.sort(key=lambda x: (x.priority_rank, -x.severity_score, x.file, x.line))
            
            max_findings = 500
            truncated = len(unique_findings) > max_findings
            if truncated:
                unique_findings = unique_findings[:max_findings]
            
            stats = {
                "repo_url": request.repo_url,
                "branch": request.branch or "default",
                "files_scanned": len(files_to_scan),
                "files_checked": files_checked,
                "files_skipped": files_skipped,
                "max_file_size_mb": max_file_size_mb,
                "max_files": max_files,
                "performance": "optimized_parallel_scanning",
                "truncated": truncated,
                "scan_method": "github_clone"
            }
            
            scan_response = create_enhanced_response(
                method="github",
                scan_types=request.scan_types,
                findings=unique_findings,
                stats=stats,
                start_time=start_time
            )
            
            pdf_bytes = generate_pdf_report(scan_response)
            
            from fastapi.responses import Response
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=security_report_{scan_response.scan_id}.pdf"}
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub scan failed: {str(e)[:200]}")

@router.get("/cache/clear")
async def clear_cache():
    """Clear all cached scan results."""
    global _SCAN_CACHE
    cache_size = len(_SCAN_CACHE)
    _SCAN_CACHE.clear()
    return {
        "status": "success",
        "message": f"Cleared {cache_size} cached scan(s)",
        "timestamp": datetime.now().isoformat()
    }

@router.get("/cache/stats")
async def cache_stats():
    """Get cache statistics."""
    return {
        "cached_scans": len(_SCAN_CACHE),
        "ttl_seconds": CACHE_TTL_SECONDS,
        "cache_keys": list(_SCAN_CACHE.keys())
    }

@router.get("/health")
async def scanner_health():
    """Scanner service health check."""
    return {
        "status": "healthy ✅",
        "scanner_engine": "LLMShield-Unified-v3.0",
        "timestamp": datetime.now().isoformat(),
        "capabilities": {
            "git_available": _GIT_OK,
            "patterns_loaded": {
                "secrets": len(SECRET_PATTERNS),
                "cpp_vulnerabilities": len(CPP_VULN_PATTERNS) + len(SPECIAL_CPP_PATTERNS)
            },
            "supported_extensions": list(ALL_EXTS)
        },
        "features": {
            "visual_reporting": "✅ Enhanced with emojis and indicators",
            "priority_ranking": "✅ Issues ranked by urgency",
            "executive_summary": "✅ Risk assessment included",
            "recommendations": "✅ Actionable fix suggestions",
            "performance_tracking": "✅ Scan duration metrics"
        },
        "optimizations": [
            "🚀 Parallel file scanning",
            "📏 File size limits",
            "🔴 Critical severity for all secrets",
            "💡 Specific remediation guidance",
            "📊 Enhanced reporting visuals"
        ]
    }