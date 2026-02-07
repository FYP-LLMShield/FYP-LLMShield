from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from bson import ObjectId

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

class ScanHistoryCreate(BaseModel):
    """Model for creating new scan history entries"""
    scan_id: str
    scan_type: str  # "prompt_injection", "data_poisoning", "vector_embedding", "code_scanning"
    title: str
    description: Optional[str] = None
    status: str  # "success", "warning", "error", "info"
    total_findings: int = 0
    critical_findings: int = 0
    high_findings: int = 0
    medium_findings: int = 0
    low_findings: int = 0
    duration: Optional[float] = None  # Duration in seconds
    scan_results: Optional[Dict[str, Any]] = None  # Full scan response data
    executive_summary: Optional[str] = None
    recommendations: Optional[List[str]] = None
    input_type: Optional[str] = None  # "text", "file", "github", etc.
    input_size: Optional[int] = None  # Size in bytes or lines

class ScanHistoryInDB(BaseModel):
    """Database model for scan history"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    scan_id: str
    scan_type: str
    title: str
    description: Optional[str] = None
    status: str
    
    # Scan metrics
    total_findings: int = 0
    critical_findings: int = 0
    high_findings: int = 0
    medium_findings: int = 0
    low_findings: int = 0
    
    # Timing information
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    duration: Optional[float] = None
    
    # Detailed scan results
    scan_results: Optional[Dict[str, Any]] = None
    executive_summary: Optional[str] = None
    recommendations: Optional[List[str]] = None
    
    # Input information
    input_type: Optional[str] = None
    input_size: Optional[int] = None
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class ScanHistoryResponse(BaseModel):
    """Response model for scan history"""
    id: str
    scan_id: str
    scan_type: str
    title: str
    description: Optional[str] = None
    status: str
    total_findings: int
    critical_findings: int
    high_findings: int
    medium_findings: int
    low_findings: int
    timestamp: datetime
    duration: Optional[float] = None
    executive_summary: Optional[str] = None
    recommendations: Optional[List[str]] = None
    input_type: Optional[str] = None
    input_size: Optional[int] = None

class ScanHistoryDetailResponse(ScanHistoryResponse):
    """Detailed response model including full scan results"""
    scan_results: Optional[Dict[str, Any]] = None