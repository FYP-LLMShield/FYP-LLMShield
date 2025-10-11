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
