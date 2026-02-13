"""
SAST Scanner Router - FastAPI routes for SAST-based vulnerability detection
Replaces regex-based pattern matching with proper static analysis tools
Supports: Text, File Upload, and GitHub Repository scanning
"""

import os
import re
import tempfile
import zipfile
import shutil
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import concurrent.futures

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel, Field

# Import authentication
from app.utils.auth import get_current_user
from app.models.user import UserInDB
from app.services.scan_history_service import save_scan_to_history

# Import SAST service
from app.services.sast_service import sast_service, Vulnerability

# Try to import git for GitHub scanning
try:
    from git import Repo
    _GIT_OK = True
except ImportError:
    _GIT_OK = False

router = APIRouter()

# ===========================
# Models
# ===========================

class TextScanRequest(BaseModel):
    content: str
    filename: Optional[str] = "code.c"
    scan_secrets: bool = True
    scan_vulnerabilities: bool = True


class RepoScanRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None
    subdir: Optional[str] = None
    token: Optional[str] = None
    scan_secrets: bool = True
    scan_vulnerabilities: bool = True
    max_file_size_mb: Optional[float] = 1.0
    max_files: Optional[int] = 200


class SASTFinding(BaseModel):
    id: str
    type: str
    category: str
    severity: str
    severity_score: int
    cwe: List[str]
    message: str
    remediation: str
    confidence: float
    confidence_label: str
    file: str
    line: int
    column: Optional[int] = None
    snippet: str
    evidence: Dict = Field(default_factory=dict)
    priority_rank: int = 1


class SASTResponse(BaseModel):
    scan_id: str
    timestamp: str
    method: str
    total_findings: int
    findings: List[SASTFinding]

    # Summary stats
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int

    # Categories
    vulnerability_count: int
    secret_count: int

    # Files affected
    files_affected: int

    # Status
    semgrep_available: bool
    trufflehog_available: bool


# ===========================
# Helper Functions
# ===========================

def vulnerability_to_sast_finding(vuln: Vulnerability) -> SASTFinding:
    """Convert internal Vulnerability to SASTFinding"""
    return SASTFinding(
        id=vuln.id,
        type=vuln.type,
        category=vuln.category,
        severity=vuln.severity,
        severity_score=vuln.severity_score,
        cwe=vuln.cwe,
        message=vuln.message,
        remediation=vuln.remediation,
        confidence=vuln.confidence,
        confidence_label=vuln.confidence_label,
        file=vuln.file,
        line=vuln.line,
        column=vuln.column,
        snippet=vuln.snippet,
        evidence=vuln.evidence,
        priority_rank=vuln.priority_rank
    )


def generate_scan_id() -> str:
    """Generate unique scan ID"""
    import random
    import string
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"SAST-{timestamp}-{random_suffix}"


def create_sast_response(
    method: str,
    findings: List[Vulnerability]
) -> SASTResponse:
    """Create SAST response from findings"""

    # Count by severity
    critical_count = sum(1 for f in findings if f.severity_score == 5)
    high_count = sum(1 for f in findings if f.severity_score == 4)
    medium_count = sum(1 for f in findings if f.severity_score == 3)
    low_count = sum(1 for f in findings if f.severity_score <= 2)

    # Count by category
    vulnerability_count = sum(1 for f in findings if f.category == "C/C++ Vulnerability")
    secret_count = sum(1 for f in findings if f.category == "Secret")

    # Files affected
    files_affected = len(set(f.file for f in findings))

    # Convert to SAST findings
    sast_findings = [vulnerability_to_sast_finding(f) for f in findings]

    return SASTResponse(
        scan_id=generate_scan_id(),
        timestamp=datetime.now().isoformat(),
        method=method,
        total_findings=len(findings),
        findings=sast_findings,
        critical_count=critical_count,
        high_count=high_count,
        medium_count=medium_count,
        low_count=low_count,
        vulnerability_count=vulnerability_count,
        secret_count=secret_count,
        files_affected=files_affected,
        semgrep_available=sast_service.semgrep_available,
        trufflehog_available=sast_service.trufflehog_available
    )


# ===========================
# API Endpoints
# ===========================

@router.get("/")
async def sast_scanner_info():
    """Get SAST scanner information and capabilities"""
    status = sast_service.get_status()
    return {
        "name": "SAST Scanner (Semgrep + TruffleHog)",
        "version": "2.0.0",
        "description": "Professional static analysis for C/C++ code",
        "approach": "SAST (Static Application Security Testing)",
        **status,
        "endpoints": [
            "POST /text - Scan pasted C/C++ code",
            "POST /upload - Upload and scan single file",
            "POST /github - Clone and scan GitHub repository"
        ],
        "supported_files": [".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".hxx"],
        "tools": {
            "semgrep": "C/C++ vulnerability detection via Semgrep",
            "trufflehog": "Credential/secret detection via TruffleHog"
        }
    }


@router.post("/text", response_model=SASTResponse)
async def scan_text(
    request: TextScanRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Scan pasted C/C++ code text using SAST tools"""

    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    try:
        # Run SAST analysis on text
        findings = await sast_service.scan_text(
            request.content,
            request.filename
        )

        # Create response
        response = create_sast_response("text", findings)

        # Save to history
        try:
            await save_scan_to_history(
                user_id=str(current_user.id),
                scan_response={
                    "scan_id": response.scan_id,
                    "timestamp": response.timestamp,
                    "findings_count": response.total_findings,
                    "method": "sast_text"
                },
                input_type="text",
                input_size=len(request.content.encode('utf-8'))
            )
        except Exception as e:
            print(f"Warning: Failed to save scan to history: {str(e)}")

        return response

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"SAST scan failed: {str(e)}"
        )


@router.post("/upload", response_model=SASTResponse)
async def scan_upload(
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_user)
):
    """Upload and scan a single C/C++ file using SAST tools"""

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename required")

    # Check file extension
    valid_extensions = {".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".hxx"}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in valid_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Supported: {', '.join(valid_extensions)}"
        )

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir) / file.filename

            # Save uploaded file
            content = await file.read()
            temp_path.write_bytes(content)

            # Run SAST analysis
            findings = await sast_service.scan_file(str(temp_path))

            # Create response
            response = create_sast_response("upload", findings)

            # Save to history
            try:
                await save_scan_to_history(
                    user_id=str(current_user.id),
                    scan_response={
                        "scan_id": response.scan_id,
                        "timestamp": response.timestamp,
                        "findings_count": response.total_findings,
                        "method": "sast_upload"
                    },
                    input_type="file_upload",
                    input_size=len(content)
                )
            except Exception as e:
                print(f"Warning: Failed to save scan to history: {str(e)}")

            return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"File upload scan failed: {str(e)}"
        )


@router.post("/github", response_model=SASTResponse)
async def scan_github(
    request: RepoScanRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Clone and scan GitHub repository using SAST tools"""

    if not _GIT_OK:
        raise HTTPException(
            status_code=500,
            detail="Git not available. Install gitpython: pip install gitpython"
        )

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            repo_path = Path(temp_dir) / "repo"

            # Handle private repos with token
            repo_url = request.repo_url
            if request.token and repo_url.startswith("https://"):
                repo_url = repo_url.replace("https://", f"https://{request.token}@")

            # Clone repository (shallow clone for speed)
            print(f"Cloning {request.repo_url} (shallow)...")
            Repo.clone_from(
                repo_url,
                repo_path,
                branch=request.branch,
                depth=1,
                single_branch=True,
                no_tags=True
            )

            # Determine scan target
            scan_target = repo_path / (request.subdir or "")
            if not scan_target.exists():
                raise HTTPException(
                    status_code=400,
                    detail=f"Subdirectory not found: {request.subdir}"
                )

            # Scan directory
            print(f"Running SAST analysis on {scan_target}...")
            findings = await sast_service.scan_directory(str(scan_target))

            # Create response
            response = create_sast_response("github", findings)

            # Save to history
            try:
                await save_scan_to_history(
                    user_id=str(current_user.id),
                    scan_response={
                        "scan_id": response.scan_id,
                        "timestamp": response.timestamp,
                        "findings_count": response.total_findings,
                        "method": "sast_github",
                        "repo_url": request.repo_url
                    },
                    input_type="github_repo",
                    input_size=len(request.repo_url)
                )
            except Exception as e:
                print(f"Warning: Failed to save scan to history: {str(e)}")

            return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"GitHub scan failed: {str(e)[:200]}"
        )


@router.get("/health")
async def scanner_health():
    """Health check for SAST scanner"""
    return {
        "status": "healthy" if (sast_service.semgrep_available or sast_service.trufflehog_available) else "degraded",
        "tools": {
            "semgrep": "OK - Available" if sast_service.semgrep_available else "ERROR - Not installed",
            "trufflehog": "OK - Available" if sast_service.trufflehog_available else "ERROR - Not installed"
        },
        "timestamp": datetime.now().isoformat()
    }


@router.post("/test-scan", response_model=SASTResponse)
async def test_scan(request: TextScanRequest):
    """Test endpoint for SAST scanning (no authentication required for demo/testing)"""

    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    try:
        # Run SAST analysis on text
        findings = await sast_service.scan_text(
            request.content,
            request.filename
        )

        # Create response
        return create_sast_response("text", findings)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"SAST scan failed: {str(e)}"
        )
