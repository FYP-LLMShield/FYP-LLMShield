"""
Hybrid Security Scanner Router - Combines Regex + LLM Analysis
==============================================================
Provides unified endpoint that leverages both regex patterns (fast, reliable)
and LLM analysis (smart, contextual) for comprehensive code review.
"""

import os
import re
import tempfile
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import asyncio
import logging

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel, Field

# Import authentication
from app.utils.auth import get_current_user
from app.models.user import UserInDB
from app.services.scan_history_service import save_scan_to_history

# Import regex scanner functions and models
from app.routes.scanner import scan_text_content, generate_scan_id, FindingModel

# Import LLM scanner
from app.services.llm_scanner_service import llm_scanner_service, LLMFinding

# Try to import git
try:
    from git import Repo
    _GIT_OK = True
except ImportError:
    _GIT_OK = False

logger = logging.getLogger(__name__)
router = APIRouter()


# =========================
# Models
# =========================

class TextScanRequest(BaseModel):
    content: str
    filename: Optional[str] = "<hybrid-scan>"


class HybridFinding(BaseModel):
    """Finding from either regex or LLM source."""
    type: str
    category: str
    severity: str
    severity_score: int = Field(description="Numeric severity 1-5")
    cwe: List[str]
    message: str
    remediation: str
    confidence: float = Field(description="Confidence 0.0-1.0")
    file: str
    line: int
    column: Optional[int] = None
    snippet: str
    evidence: Dict = Field(default_factory=dict)
    priority_rank: int = 1
    source: str = Field(description="'regex' or 'llm'")


class HybridScanResponse(BaseModel):
    """Response combining regex and LLM findings."""
    engine: str = "LLMShield-Hybrid"
    scan_id: str
    timestamp: str
    method: str

    # Findings
    total_findings: int
    findings: List[HybridFinding]

    # Stats
    regex_findings_count: int
    llm_findings_count: int
    llm_available: bool

    # Summary
    summary: Dict = Field(default_factory=dict)
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    files_affected: int = 0


# =========================
# Deduplication Logic
# =========================

def is_duplicate(regex_finding: FindingModel, llm_finding: LLMFinding) -> bool:
    """
    Check if regex and LLM findings refer to the EXACT SAME vulnerability.
    Must match: same line AND same type (strict match, not substring)
    """
    # Must be on same line (allow ±1 for line number differences)
    same_line = abs(regex_finding.line - llm_finding.line) <= 1

    if not same_line:
        return False

    # Check for EXACT type match (not substring match)
    # Only consider it a duplicate if it's the exact same vulnerability
    regex_type = regex_finding.type.lower()
    llm_type = llm_finding.type.lower()

    # Only deduplicate if types are very similar
    exact_type_match = regex_type == llm_type

    # Check for CWE overlap - only if SAME CWE codes
    regex_cwe = set(regex_finding.cwe)
    llm_cwe = set(llm_finding.cwe)
    same_cwe = bool(regex_cwe & llm_cwe) and len(regex_cwe & llm_cwe) >= 1

    # Only consider duplicate if exact type match OR same specific CWE
    # This allows LLM to find different vulnerability types on same line
    return exact_type_match and same_cwe


def deduplicate_findings(
    regex_findings: List[FindingModel],
    llm_findings: List[LLMFinding]
) -> Tuple[List[FindingModel], List[LLMFinding]]:
    """
    Remove duplicate findings where LLM and regex detected the same issue.
    Keep regex findings, discard LLM duplicates.
    """
    logger.info(f"[DEDUP] Starting deduplication: {len(regex_findings)} regex, {len(llm_findings)} LLM")
    filtered_llm = []

    for llm_idx, llm_finding in enumerate(llm_findings):
        is_dup = False
        dup_reason = None
        for regex_finding in regex_findings:
            if is_duplicate(regex_finding, llm_finding):
                is_dup = True
                dup_reason = f"regex {regex_finding.type} at line {regex_finding.line}"
                break

        if not is_dup:
            filtered_llm.append(llm_finding)
            logger.info(f"[DEDUP] KEPT LLM finding {llm_idx+1}: {llm_finding.type} at line {llm_finding.line}")
        else:
            logger.info(f"[DEDUP] REMOVED LLM finding: {llm_finding.type} (duplicate of {dup_reason})")

    logger.info(f"[DEDUP] After dedup: {len(regex_findings)} regex, {len(filtered_llm)} LLM")
    return regex_findings, filtered_llm


# =========================
# Helper Functions
# =========================

def llm_finding_to_hybrid(llm_finding: LLMFinding) -> HybridFinding:
    """Convert LLMFinding to HybridFinding."""
    return HybridFinding(
        type=llm_finding.type,
        category="C/C++ Vulnerability",
        severity=llm_finding.severity,
        severity_score=llm_finding.severity_score,
        cwe=llm_finding.cwe,
        message=llm_finding.message,
        remediation=llm_finding.remediation,
        confidence=llm_finding.confidence,
        file=llm_finding.file,
        line=llm_finding.line,
        snippet=llm_finding.snippet,
        source="llm"
    )


def regex_finding_to_hybrid(regex_finding: FindingModel) -> HybridFinding:
    """Convert regex finding to HybridFinding."""
    return HybridFinding(
        type=regex_finding.type,
        category=regex_finding.category,
        severity=regex_finding.severity,
        severity_score=regex_finding.severity_score,
        cwe=regex_finding.cwe,
        message=regex_finding.message,
        remediation=regex_finding.remediation,
        confidence=regex_finding.confidence,
        file=regex_finding.file,
        line=regex_finding.line,
        column=regex_finding.column,
        snippet=regex_finding.snippet,
        evidence=regex_finding.evidence,
        priority_rank=regex_finding.priority_rank,
        source="regex"
    )


# =========================
# API Endpoints
# =========================

@router.get("/")
async def hybrid_scanner_info():
    """Get hybrid scanner information and capabilities."""
    llm_available = await llm_scanner_service.is_available()

    return {
        "name": "Hybrid Security Scanner",
        "version": "1.0.0",
        "description": "Combines regex patterns (fast) with LLM analysis (smart)",
        "approach": "Regex + LLM Ensemble",
        "components": {
            "regex": "Pattern-based detection (100+ patterns)",
            "llm": "AI-powered code review (Groq llama-3.1-70b-versatile)"
        },
        "llm_available": llm_available,
        "endpoints": [
            "POST /text - Scan pasted C/C++ code",
            "POST /upload - Upload and scan single file"
        ],
        "supported_files": [".c", ".cc", ".cpp", ".cxx", ".h", ".hpp"]
    }


@router.post("/text", response_model=HybridScanResponse)
async def scan_text_hybrid(
    request: TextScanRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Scan pasted code with hybrid regex + LLM analysis."""

    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    try:
        logger.info(f"[HYBRID] SCAN STARTED for {request.filename or '<hybrid-scan>'} ({len(request.content)} bytes)")

        # Run regex scan (fast) - scan both secrets and C++ vulnerabilities
        logger.info("[HYBRID] Running regex scanner...")
        regex_findings = scan_text_content(
            request.content,
            request.filename or "<hybrid-scan>",
            scan_types=["secrets", "cpp_vulns"]
        )
        logger.info(f"[HYBRID] Regex scanner returned {len(regex_findings)} findings:")
        for rf in regex_findings[:10]:  # Log first 10
            logger.info(f"[HYBRID]   - {rf.type} (severity: {rf.severity}, line: {rf.line})")

        # Check if Groq API is available
        logger.info("[HYBRID] Checking LLM availability...")
        llm_available = await llm_scanner_service.is_available()
        llm_findings = []

        logger.info(f"[HYBRID] LLM available: {llm_available}")
        logger.info(f"[HYBRID] Regex found {len(regex_findings)} findings")

        # Run LLM scan concurrently if available (with timeout)
        if llm_available:
            try:
                logger.info("[HYBRID] LLM scan STARTING...")
                # Add timeout to prevent hanging (70 seconds total - API has 60s timeout)
                llm_findings = await asyncio.wait_for(
                    llm_scanner_service.scan_code(
                        request.content,
                        request.filename or "<hybrid-scan>"
                    ),
                    timeout=70.0
                )
                logger.info(f"[HYBRID] LLM scan COMPLETED - returned {len(llm_findings)} findings:")
                for f in llm_findings[:10]:  # Log first 10
                    logger.info(f"[HYBRID]   - {f.type} at line {f.line} (severity: {f.severity}, conf: {f.confidence})")
            except asyncio.TimeoutError:
                logger.warning("[HYBRID] LLM scan TIMEOUT - proceeding with regex results only")
                llm_findings = []
            except Exception as e:
                logger.error(f"[HYBRID] LLM scan failed: {str(e)}")
                import traceback
                logger.debug(f"[HYBRID] Traceback: {traceback.format_exc()}")
                llm_findings = []

        logger.info(f"[HYBRID] Before dedup - Regex: {len(regex_findings)}, LLM: {len(llm_findings)}")

        # Deduplicate
        regex_findings, llm_findings = deduplicate_findings(regex_findings, llm_findings)

        logger.info(f"[HYBRID] After dedup - Regex: {len(regex_findings)}, LLM: {len(llm_findings)}")

        # Convert to hybrid findings
        all_findings = []
        for rf in regex_findings:
            all_findings.append(regex_finding_to_hybrid(rf))
        for lf in llm_findings:
            all_findings.append(llm_finding_to_hybrid(lf))

        # Sort by priority and severity
        all_findings.sort(
            key=lambda x: (x.priority_rank, -x.severity_score),
            reverse=False
        )

        # Calculate stats
        critical_count = sum(1 for f in all_findings if f.severity_score == 5)
        high_count = sum(1 for f in all_findings if f.severity_score == 4)
        medium_count = sum(1 for f in all_findings if f.severity_score == 3)
        low_count = sum(1 for f in all_findings if f.severity_score <= 2)
        files_affected = len(set(f.file for f in all_findings))

        response = HybridScanResponse(
            scan_id=generate_scan_id(),
            timestamp=datetime.now().isoformat(),
            method="text",
            total_findings=len(all_findings),
            findings=all_findings,
            regex_findings_count=len(regex_findings),
            llm_findings_count=len(llm_findings),
            llm_available=llm_available,
            summary={
                "total": len(all_findings),
                "regex": len(regex_findings),
                "llm": len(llm_findings)
            },
            critical_count=critical_count,
            high_count=high_count,
            medium_count=medium_count,
            low_count=low_count,
            files_affected=files_affected
        )

        # Save to history
        try:
            await save_scan_to_history(
                user_id=str(current_user.id),
                scan_response={
                    "scan_id": response.scan_id,
                    "timestamp": response.timestamp,
                    "findings_count": response.total_findings,
                    "method": "hybrid_text",
                    "regex_findings": response.regex_findings_count,
                    "llm_findings": response.llm_findings_count
                },
                input_type="text",
                input_size=len(request.content.encode('utf-8'))
            )
        except Exception as e:
            logger.warning(f"Failed to save scan to history: {str(e)}")

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Hybrid scan failed: {str(e)}"
        )


@router.post("/upload", response_model=HybridScanResponse)
async def scan_upload_hybrid(
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_user)
):
    """Upload and scan a file with hybrid regex + LLM analysis."""

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename required")

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
            content = await file.read()
            temp_path.write_bytes(content)
            content_str = content.decode('utf-8', errors='replace')

            # Run regex scan
            regex_findings = scan_text_content(content_str, file.filename, scan_types=["secrets", "cpp_vulns"])

            # Check LLM availability and scan if available
            llm_available = await llm_scanner_service.is_available()
            llm_findings = []

            if llm_available:
                try:
                    llm_findings = await asyncio.wait_for(
                        llm_scanner_service.scan_code(
                            content_str,
                            file.filename
                        ),
                        timeout=70.0
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"[HYBRID] LLM scan TIMEOUT for {file.filename} - continuing with regex")
                    llm_findings = []
                except Exception as e:
                    logger.warning(f"[HYBRID] LLM scan failed: {str(e)}")
                    llm_findings = []

            # Deduplicate
            regex_findings, llm_findings = deduplicate_findings(regex_findings, llm_findings)

            # Convert to hybrid findings
            all_findings = []
            for rf in regex_findings:
                all_findings.append(regex_finding_to_hybrid(rf))
            for lf in llm_findings:
                all_findings.append(llm_finding_to_hybrid(lf))

            all_findings.sort(
                key=lambda x: (x.priority_rank, -x.severity_score),
                reverse=False
            )

            # Calculate stats
            critical_count = sum(1 for f in all_findings if f.severity_score == 5)
            high_count = sum(1 for f in all_findings if f.severity_score == 4)
            medium_count = sum(1 for f in all_findings if f.severity_score == 3)
            low_count = sum(1 for f in all_findings if f.severity_score <= 2)
            files_affected = len(set(f.file for f in all_findings))

            response = HybridScanResponse(
                scan_id=generate_scan_id(),
                timestamp=datetime.now().isoformat(),
                method="upload",
                total_findings=len(all_findings),
                findings=all_findings,
                regex_findings_count=len(regex_findings),
                llm_findings_count=len(llm_findings),
                llm_available=llm_available,
                summary={
                    "total": len(all_findings),
                    "regex": len(regex_findings),
                    "llm": len(llm_findings)
                },
                critical_count=critical_count,
                high_count=high_count,
                medium_count=medium_count,
                low_count=low_count,
                files_affected=files_affected
            )

            # Save to history
            try:
                await save_scan_to_history(
                    user_id=str(current_user.id),
                    scan_response={
                        "scan_id": response.scan_id,
                        "timestamp": response.timestamp,
                        "findings_count": response.total_findings,
                        "method": "hybrid_upload",
                        "regex_findings": response.regex_findings_count,
                        "llm_findings": response.llm_findings_count
                    },
                    input_type="file_upload",
                    input_size=len(content)
                )
            except Exception as e:
                logger.warning(f"Failed to save scan to history: {str(e)}")

            return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"File upload scan failed: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check for hybrid scanner."""
    llm_available = await llm_scanner_service.is_available()
    return {
        "status": "healthy",
        "regex_scanner": "OK - Available",
        "llm_scanner": "OK - Available" if llm_available else "WARNING - Groq API not configured or unreachable",
        "llm_available": llm_available,
        "timestamp": datetime.now().isoformat()
    }
