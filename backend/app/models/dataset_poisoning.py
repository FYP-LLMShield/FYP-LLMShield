"""
Dataset Poisoning Detection Models
===================================
Pydantic models for dataset poisoning detection requests and responses.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class DatasetVerdictType(str, Enum):
    """Safety verdict for dataset"""
    SAFE = "safe"
    SUSPICIOUS = "suspicious"
    UNSAFE = "unsafe"
    UNKNOWN = "unknown"


class DetectionTechniqueType(str, Enum):
    """Types of detection techniques"""
    STATISTICAL = "statistical"
    LABEL_ANALYSIS = "label_analysis"
    TEXT_ANALYSIS = "text_analysis"
    INTEGRITY_CHECK = "integrity_check"
    CORRELATION_ANALYSIS = "correlation_analysis"
    METADATA_ANALYSIS = "metadata_analysis"
    SAMPLE_PATTERNS = "sample_patterns"
    DISTRIBUTION_TESTS = "distribution_tests"


class DetectionResult(BaseModel):
    """Result of a single detection technique"""
    technique: DetectionTechniqueType = Field(..., description="Detection technique used")
    passed: bool = Field(..., description="Whether detection passed (no issues found)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0-1)")
    findings: List[str] = Field(default_factory=list, description="Specific findings")
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Risk score (0-1)")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Detailed metrics")


class SuspiciousSample(BaseModel):
    """Suspicious sample in dataset"""
    sample_index: int = Field(..., description="Index of sample in dataset")
    suspicious_features: List[str] = Field(..., description="Features that make it suspicious")
    anomaly_score: float = Field(..., ge=0.0, le=1.0, description="Anomaly score")
    reason: str = Field(..., description="Why this sample is suspicious")


class DatasetAnalysisResult(BaseModel):
    """Complete dataset analysis result"""
    analysis_id: str = Field(..., description="Unique analysis ID")
    dataset_name: str = Field(..., description="Name of dataset analyzed")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    input_method: str = Field(..., description="Input method: 'text', 'file', or 'huggingface'")

    # Verdict
    verdict: DatasetVerdictType = Field(..., description="Safety verdict")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in verdict")
    explanation: str = Field(..., description="Human-readable explanation")

    # Detailed results
    detection_results: List[DetectionResult] = Field(default_factory=list)
    suspicious_samples: List[SuspiciousSample] = Field(default_factory=list, description="Top suspicious samples")

    # Summary statistics
    total_samples: int = Field(default=0, description="Total samples in dataset")
    total_features: int = Field(default=0, description="Total features/columns")
    suspicious_sample_count: int = Field(default=0, description="Count of suspicious samples")
    summary_metrics: Dict[str, Any] = Field(default_factory=dict, description="Summary statistics")

    # Risk breakdown
    overall_risk_score: float = Field(..., ge=0.0, le=1.0, description="Overall risk (0-1)")
    recommendation: str = Field(..., description="Security recommendation")

    # Error handling
    status: str = Field(..., description="Analysis status: 'completed', 'failed', 'partial'")
    error_message: Optional[str] = None
    error_details: Optional[str] = None


class DatasetAnalysisRequest(BaseModel):
    """Request for dataset poisoning analysis"""
    dataset_name: str = Field(..., description="Name of dataset")
    input_method: str = Field(..., description="'text', 'file', or 'huggingface'")

    # For text paste
    text_content: Optional[str] = Field(None, description="Dataset content as text (CSV, JSON, etc.)")

    # For file upload - handled separately via multipart
    # file will be uploaded as multipart form data

    # For HuggingFace dataset
    huggingface_dataset_id: Optional[str] = Field(None, description="HF dataset ID (e.g., user/dataset-name)")
    huggingface_config: Optional[str] = Field(None, description="HF dataset config/split")

    # Analysis options
    sample_size: Optional[int] = Field(None, description="Max samples to analyze (for large datasets)")
    timeout_seconds: int = Field(default=300, ge=60, le=3600, description="Analysis timeout")


class DatasetAnalysisResponse(BaseModel):
    """Response with dataset analysis results"""
    analysis_id: str = Field(..., description="Unique analysis ID")
    status: str = Field(..., description="Analysis status")
    result: Optional[DatasetAnalysisResult] = None
    message: str = Field(..., description="Status message")


class DatasetListResponse(BaseModel):
    """Response with list of analyses"""
    analyses: List[DatasetAnalysisResult] = Field(..., description="List of analysis results")
    total: int = Field(..., description="Total number of analyses")
    limit: int = Field(..., description="Limit applied")
    offset: int = Field(..., description="Offset applied")
