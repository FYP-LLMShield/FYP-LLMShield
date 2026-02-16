"""
Vector Embeddings Scanner Models
--------------------------------
Pydantic models and index helpers for the Weak Vector Embeddings Scanner,
aligned with existing scanner model patterns (see scan_history.py).
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

# Reuse the same ObjectId helper pattern used in other models


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler=None):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")
        return field_schema


# Enums to mirror existing style (string enums for storage)
class ScanType(str, Enum):
    TEXT_INPUT = "text_input"
    FILE_UPLOAD = "file_upload"
    API_ENDPOINT = "api_endpoint"
    EMBEDDING_UPLOAD = "embedding_upload"


class ScanStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class DetectionCategory(str, Enum):
    MALICIOUS_INPUT = "malicious_input"
    EMBEDDING_SECURITY = "embedding_security"
    ATTACK_SIMULATION = "attack_simulation"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ============ Main Scan Records (vector_scans) ============
class VectorScanBase(BaseModel):
    scan_id: str = Field(..., description="Unique scan identifier")
    user_id: PyObjectId = Field(..., description="Reference to users collection")
    scan_type: ScanType
    input_data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Input metadata (text/file reference/API config/embedding file info)",
    )
    status: ScanStatus = ScanStatus.PENDING
    progress: float = Field(default=0.0, ge=0.0, le=100.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    results_summary: Dict[str, Any] = Field(
        default_factory=dict,
        description="High-level findings summary for dashboards/reports",
    )

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class VectorScanCreate(VectorScanBase):
    """Creation model for vector_scans documents."""


class VectorScanInDB(VectorScanBase):
    """Database model for vector_scans collection."""

    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")


class VectorScanResponse(VectorScanBase):
    """Response model (omit Mongo _id)."""

    id: Optional[str] = Field(default=None)


# ============ Detailed Findings (vector_scan_results) ============
class VectorScanResultBase(BaseModel):
    scan_id: str = Field(..., description="Reference to vector_scans.scan_id")
    detection_category: DetectionCategory
    threat_type: str = Field(..., description="prompt_injection | jailbreak | anomaly | collision | ...")
    severity: Severity
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    description: str
    evidence: Dict[str, Any] = Field(default_factory=dict)
    recommendations: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class VectorScanResultCreate(VectorScanResultBase):
    """Creation model for vector_scan_results documents."""


class VectorScanResultInDB(VectorScanResultBase):
    """Database model for vector_scan_results collection."""

    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")


class VectorScanResultResponse(VectorScanResultBase):
    """Response model (omit Mongo _id)."""

    id: Optional[str] = Field(default=None)


# ============ Embedding Analysis (embedding_analysis) ============
class EmbeddingAnalysisBase(BaseModel):
    scan_id: str = Field(..., description="Reference to vector_scans.scan_id")
    embedding_vector: Optional[List[float]] = Field(
        default=None, description="Inline storage for small vectors"
    )
    storage_reference: Optional[str] = Field(
        default=None, description="External storage key for large vectors"
    )
    statistics: Dict[str, Any] = Field(
        default_factory=dict, description="e.g., norm, mean, std_dev, variance"
    )
    anomaly_scores: Dict[str, Any] = Field(default_factory=dict)
    similarity_matches: List[Dict[str, Any]] = Field(
        default_factory=list, description="List of high-similarity items"
    )
    risk_indicators: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class EmbeddingAnalysisCreate(EmbeddingAnalysisBase):
    """Creation model for embedding_analysis documents."""


class EmbeddingAnalysisInDB(EmbeddingAnalysisBase):
    """Database model for embedding_analysis collection."""

    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")


class EmbeddingAnalysisResponse(EmbeddingAnalysisBase):
    """Response model (omit Mongo _id)."""

    id: Optional[str] = Field(default=None)


# ============ Report Generation Schema ============
class VectorScanReport(BaseModel):
    report_id: str = Field(..., description="Unique report identifier")
    scan_id: str = Field(..., description="Reference to vector_scans.scan_id")
    format: str = Field(..., description="pdf | json | html")
    url: Optional[str] = Field(
        default=None, description="If stored externally (e.g., S3/presigned URL)"
    )
    content: Optional[bytes] = Field(
        default=None, description="Inline report content (for small reports)"
    )
    status: str = Field(default="ready", description="ready | generating | failed")
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


# ============ Index Helpers ============
async def ensure_vector_scan_indexes(database: AsyncIOMotorDatabase) -> None:
    """
    Create indexes for vector scan collections.
    Mirrors the indexing approach used in other scanner modules.
    """
    vector_scans = database.get_collection("vector_scans")
    vector_scan_results = database.get_collection("vector_scan_results")
    embedding_analysis = database.get_collection("embedding_analysis")

    # vector_scans indexes
    await vector_scans.create_index([("scan_id", 1)], unique=True)
    await vector_scans.create_index([("user_id", 1), ("created_at", -1)])
    await vector_scans.create_index([("status", 1)])
    await vector_scans.create_index([("scan_type", 1)])

    # vector_scan_results indexes
    await vector_scan_results.create_index([("scan_id", 1)])
    await vector_scan_results.create_index([("detection_category", 1), ("severity", -1)])

    # embedding_analysis indexes
    await embedding_analysis.create_index([("scan_id", 1)])





