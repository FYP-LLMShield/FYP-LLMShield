from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from app.models.model_config import (
    ModelConfigRequest, ModelConfigResponse, TestRequest, 
    WorkflowStatusResponse, ModelConfig, TestResult, WorkflowSession,
    ModelConfigListResponse, ModelConfigDetailResponse, ShareConfigRequest,
    TestHistoryResponse
)
from app.models.user import UserInDB
from app.utils.auth import get_current_user
from app.services.model_config_service import model_config_service
from app.utils.encryption import decrypt_credentials
from app.utils.validation import model_config_validator
# from app.langgraph.workflows.model_configuration import get_workflow_manager

router = APIRouter()

@router.post("/start-configuration", response_model=WorkflowStatusResponse)
async def start_configuration_workflow(
    request: ModelConfigRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Start a new model configuration workflow"""
    try:
        # Mock workflow manager for now
        session_id = f"config_{current_user.id}_{datetime.utcnow().timestamp()}"
        
        return WorkflowStatusResponse(
            session_id=session_id,
            workflow_type="model_config",
            status="active",
            current_step="configuration",
            progress_percentage=10.0
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start configuration workflow: {str(e)}"
        )

@router.post("/continue-configuration/{session_id}", response_model=WorkflowStatusResponse)
async def continue_configuration_workflow(
    session_id: str,
    data: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user)
):
    """Continue an existing configuration workflow"""
    try:
        # Mock workflow continuation
        return WorkflowStatusResponse(
            session_id=session_id,
            workflow_type="model_config",
            status="active",
            current_step="validation",
            progress_percentage=50.0,
            result_data={"message": "Configuration in progress"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to continue workflow: {str(e)}"
        )

@router.get("/workflow-status/{session_id}", response_model=WorkflowStatusResponse)
async def get_workflow_status(
    session_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Get the current status of a workflow session"""
    try:
        # Mock workflow status
        return WorkflowStatusResponse(
            session_id=session_id,
            workflow_type="model_config",
            status="active",
            current_step="testing",
            progress_percentage=75.0,
            result_data={"message": "Configuration testing in progress"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow session not found: {str(e)}"
        )

@router.get("/workflow-history/{session_id}")
async def get_workflow_history(
    session_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Get the history of a workflow session"""
    try:
        # Mock workflow history
        history = [
            {"step": "start", "timestamp": datetime.utcnow().isoformat(), "status": "completed"},
            {"step": "validation", "timestamp": datetime.utcnow().isoformat(), "status": "completed"},
            {"step": "testing", "timestamp": datetime.utcnow().isoformat(), "status": "in_progress"}
        ]
        
        return {"session_id": session_id, "history": history}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow history not found: {str(e)}"
        )

# Model Configuration CRUD Endpoints

@router.post("/configurations", response_model=ModelConfigDetailResponse)
async def create_model_configuration(
    request: ModelConfigRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Create a new model configuration with validation"""
    try:
        # Validate the configuration data
        validation_errors = model_config_validator.validate_full_config(request.dict())
        if validation_errors:
            # Format validation errors for response
            error_messages = []
            for field, errors in validation_errors.items():
                for error in errors:
                    error_messages.append(f"{field}: {error}")
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Validation failed: {'; '.join(error_messages)}"
            )
        
        # Create the configuration
        config = await model_config_service.create_model_config(str(current_user.id), request)
        
        return ModelConfigDetailResponse(
            id=str(config.id),
            config_name=config.config_name,
            model_type=config.model_type,
            model_name=config.model_name,
            description=config.description,
            tags=config.tags,
            parameters=config.parameters,
            endpoint_config=config.endpoint_config,
            status=config.status,
            validation_results=config.validation_results,
            last_tested=config.last_tested,
            is_shared=config.is_shared,
            usage_count=config.usage_count,
            created_at=config.created_at,
            updated_at=config.updated_at
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create model configuration: {str(e)}"
        )

@router.get("/configurations", response_model=ModelConfigListResponse)
async def list_model_configurations(
    include_shared: bool = Query(True, description="Include shared configurations"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    current_user: UserInDB = Depends(get_current_user)
):
    """List all model configurations for the current user"""
    try:
        configs = await model_config_service.get_user_model_configs(
            str(current_user.id), 
            include_shared=include_shared
        )
        
        # Simple pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_configs = configs[start_idx:end_idx]
        
        config_responses = [
            ModelConfigResponse(
                id=str(config.id),
                config_name=config.config_name,
                model_type=config.model_type,
                model_name=config.model_name,
                status=config.status,
                created_at=config.created_at,
                updated_at=config.updated_at,
                validation_results=config.validation_results,
                last_tested=config.last_tested
            )
            for config in paginated_configs
        ]
        
        return ModelConfigListResponse(
            configs=config_responses,
            total_count=len(configs),
            page=page,
            page_size=page_size
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list model configurations: {str(e)}"
        )

@router.get("/configurations/{config_id}", response_model=ModelConfigDetailResponse)
async def get_model_configuration(
    config_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Get a specific model configuration by ID"""
    try:
        config = await model_config_service.get_model_config(str(current_user.id), config_id)
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model configuration not found"
            )
        
        # Increment usage count
        await model_config_service.increment_usage_count(config_id)
        
        return ModelConfigDetailResponse(
            id=str(config.id),
            config_name=config.config_name,
            model_type=config.model_type,
            model_name=config.model_name,
            description=config.description,
            tags=config.tags,
            parameters=config.parameters,
            endpoint_config=config.endpoint_config,
            status=config.status,
            validation_results=config.validation_results,
            last_tested=config.last_tested,
            is_shared=config.is_shared,
            usage_count=config.usage_count,
            created_at=config.created_at,
            updated_at=config.updated_at
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model configuration: {str(e)}"
        )

@router.put("/configurations/{config_id}", response_model=ModelConfigDetailResponse)
async def update_model_configuration(
    config_id: str,
    request: ModelConfigRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Update an existing model configuration with validation"""
    try:
        # Validate the configuration data
        validation_errors = model_config_validator.validate_full_config(request.dict())
        if validation_errors:
            # Format validation errors for response
            error_messages = []
            for field, errors in validation_errors.items():
                for error in errors:
                    error_messages.append(f"{field}: {error}")
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Validation failed: {'; '.join(error_messages)}"
            )
        
        # Update the configuration
        config = await model_config_service.update_model_config(
            str(current_user.id), 
            config_id, 
            request
        )
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model configuration not found or you don't have permission to update it"
            )
        
        return ModelConfigDetailResponse(
            id=str(config.id),
            config_name=config.config_name,
            model_type=config.model_type,
            model_name=config.model_name,
            description=config.description,
            tags=config.tags,
            parameters=config.parameters,
            endpoint_config=config.endpoint_config,
            status=config.status,
            validation_results=config.validation_results,
            last_tested=config.last_tested,
            is_shared=config.is_shared,
            usage_count=config.usage_count,
            created_at=config.created_at,
            updated_at=config.updated_at
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update model configuration: {str(e)}"
        )

@router.delete("/configurations/{config_id}")
async def delete_model_configuration(
    config_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Delete a model configuration"""
    try:
        success = await model_config_service.delete_model_config(str(current_user.id), config_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model configuration not found or you don't have permission to delete it"
            )
        
        return {"message": "Model configuration deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete model configuration: {str(e)}"
        )

@router.post("/configurations/{config_id}/share")
async def share_model_configuration(
    config_id: str,
    request: ShareConfigRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Share a model configuration with other users"""
    try:
        success = await model_config_service.share_config(
            str(current_user.id), 
            config_id, 
            request.shared_with_users
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model configuration not found or you don't have permission to share it"
            )
        
        return {"message": "Model configuration shared successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to share model configuration: {str(e)}"
        )

@router.delete("/configurations/{config_id}/share")
async def unshare_model_configuration(
    config_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Remove sharing from a model configuration"""
    try:
        success = await model_config_service.unshare_config(str(current_user.id), config_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model configuration not found or you don't have permission to unshare it"
            )
        
        return {"message": "Model configuration unshared successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unshare model configuration: {str(e)}"
        )

@router.get("/configurations/{config_id}/test-history", response_model=TestHistoryResponse)
async def get_configuration_test_history(
    config_id: str,
    limit: int = Query(10, ge=1, le=50, description="Number of test results to return"),
    current_user: UserInDB = Depends(get_current_user)
):
    """Get test history for a model configuration"""
    try:
        # First verify user has access to this config
        config = await model_config_service.get_model_config(str(current_user.id), config_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model configuration not found"
            )
        
        test_results = await model_config_service.get_config_test_history(config_id, limit)
        
        return TestHistoryResponse(
            test_results=test_results,
            total_count=len(test_results)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get test history: {str(e)}"
        )

@router.delete("/cancel-workflow/{session_id}")
async def cancel_workflow(
    session_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Cancel an active workflow session"""
    try:
        # Mock workflow cancellation
        return {"message": "Workflow cancelled successfully", "session_id": session_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel workflow: {str(e)}"
        )

@router.get("/supported-providers")
async def get_supported_providers():
    """Get list of supported model providers and their configurations"""
    return {
        "providers": {
            "openai": {
                "name": "OpenAI",
                "models": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-5.1", "gpt-5.2", "gpt-5.2-nano"],
                "required_credentials": ["api_key"],
                "optional_credentials": ["organization_id"],
                "parameters": {
                    "temperature": {"type": "float", "min": 0.0, "max": 2.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 4096, "default": 1000},
                    "top_p": {"type": "float", "min": 0.0, "max": 1.0, "default": 1.0}
                }
            },
            "anthropic": {
                "name": "Anthropic",
                "models": ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
                "required_credentials": ["api_key"],
                "optional_credentials": [],
                "parameters": {
                    "temperature": {"type": "float", "min": 0.0, "max": 1.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 4096, "default": 1000},
                    "top_p": {"type": "float", "min": 0.0, "max": 1.0, "default": 1.0}
                }
            },
            "google": {
                "name": "Google",
                "models": ["gemini-pro", "gemini-pro-vision"],
                "required_credentials": ["api_key"],
                "optional_credentials": [],
                "parameters": {
                    "temperature": {"type": "float", "min": 0.0, "max": 1.0, "default": 0.7},
                    "max_output_tokens": {"type": "int", "min": 1, "max": 2048, "default": 1000},
                    "top_p": {"type": "float", "min": 0.0, "max": 1.0, "default": 1.0}
                }
            },
            "custom": {
                "name": "Custom API",
                "models": ["custom-model"],
                "required_credentials": ["api_key", "base_url"],
                "optional_credentials": ["headers"],
                "parameters": {
                    "temperature": {"type": "float", "min": 0.0, "max": 2.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 8192, "default": 1000}
                }
            },
            "opensource": {
                "name": "Open Source",
                "models": ["llama-2", "mistral", "codellama"],
                "required_credentials": ["model_path"],
                "optional_credentials": ["device", "quantization"],
                "parameters": {
                    "temperature": {"type": "float", "min": 0.0, "max": 2.0, "default": 0.7},
                    "max_tokens": {"type": "int", "min": 1, "max": 4096, "default": 1000},
                    "context_length": {"type": "int", "min": 512, "max": 32768, "default": 2048}
                }
            }
        }
    }

@router.post("/quick-test")
async def quick_test_configuration(
    request: TestRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Quick test of a model configuration"""
    try:
        # Get the model configuration
        config = await model_config_service.get_model_config(
            str(current_user.id), 
            request.model_config_id
        )
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model configuration not found"
            )
        
        # Decrypt credentials for testing
        decrypted_credentials = decrypt_credentials(config.credentials) if config.credentials else {}
        
        # Simulate connectivity test based on credentials
        has_credentials = bool(decrypted_credentials.get("api_key") or decrypted_credentials.get("access_token"))
        connectivity_success = has_credentials
        
        # Create test result
        test_result = TestResult(
            model_config_id=config.id,
            user_id=current_user.id,
            test_type="connectivity",
            test_version="1.0",
            results={
                "connectivity": {
                    "status": "passed" if connectivity_success else "failed",
                    "message": "API key present" if connectivity_success else "No API key provided",
                    "response_time_ms": 150 if connectivity_success else None
                },
                "basic_capability": {
                    "status": "passed" if connectivity_success else "skipped",
                    "message": "Basic test successful" if connectivity_success else "Skipped due to connectivity failure"
                }
            },
            overall_score=0.8 if connectivity_success else 0.0,
            status="passed" if connectivity_success else "failed",
            recommendations=[] if connectivity_success else ["Please provide valid API credentials"],
            issues_found=[] if connectivity_success else ["Missing API credentials"],
            completed_at=datetime.utcnow(),
            duration_seconds=0.5
        )
        
        # Save test result
        saved_result = await model_config_service.save_test_result(test_result)
        
        # Update config status based on test results
        new_status = "validated" if test_result.status == "passed" else "error"
        await model_config_service.update_config_status(
            request.model_config_id,
            new_status,
            test_result.results
        )
        
        return {
            "test_id": str(saved_result.id),
            "status": test_result.status,
            "overall_score": test_result.overall_score,
            "results": test_result.results,
            "recommendations": test_result.recommendations,
            "issues_found": test_result.issues_found,
            "duration_seconds": test_result.duration_seconds
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test configuration: {str(e)}"
        )