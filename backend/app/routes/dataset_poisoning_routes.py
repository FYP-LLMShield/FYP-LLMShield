"""
Dataset Poisoning Detection Routes
===================================
API endpoints for dataset poisoning analysis.
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import JSONResponse
import logging
import io

from app.models.dataset_poisoning import (
    DatasetAnalysisRequest,
    DatasetAnalysisResult,
)
from app.services.dataset_poisoning_service import get_detector
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dataset-poisoning", tags=["dataset-poisoning"])


@router.post("/analyze/text", response_model=DatasetAnalysisResult)
async def analyze_text_dataset(
    request: DatasetAnalysisRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Analyze dataset from text content (CSV, JSON, TSV).
    """
    try:
        if not request.text_content:
            raise HTTPException(status_code=400, detail="No text content provided")

        detector = get_detector()
        result = await detector.analyze_dataset(
            dataset_name=request.dataset_name,
            input_method="text",
            dataset_content=request.text_content,
            sample_size=request.sample_size,
        )

        return result

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Analysis failed")


@router.post("/analyze/file", response_model=DatasetAnalysisResult)
async def analyze_file_dataset(
    dataset_name: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Analyze dataset from file upload (CSV, JSON, XLSX, ZIP, etc.).
    """
    try:
        # Read file content
        content = await file.read()

        # Check file size (max 500MB)
        if len(content) > 500 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large (max 500MB)")

        # Decode content
        try:
            text_content = content.decode("utf-8")
        except UnicodeDecodeError:
            # Try latin-1 as fallback
            text_content = content.decode("latin-1")

        detector = get_detector()
        result = await detector.analyze_dataset(
            dataset_name=dataset_name,
            input_method="file",
            dataset_content=text_content,
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"File analysis failed: {str(e)}")


@router.post("/analyze/huggingface", response_model=DatasetAnalysisResult)
async def analyze_huggingface_dataset(
    request: DatasetAnalysisRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Analyze dataset from HuggingFace Hub.
    """
    try:
        if not request.huggingface_dataset_id:
            raise HTTPException(status_code=400, detail="HuggingFace dataset ID required")

        # Import here to avoid dependency issues
        from datasets import load_dataset
        import pandas as pd

        try:
            # Load dataset from HF
            logger.info(f"Loading HF dataset: {request.huggingface_dataset_id}")

            config = request.huggingface_config or "default"
            dataset = load_dataset(
                request.huggingface_dataset_id,
                config,
                trust_remote_code=True,
            )

            # Convert to DataFrame (use first split if multiple)
            if isinstance(dataset, dict):
                split = list(dataset.keys())[0]
                df = dataset[split].to_pandas()
            else:
                df = dataset.to_pandas()

            # Convert DataFrame to CSV string for analysis
            csv_buffer = io.StringIO()
            df.to_csv(csv_buffer, index=False)
            text_content = csv_buffer.getvalue()

            detector = get_detector()
            result = await detector.analyze_dataset(
                dataset_name=request.huggingface_dataset_id,
                input_method="huggingface",
                dataset_content=text_content,
                sample_size=request.sample_size,
            )

            return result

        except Exception as e:
            logger.error(f"HF dataset loading error: {e}", exc_info=True)
            raise HTTPException(
                status_code=400,
                detail=f"Could not load HuggingFace dataset: {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"HF analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Analysis failed")


@router.get("/results/{analysis_id}", response_model=DatasetAnalysisResult)
async def get_analysis_result(
    analysis_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Retrieve a previous analysis result.
    """
    try:
        detector = get_detector()
        result = detector.get_analysis_result(analysis_id)

        if not result:
            raise HTTPException(status_code=404, detail="Analysis not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Retrieval error: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve result")


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "dataset-poisoning-detection",
        "version": "1.0.0",
    }
