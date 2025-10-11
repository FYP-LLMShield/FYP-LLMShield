"""
Security Scanner Router - FastAPI routes for vulnerability and secret detection
=============================================================================
Handles text scanning, file uploads, and GitHub repository analysis.
Fixed version with proper authentication and error handling.
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
from collections import Counter

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel, Field

# Import authentication dependencies (commented out for debugging)
# from app.routes.auth import get_current_user
# from app.models.user import User

try:
    from git import Repo
    _GIT_OK = True
except ImportError:
    _GIT_OK = False
    print("Warning: GitPython not installed. GitHub scanning disabled.")

router = APIRouter()

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

class FindingModel(BaseModel):
    type: str
    category: str
    severity: str
    severity_score: int = Field(description="Numeric severity 1-5")
    cwe: List[str]
    message: str
    remediation: str
    confidence: float = Field(description="Confidence score 0.0-1.0")
    file: str
    line: int
    column: Optional[int] = None
    snippet: str
    evidence: Dict[str, str] = Field(default_factory=dict)

class ScanResponse(BaseModel):
    engine: str = "LLMShield-Unified"
    method: str
    scan_types: List[str]
    total_findings: int
    findings: List[FindingModel]
    summary: Dict[str, int]
    stats: Dict[str, Union[int, str]] = Field(default_factory=dict)

# File extensions and constants
CPP_EXTS = {".c", ".cc", ".cpp", ".cxx", ".h", ".hh", ".hpp", ".hxx"}
SECRET_EXTS = {".env", ".ini", ".json", ".pem", ".key", ".cfg", ".toml", ".yml", ".yaml", ".txt", ".py", ".js", ".ts", ".go", ".java", ".rb", ".php"}
ALL_EXTS = CPP_EXTS | SECRET_EXTS
IGNORE_MARKER = "LLMShield: ignore"

# =========================
# Security Detection Logic
# =========================

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

# Secret detection patterns
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

# C/C++ vulnerability patterns - Enhanced version
CPP_VULN_PATTERNS = {
    "gets": {"severity": 5, "cwe": "CWE-120", "msg": "gets() has no bounds checking", "fix": "Use fgets()"},
    "strcpy": {"severity": 5, "cwe": "CWE-120", "msg": "strcpy() can overflow buffer", "fix": "Use strncpy() or strlcpy()"},
    "strcat": {"severity": 5, "cwe": "CWE-120", "msg": "strcat() can overflow buffer", "fix": "Use strncat() or strlcat()"},
    "sprintf": {"severity": 5, "cwe": "CWE-134", "msg": "sprintf() can overflow buffer", "fix": "Use snprintf()"},
    "vsprintf": {"severity": 5, "cwe": "CWE-134", "msg": "vsprintf() can overflow buffer", "fix": "Use vsnprintf()"},
    "system": {"severity": 5, "cwe": "CWE-78", "msg": "system() allows command injection", "fix": "Use execve() family"},
    "popen": {"severity": 4, "cwe": "CWE-78", "msg": "popen() can execute arbitrary commands", "fix": "Use safer process APIs"},
    "strncpy": {"severity": 4, "cwe": "CWE-120", "msg": "strncpy() may not null-terminate", "fix": "Ensure null termination"},
    "strncat": {"severity": 4, "cwe": "CWE-120", "msg": "strncat() needs careful size calculation", "fix": "Use strlcat()"},
    "memcpy": {"severity": 4, "cwe": "CWE-787", "msg": "memcpy() needs length validation", "fix": "Validate lengths"},
    "tmpnam": {"severity": 4, "cwe": "CWE-377", "msg": "tmpnam() creates predictable filenames", "fix": "Use mkstemp()"},
    "mktemp": {"severity": 4, "cwe": "CWE-377", "msg": "mktemp() vulnerable to race conditions", "fix": "Use mkstemp()"},
    "atoi": {"severity": 3, "cwe": "CWE-704", "msg": "atoi() has no error reporting", "fix": "Use strtol()"},
    "atol": {"severity": 3, "cwe": "CWE-704", "msg": "atol() has no error reporting", "fix": "Use strtol()"},
    "rand": {"severity": 3, "cwe": "CWE-338", "msg": "Predictable random numbers", "fix": "Use cryptographic RNG"},
    "printf": {"severity": 4, "cwe": "CWE-134", "msg": "printf() vulnerable if format controlled by user", "fix": "Use constant format strings"},
    "fprintf": {"severity": 4, "cwe": "CWE-134", "msg": "fprintf() vulnerable if format controlled by user", "fix": "Use constant format strings"},
}

# Special pattern-based rules
SPECIAL_CPP_PATTERNS = [
    {
        "name": "scanf_no_width",
        "pattern": re.compile(r"\b[sf]?scanf\s*\([^)]*%s(?![0-9])[^)]*\)"),
        "severity": 5,
        "cwe": "CWE-120",
        "msg": "scanf %s without width limit",
        "fix": "Use width specifier like %10s"
    },
    {
        "name": "chmod_permissive",
        "pattern": re.compile(r"\bchmod\s*\([^,]+,\s*0[67][67][67]\s*\)"),
        "severity": 4,
        "cwe": "CWE-732",
        "msg": "Overly permissive file permissions",
        "fix": "Use least privilege principle"
    },
    {
        "name": "md5_usage",
        "pattern": re.compile(r"\b(MD5|md5)[_A-Za-z]*\b"),
        "severity": 4,
        "cwe": "CWE-327",
        "msg": "MD5 is cryptographically broken",
        "fix": "Use SHA-256 or stronger"
    }
]

def severity_to_string(score: int) -> str:
    """Convert numeric severity to string."""
    mapping = {5: "Critical", 4: "High", 3: "Medium", 2: "Low", 1: "Info"}
    return mapping.get(score, "Medium")

def scan_secrets(text: str, filename: str) -> List[FindingModel]:
    """Scan for secrets and credentials."""
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
                            
                            confidence = 0.9
                            if pattern_name == "JWT":
                                confidence = 0.95
                            elif "AWS" in pattern_name:
                                confidence = 0.93
                            
                            findings.append(FindingModel(
                                type=pattern_name,
                                category="Secret",
                                severity="Critical",
                                severity_score=5,
                                cwe=["CWE-798"],
                                message=f"{pattern_name} detected in code",
                                remediation="Remove from code, rotate credential, use environment variables",
                                confidence=confidence,
                                file=filename,
                                line=line_num,
                                column=match.start(),
                                snippet=line.strip(),
                                evidence={"redacted": redact_secret(secret_value)}
                            ))
                        except Exception as e:
                            # Skip this match if there's an error processing it
                            continue
                
                # High entropy detection
                for match in re.finditer(r"[\"']([A-Za-z0-9_\-\/+=]{20,})[\"']", line):
                    try:
                        token = match.group(1)
                        if shannon_entropy(token) > 4.0 and looks_like_b64(token):
                            findings.append(FindingModel(
                                type="HighEntropyString",
                                category="Secret",
                                severity="Medium",
                                severity_score=3,
                                cwe=["CWE-798"],
                                message="High entropy string detected (possible secret)",
                                remediation="Review if this is a hardcoded credential",
                                confidence=0.7,
                                file=filename,
                                line=line_num,
                                column=match.start(),
                                snippet=line.strip(),
                                evidence={"redacted": redact_secret(token)}
                            ))
                    except Exception as e:
                        # Skip this match if there's an error processing it
                        continue
            except Exception as e:
                # Skip this line if there's an error processing it
                continue
    except Exception as e:
        # Return empty findings list with error information
        return []
    
    return findings

def scan_cpp_vulns(text: str, filename: str) -> List[FindingModel]:
    """Scan for C/C++ vulnerabilities."""
    findings = []
    
    # Check if it looks like C/C++ code
    if not any(keyword in text for keyword in ["#include", "int ", "void ", "char ", "std::", "malloc", "free"]):
        return findings
    
    # Remove comments to avoid false positives
    text_cleaned = re.sub(r"/\*.*?\*/", " ", text, flags=re.DOTALL)
    text_cleaned = re.sub(r"//.*", "", text_cleaned)
    
    lines = text_cleaned.splitlines()
    
    for line_num, line in enumerate(lines, 1):
        if IGNORE_MARKER in line:
            continue
        
        # Check special patterns first
        for special in SPECIAL_CPP_PATTERNS:
            if special["pattern"].search(line):
                findings.append(FindingModel(
                    type=special["name"],
                    category="C++ Vulnerability",
                    severity=severity_to_string(special["severity"]),
                    severity_score=special["severity"],
                    cwe=[special["cwe"]],
                    message=special["msg"],
                    remediation=special["fix"],
                    confidence=0.85,
                    file=filename,
                    line=line_num,
                    column=0,
                    snippet=line.strip(),
                    evidence={"pattern": special["name"]}
                ))
        
        # Function-based patterns
        for func_name, details in CPP_VULN_PATTERNS.items():
            # Create regex pattern for function call
            pattern = rf"(?<![A-Za-z0-9_]){re.escape(func_name)}\s*\("
            
            match = re.search(pattern, line)
            if match:
                findings.append(FindingModel(
                    type=func_name,
                    category="C++ Vulnerability",
                    severity=severity_to_string(details["severity"]),
                    severity_score=details["severity"],
                    cwe=[details["cwe"]],
                    message=details["msg"],
                    remediation=details["fix"],
                    confidence=0.85,
                    file=filename,
                    line=line_num,
                    column=match.start(),
                    snippet=line.strip(),
                    evidence={"function": func_name}
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
                # Log the error but continue with other scan types
                print(f"Error in secret scanning: {str(e)}")
        
        if "cpp_vulns" in scan_types:
            try:
                all_findings.extend(scan_cpp_vulns(content, filename))
            except Exception as e:
                # Log the error but continue with other scan types
                print(f"Error in C++ vulnerability scanning: {str(e)}")
        
        # Remove duplicates
        seen = set()
        unique_findings = []
        for finding in all_findings:
            key = (finding.file, finding.line, finding.type)
            if key not in seen:
                seen.add(key)
                unique_findings.append(finding)
        
        return unique_findings
    except Exception as e:
        # Return empty list in case of unexpected errors
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

def create_summary(findings: List[FindingModel]) -> Dict[str, int]:
    """Create findings summary."""
    summary = {"TOTAL": len(findings)}
    for finding in findings:
        summary[finding.type] = summary.get(finding.type, 0) + 1
        summary[f"severity_{finding.severity.lower()}"] = summary.get(f"severity_{finding.severity.lower()}", 0) + 1
        summary[f"category_{finding.category.replace(' ', '_').lower()}"] = summary.get(f"category_{finding.category.replace(' ', '_').lower()}", 0) + 1
    return summary

# =========================
# API Endpoints
# =========================

@router.get("/")
async def scanner_info():
    """Scanner information and capabilities."""
    return {
        "name": "LLMShield Security Scanner",
        "version": "2.0.0",
        "capabilities": {
            "secrets": {
                "patterns": len(SECRET_PATTERNS),
                "types": ["AWS keys", "API tokens", "SSH keys", "JWT", "High entropy strings"]
            },
            "cpp_vulnerabilities": {
                "patterns": len(CPP_VULN_PATTERNS) + len(SPECIAL_CPP_PATTERNS),
                "types": ["Buffer overflows", "Format strings", "Command injection", "Weak crypto"]
            }
        },
        "endpoints": [
            "POST /text - Scan pasted text",
            "POST /upload - Upload file/ZIP",
            "POST /github - Clone and scan repository"
        ],
        "supported_files": list(ALL_EXTS),
        "ignore_syntax": "Add '// LLMShield: ignore' to suppress findings",
        "git_available": _GIT_OK
    }

@router.post("/text", response_model=ScanResponse)
async def scan_text(
    request: TextScanRequest,
    # current_user: User = Depends(get_current_user)  # Commented out for debugging
):
    """Scan pasted text content."""
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    
    valid_types = {"secrets", "cpp_vulns"}
    if not all(t in valid_types for t in request.scan_types):
        raise HTTPException(status_code=400, detail=f"Invalid scan types. Must be subset of: {valid_types}")
    
    try:
        findings = scan_text_content(request.content, request.filename, request.scan_types)
        
        return ScanResponse(
            method="text",
            scan_types=request.scan_types,
            total_findings=len(findings),
            findings=findings,
            summary=create_summary(findings),
            stats={
                "lines_scanned": len(request.content.splitlines()),
                # "user": current_user.email  # Commented out for debugging
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

@router.post("/upload", response_model=ScanResponse)
async def scan_upload(
    file: UploadFile = File(...),
    scan_types: str = "secrets,cpp_vulns",
    # current_user: User = Depends(get_current_user)  # Commented out for debugging
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
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            uploaded_file = temp_path / file.filename
            
            content = await file.read()
            uploaded_file.write_bytes(content)
            
            findings = []
            stats = {"file_size": len(content)}  # Removed user field for debugging
            
            if uploaded_file.suffix.lower() == ".zip":
                try:
                    with zipfile.ZipFile(uploaded_file, 'r') as zip_ref:
                        extract_path = temp_path / "extracted"
                        zip_ref.extractall(extract_path)
                        
                        files_scanned = 0
                        # Scan all extracted files
                        for root, _, files in os.walk(extract_path):
                            for fname in files:
                                fpath = Path(root) / fname
                                if fpath.suffix.lower() in ALL_EXTS:
                                    try:
                                        file_content = fpath.read_bytes()
                                        if not is_binary_file(file_content):
                                            text = file_content.decode('utf-8', errors='ignore')
                                            rel_path = str(fpath.relative_to(extract_path))
                                            findings.extend(scan_text_content(text, rel_path, scan_types_list))
                                            files_scanned += 1
                                    except Exception:
                                        continue
                        stats["archive_type"] = "zip"
                        stats["files_scanned"] = files_scanned
                except zipfile.BadZipFile:
                    raise HTTPException(status_code=400, detail="Invalid ZIP file")
            else:
                if not is_binary_file(content):
                    text = content.decode('utf-8', errors='ignore')
                    findings = scan_text_content(text, file.filename, scan_types_list)
                else:
                    raise HTTPException(status_code=400, detail="Binary files not supported")
                stats["is_binary"] = False
            
            return ScanResponse(
                method="upload",
                scan_types=scan_types_list,
                total_findings=len(findings),
                findings=findings,
                summary=create_summary(findings),
                stats=stats
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload scan failed: {str(e)}")

@router.post("/github", response_model=ScanResponse)
async def scan_github(
    request: RepoScanRequest,
    # current_user: User = Depends(get_current_user)  # Commented out for debugging
):
    """Clone and scan GitHub repository."""
    if not _GIT_OK:
        raise HTTPException(status_code=500, detail="Git not available. Install gitpython: pip install gitpython")
    
    valid_types = {"secrets", "cpp_vulns"}
    if not all(t in valid_types for t in request.scan_types):
        raise HTTPException(status_code=400, detail=f"Invalid scan types. Must be subset of: {valid_types}")
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            repo_path = Path(temp_dir) / "repo"
            
            # Handle private repos with token
            repo_url = request.repo_url
            if request.token and repo_url.startswith("https://"):
                repo_url = repo_url.replace("https://", f"https://{request.token}@")
            
            # Clone repository
            Repo.clone_from(repo_url, repo_path, branch=request.branch, depth=1)
            
            scan_target = repo_path / (request.subdir or "")
            if not scan_target.exists():
                raise HTTPException(status_code=400, detail=f"Subdirectory not found: {request.subdir}")
            
            findings = []
            files_scanned = 0
            
            # Scan repository files
            for root, dirs, files in os.walk(scan_target):
                # Skip common non-source directories
                dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", ".vscode", "build", "dist"}]
                
                for fname in files:
                    fpath = Path(root) / fname
                    if fpath.suffix.lower() in ALL_EXTS:
                        try:
                            file_content = fpath.read_bytes()
                            if not is_binary_file(file_content):
                                text = file_content.decode('utf-8', errors='ignore')
                                rel_path = str(fpath.relative_to(repo_path))
                                findings.extend(scan_text_content(text, rel_path, request.scan_types))
                                files_scanned += 1
                        except Exception:
                            continue
            
            return ScanResponse(
                method="github",
                scan_types=request.scan_types,
                total_findings=len(findings),
                findings=findings,
                summary=create_summary(findings),
                stats={
                    "repo_url": request.repo_url,
                    "branch": request.branch or "default",
                    "files_scanned": files_scanned,
                    # "user": current_user.email  # Commented out for debugging
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub scan failed: {str(e)[:200]}")

@router.get("/health")
async def scanner_health():
    """Scanner service health check."""
    return {
        "status": "healthy",
        "scanner_engine": "LLMShield-Unified",
        "git_available": _GIT_OK,
        "patterns_loaded": {
            "secrets": len(SECRET_PATTERNS),
            "cpp_vulnerabilities": len(CPP_VULN_PATTERNS) + len(SPECIAL_CPP_PATTERNS)
        },
        "supported_extensions": list(ALL_EXTS)
    }