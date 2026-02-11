"""
Data Poisoning Detection Models
================================
Pydantic models for data poisoning detection scan requests and responses.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class VerdictType(str, Enum):
    """Safety verdict for the scan"""
    SAFE = "safe"
    SUSPICIOUS = "suspicious"
    UNSAFE = "unsafe"
    UNKNOWN = "unknown"


class TestCategory(str, Enum):
    """Categories of behavioral tests"""
    BASELINE_SAFETY = "baseline_safety"
    TRIGGER_FUZZING = "trigger_fuzzing"
    CONSISTENCY = "consistency"
    CONTEXT_OVERRIDE = "context_override"
    FILE_SAFETY = "file_safety"


class BehavioralTestResult(BaseModel):
    """Result of a single behavioral test"""
    test_name: str = Field(..., description="Name of the test")
    category: TestCategory = Field(..., description="Category of the test")
    passed: bool = Field(..., description="Whether the test passed")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0-1)")
    details: str = Field(..., description="Details about the test result")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Numeric metrics from the test")


class FileSafetyResult(BaseModel):
    """File-level safety analysis result"""
    has_safe_format: bool = Field(..., description="Whether file format is safe")
    has_unsafe_serialization: bool = Field(..., description="Whether unsafe serialization detected")
    has_suspicious_code: bool = Field(..., description="Whether suspicious code found")
    risk_score: float = Field(..., ge=0.0, le=1.0, description="File safety risk (0-1)")
    details: List[str] = Field(default_factory=list, description="Details about safety checks")


class RiskAssessment(BaseModel):
    """Overall risk assessment breakdown"""
    system_compromise_risk: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Risk of malware/code execution (0-1)"
    )
    behavior_manipulation_risk: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Risk of poisoning/backdoor behavior (0-1)"
    )
    combined_risk_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Combined overall risk (0-1)"
    )
    recommendation: str = Field(..., description="Security recommendation")


class ScanResult(BaseModel):
    """Complete scan result for a model"""
    scan_id: str = Field(..., description="Unique scan ID")
    model_url: str = Field(..., description="Hugging Face model URL")
    model_id: str = Field(..., description="Model ID (e.g., user/model-name)")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(..., description="Scan status: completed, failed, in_progress")

    # Verdict
    verdict: VerdictType = Field(..., description="Safety verdict")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in verdict (0-1)")
    explanation: str = Field(..., description="Human-readable explanation of verdict")

    # Risk Assessment
    risk_assessment: Optional[RiskAssessment] = None

    # Results breakdown
    file_safety: Optional[FileSafetyResult] = None
    behavioral_tests: List[BehavioralTestResult] = Field(default_factory=list)

    # Detailed metrics
    summary_metrics: Dict[str, float] = Field(default_factory=dict, description="Summary of key metrics")

    # Error info if failed
    error_message: Optional[str] = None
    error_details: Optional[str] = None


class ScanRequest(BaseModel):
    """Request to initiate a data poisoning scan"""
    model_url: str = Field(
        ...,
        description="Hugging Face model URL (e.g., https://huggingface.co/user/model-name)",
        example="https://huggingface.co/meta-llama/Llama-2-7b"
    )
    max_download_size_gb: float = Field(
        default=5.0,
        ge=0.1,
        le=50.0,
        description="Maximum download size in GB"
    )
    run_behavioral_tests: bool = Field(
        default=True,
        description="Whether to run behavioral tests (slower but more thorough)"
    )
    timeout_seconds: int = Field(
        default=300,
        ge=60,
        le=3600,
        description="Timeout for the entire scan in seconds"
    )


class ScanStatusResponse(BaseModel):
    """Response with scan status"""
    scan_id: str = Field(..., description="Unique scan ID")
    status: str = Field(..., description="Current status: queued, scanning, completed, failed")
    progress_percent: int = Field(..., ge=0, le=100, description="Progress percentage")
    message: str = Field(..., description="Status message")
    result: Optional[ScanResult] = None


class ReportRequest(BaseModel):
    """Request to generate a downloadable report"""
    scan_id: str = Field(..., description="Scan ID to generate report for")
    format: str = Field(
        default="json",
        pattern="^(json|csv|html)$",
        description="Report format: json, csv, or html"
    )


class ScanListResponse(BaseModel):
    """Response with list of scans"""
    scans: List[ScanResult] = Field(..., description="List of scan results")
    total: int = Field(..., description="Total number of scans")
    limit: int = Field(..., description="Limit applied")
    offset: int = Field(..., description="Offset applied")
