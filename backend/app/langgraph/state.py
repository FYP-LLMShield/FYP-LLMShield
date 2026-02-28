from typing import Dict, Any, List, Optional, TypedDict
from datetime import datetime

class ModelConfigState(TypedDict):
    """State for model configuration workflow"""
    
    # Session information
    user_id: str
    session_id: str
    
    # Model configuration data
    model_type: str
    model_name: str
    parameters: Dict[str, Any]
    credentials: Dict[str, Any]
    endpoint_config: Dict[str, Any]
    profile_name: str
    save_as_profile: bool
    
    # Workflow state
    current_step: str
    steps_completed: List[str]
    
    # Validation results
    is_valid: bool
    validation_results: Dict[str, Any]
    
    # Connection test results
    is_connected: bool
    connection_test_results: Dict[str, Any]
    
    # Capability test results
    capability_test_results: Dict[str, Any]
    
    # Error handling
    error_message: Optional[str]
    retry_count: int
    
    # Timestamps
    created_at: datetime
    updated_at: datetime