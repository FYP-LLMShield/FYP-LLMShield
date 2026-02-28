"""
Data Poisoning API Routes
=========================
FastAPI routes for the Data Poisoning feature.
Provides endpoints for model management and prompt generation.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field

from app.utils.auth import get_current_user
from app.services.data_poisoning_service import DataPoisoningService


logger = logging.getLogger(__name__)

# Initialize service (will be created once and reused)
_service_instance: Optional[DataPoisoningService] = None


def get_service() -> DataPoisoningService:
    """Get or create the DataPoisoningService instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = DataPoisoningService()
    return _service_instance


# Request/Response Models
class GenerateRequest(BaseModel):
    """Request model for comparison generation"""

    model_id: str = Field(
        ...,
        description="Model ID: 'llama32', 'tinyllama', or 'qwen'",
        example="llama32"
    )
    prompt: str = Field(
        ...,
        description="The prompt to send to both models",
        example="What is artificial intelligence?"
    )


class GenerateResponse(BaseModel):
    """Response model for comparison generation"""

    success: bool = Field(description="Whether generation was successful")
    safe_response: Optional[str] = Field(None, description="Response from safe model")
    poison_response: Optional[str] = Field(None, description="Response from poisoned model")
    generation_time_ms: int = Field(description="Time taken for generation in milliseconds")
    model_name: str = Field(description="Name of the model used")
    prompt: Optional[str] = Field(None, description="The prompt that was sent")
    error: Optional[str] = Field(None, description="Error message if generation failed")


class ModelInfo(BaseModel):
    """Information about available models"""

    id: str = Field(description="Model ID")
    name: str = Field(description="Human-readable model name")
    size: str = Field(description="Model size")
    description: str = Field(description="Model description")


class ModelsResponse(BaseModel):
    """Response containing list of available models"""

    models: list[ModelInfo]


class HealthResponse(BaseModel):
    """Health check response"""

    status: str = Field(description="Health status")
    cached_models: list[str] = Field(description="Currently cached models")
    cache_size: int = Field(description="Number of cached model pairs")
    max_cache_size: int = Field(description="Maximum cache size")


# Create router
router = APIRouter()


@router.get(
    "/models",
    response_model=ModelsResponse,
    summary="Get Available Models",
    tags=["Models"]
)
async def get_available_models(
    service: DataPoisoningService = Depends(get_service)
) -> ModelsResponse:
    """
    Get list of available models for comparison.

    Returns:
        List of 3 available GGUF models (Llama3.2, TinyLlama, Qwen)
    """
    try:
        # Model metadata
        model_metadata = {
            "llama32": {
                "id": "llama32",
                "name": "Llama 3.2",
                "size": "1B",
                "description": "Meta's Llama 3.2 causal language model (GGUF optimized)"
            },
            "tinyllama": {
                "id": "tinyllama",
                "name": "TinyLlama",
                "size": "1.1B",
                "description": "Lightweight Llama variant for fast inference (GGUF optimized)"
            },
            "qwen": {
                "id": "qwen",
                "name": "Qwen",
                "size": "0.5B",
                "description": "Alibaba's Qwen small language model (GGUF optimized)"
            }
        }

        available_model_ids = service.get_available_models()
        models = [ModelInfo(**model_metadata[model_id]) for model_id in available_model_ids if model_id in model_metadata]

        return ModelsResponse(models=models)
    except Exception as e:
        logger.error(f"Error fetching models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch available models"
        )


@router.post(
    "/generate",
    response_model=GenerateResponse,
    summary="Generate Model Comparison",
    tags=["Generation"]
)
async def generate_comparison(
    request: GenerateRequest,
    service: DataPoisoningService = Depends(get_service)
) -> GenerateResponse:
    """
    Generate responses from both safe and poisoned model variants.

    Sends the same prompt to safe and poisoned versions of the selected model
    and returns both responses for comparison.

    Args:
        request: GenerateRequest containing model_id and prompt

    Returns:
        GenerateResponse with safe/poison responses and metadata

    Raises:
        HTTPException 400: Invalid model ID
        HTTPException 422: Invalid prompt
        HTTPException 503: Model loading failed or insufficient memory
        HTTPException 504: Generation timeout
    """
    # Validate request
    if request.model_id not in ["llama32", "tinyllama", "qwen"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid model_id: {request.model_id}. Must be 'llama32', 'tinyllama', or 'qwen'"
        )

    if not request.prompt or len(request.prompt.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Prompt cannot be empty"
        )

    if len(request.prompt) > 2000:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Prompt is too long (max 2000 characters)"
        )

    # Log request
    logger.info(
        f"Generating comparison for model {request.model_id}"
    )

    try:
        # Generate comparison
        result = await service.generate_comparison(
            model_name=request.model_id,
            prompt=request.prompt
        )

        # Check for success
        if not result.get("success", False):
            error_msg = result.get("error", "Unknown error")
            logger.warning(f"Generation failed: {error_msg}")

            if "Insufficient memory" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="System out of memory. Please try again later."
                )
            elif "timeout" in error_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Generation took too long. Please try a shorter prompt."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Failed to generate responses: {error_msg}"
                )

        return GenerateResponse(
            success=True,
            safe_response=result.get("safe_response"),
            poison_response=result.get("poison_response"),
            generation_time_ms=result.get("generation_time_ms", 0),
            model_name=result.get("model_name"),
            prompt=result.get("prompt")
        )

    except Exception as e:
        logger.error(f"Unexpected error during generation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    tags=["System"]
)
async def health_check(
    service: DataPoisoningService = Depends(get_service)
) -> HealthResponse:
    """
    Check service health and cache status.

    Returns:
        Health status with cache information
    """
    try:
        cache_stats = service.get_cache_stats()
        return HealthResponse(
            status="healthy",
            cached_models=cache_stats.get("cached_models", []),
            cache_size=cache_stats.get("cache_size", 0),
            max_cache_size=cache_stats.get("max_cache_size", 2)
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service health check failed"
        )


@router.post(
    "/preload/{model_id}",
    summary="Preload Model",
    tags=["Models"]
)
async def preload_model(
    model_id: str,
    service: DataPoisoningService = Depends(get_service)
) -> dict:
    """
    Preload a model into cache when user selects it.
    This ensures instant generation when user sends a prompt.

    Args:
        model_id: ID of model to preload

    Returns:
        Status dict with success/error information
    """
    if model_id not in ["llama32", "tinyllama", "qwen"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid model_id: {model_id}"
        )

    try:
        logger.info(f"Preloading model: {model_id}")
        result = await service.preload_model(model_id)

        if result.get("success"):
            return {
                "success": True,
                "message": f"Model {model_id} is ready",
                "model_name": model_id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Failed to load model: {result.get('error', 'Unknown error')}"
            )
    except Exception as e:
        logger.error(f"Error preloading model: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Preload failed: {str(e)}"
        )


@router.post(
    "/unload/{model_id}",
    summary="Unload Model",
    tags=["Models"]
)
async def unload_model(
    model_id: str,
    current_user = Depends(get_current_user),
    service: DataPoisoningService = Depends(get_service)
) -> dict:
    """
    Explicitly unload a model from cache to free memory.

    Args:
        model_id: ID of model to unload

    Returns:
        Success message
    """
    if model_id not in ["llama32", "tinyllama", "qwen"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid model_id: {model_id}"
        )

    try:
        service.unload_model(model_id)
        logger.info(f"User {current_user.email} unloaded model {model_id}")
        return {
            "success": True,
            "message": f"Model {model_id} unloaded successfully"
        }
    except Exception as e:
        logger.error(f"Error unloading model: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unload model"
        )


