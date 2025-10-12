from pydantic import BaseModel, Field, field_validator
from pydantic_core import core_schema
from typing import Dict, List, Optional, Any, Literal, Annotated
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler
    ) -> core_schema.CoreSchema:
        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.union_schema([
                core_schema.is_instance_schema(ObjectId),
                core_schema.chain_schema([
                    core_schema.str_schema(),
                    core_schema.no_info_plain_validator_function(cls.validate),
                ])
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x)
            ),
        )

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str):
            if not ObjectId.is_valid(v):
                raise ValueError("Invalid ObjectId")
            return ObjectId(v)
        raise ValueError("Invalid ObjectId")

class ModelConfig(BaseModel):
    """Model configuration stored in MongoDB"""
    
    id: Annotated[PyObjectId, Field(default_factory=PyObjectId, alias="_id")]
    user_id: PyObjectId
    
    # Basic configuration
    config_name: str
    model_type: Literal["openai", "anthropic", "google", "custom", "opensource"]
    model_name: str
    description: Optional[str] = None
    tags: List[str] = []
    
    # Model parameters
    parameters: Dict[str, Any] = {}
    # Encrypted credentials (will be encrypted before storage)
    credentials: Dict[str, Any] = {}
    endpoint_config: Dict[str, Any] = {}
    
    # Status and validation
    status: Literal["draft", "validated", "active", "inactive", "error"] = "draft"
    validation_results: Dict[str, Any] = {}
    last_tested: Optional[datetime] = None
    
    # Profile management
    is_shared: bool = False
    shared_with: List[PyObjectId] = []
    usage_count: int = 0
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }

class TestResult(BaseModel):
    """Test results for model configurations"""
    
    id: Annotated[PyObjectId, Field(default_factory=PyObjectId, alias="_id")]
    model_config_id: PyObjectId
    user_id: PyObjectId
    
    # Test metadata
    test_type: Literal["connectivity", "capability", "performance", "security", "full"]
    test_version: str = "1.0"
    
    # Test results
    results: Dict[str, Any] = {}
    overall_score: Optional[float] = None
    status: Literal["passed", "failed", "partial", "error"] = "error"
    
    # Recommendations
    recommendations: List[str] = []
    issues_found: List[str] = []
    
    # Timestamps
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }

class WorkflowSession(BaseModel):
    """Workflow session tracking for LangGraph workflows"""
    
    id: Annotated[PyObjectId, Field(default_factory=PyObjectId, alias="_id")]
    user_id: PyObjectId
    session_id: str
    
    # Workflow metadata
    workflow_type: Literal["model_config", "profile_management", "security_test"]
    status: Literal["active", "completed", "failed", "abandoned"] = "active"
    
    # Progress tracking
    current_step: str = "start"
    steps_completed: List[str] = []
    total_steps: Optional[int] = None
    
    # Workflow data
    workflow_data: Dict[str, Any] = {}
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime  # Auto-expire old sessions
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }

# Request/Response models for API endpoints
class ModelConfigRequest(BaseModel):
    """Request model for creating/updating model configurations"""
    config_name: str
    model_type: Literal["openai", "anthropic", "google", "custom", "opensource"]
    model_name: str
    description: Optional[str] = None
    tags: List[str] = []
    parameters: Dict[str, Any] = {}
    credentials: Dict[str, Any] = {}
    endpoint_config: Dict[str, Any] = {}
    save_as_profile: bool = False

class ModelConfigResponse(BaseModel):
    """Response model for model configurations"""
    id: str
    config_name: str
    model_type: str
    model_name: str
    status: str
    created_at: datetime
    updated_at: datetime
    validation_results: Optional[Dict[str, Any]] = None
    last_tested: Optional[datetime] = None

class TestRequest(BaseModel):
    """Request model for testing model configurations"""
    model_config_id: str
    test_types: List[str] = ["connectivity", "capability", "performance", "security"]
    test_parameters: Dict[str, Any] = {}

class WorkflowStatusResponse(BaseModel):
    """Response model for workflow status"""
    session_id: str
    workflow_type: str
    status: str
    current_step: str
    progress_percentage: Optional[float] = None
    error_message: Optional[str] = None
    result_data: Optional[Dict[str, Any]] = None