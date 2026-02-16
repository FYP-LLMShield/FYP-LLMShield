"""
Dataset Poisoning Detection Routes
===================================
API endpoints for dataset poisoning analysis.
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import JSONResponse
import logging
import io
import asyncio
from concurrent.futures import TimeoutError as FuturesTimeoutError

from app.models.dataset_poisoning import (
    DatasetAnalysisRequest,
    DatasetAnalysisResult,
)
from app.services.dataset_poisoning_service import get_detector
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["dataset-poisoning"])


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
            dataset_id = request.huggingface_dataset_id.strip()
            logger.info(f"Raw input: {dataset_id}")

            # Extract dataset ID from full URL if provided
            # Handle formats like:
            # - openbmb/UltraData-Math
            # - https://huggingface.co/datasets/openbmb/UltraData-Math
            # - https://huggingface.co/datasets/openbmb/UltraData-Math/
            if "huggingface.co" in dataset_id:
                # Remove protocol
                dataset_id = dataset_id.replace("https://", "").replace("http://", "")
                # Remove domain
                dataset_id = dataset_id.replace("huggingface.co/", "")
                # Remove /datasets/ if present
                dataset_id = dataset_id.replace("datasets/", "")
                # Remove trailing slash
                dataset_id = dataset_id.rstrip("/")

            logger.info(f"Extracted dataset ID: {dataset_id}")

            # Load without trust_remote_code (deprecated in newer versions)
            # With timeout to prevent hanging on large datasets
            dataset = None
            last_error = None
            LOAD_TIMEOUT = 120  # 2 minute timeout

            async def load_with_timeout():
                """Load dataset with timeout using asyncio."""
                loop = asyncio.get_event_loop()
                try:
                    # Run blocking load_dataset in thread pool with timeout
                    if request.huggingface_config:
                        return await asyncio.wait_for(
                            loop.run_in_executor(None, load_dataset, dataset_id, request.huggingface_config),
                            timeout=LOAD_TIMEOUT
                        )
                    else:
                        return await asyncio.wait_for(
                            loop.run_in_executor(None, load_dataset, dataset_id),
                            timeout=LOAD_TIMEOUT
                        )
                except asyncio.TimeoutError:
                    raise TimeoutError(f"Dataset loading timed out after {LOAD_TIMEOUT}s. Dataset may be too large.")

            try:
                logger.info(f"Loading dataset: {dataset_id} (timeout: {LOAD_TIMEOUT}s)")
                dataset = await load_with_timeout()
            except TimeoutError as e:
                last_error = str(e)
                logger.warning(f"Dataset load timeout: {last_error}")
            except ValueError as e:
                last_error = str(e)
                # Check if it's a config missing error
                if "config name is missing" in str(e).lower():
                    logger.info(f"Config required for {dataset_id}. Attempting to load first available config...")
                    try:
                        # Try to extract available configs from error message
                        error_str = str(e)
                        if "example of usage" in error_str.lower():
                            import re
                            configs = re.findall(r"'([a-z_]+)'", error_str)
                            if configs:
                                first_config = configs[0]
                                logger.info(f"Trying with config: {first_config}")
                                dataset = await load_with_timeout()  # This will fail too, but try anyway
                    except Exception as retry_error:
                        last_error = str(retry_error)
            except Exception as e:
                last_error = str(e)

            # If still not loaded, try with trust_remote_code=False (without timeout for fallback)
            if dataset is None and not isinstance(last_error, TimeoutError):
                try:
                    logger.info(f"Retrying with trust_remote_code=False...")
                    if request.huggingface_config:
                        dataset = load_dataset(dataset_id, request.huggingface_config, trust_remote_code=False)
                    else:
                        dataset = load_dataset(dataset_id, trust_remote_code=False)
                except Exception as e:
                    last_error = str(e)

            # If still failed, raise the error
            if dataset is None:
                raise Exception(last_error or "Failed to load dataset")

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
            error_msg = str(e).lower()
            logger.error(f"HF dataset loading error: {e}", exc_info=True)

            # Provide specific error messages for common issues
            if "timeout" in error_msg or "timed out" in error_msg:
                raise HTTPException(
                    status_code=408,
                    detail=f"Dataset loading timed out (>120s). Dataset is too large or network is slow. Try a smaller dataset like 'imdb', 'ag_news', or 'wikitext'."
                )
            elif "trust_remote_code" in error_msg or "loading script" in error_msg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Dataset '{dataset_id}' requires a loading script which is no longer supported. Please use a dataset in standard format (CSV, Parquet, etc.) or check the dataset's documentation for alternative versions."
                )
            elif "config name is missing" in error_msg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Dataset '{dataset_id}' requires specifying a config/subset. Please provide config name in the 'Config/Subset' field (e.g., 'ach_asr', 'ach_tts'). Check dataset page for available configs."
                )
            elif "couldn't find" in error_msg or "filenotfound" in error_msg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Dataset '{dataset_id}' not found. Please verify: (1) You're using a DATASET, not a MODEL (datasets.huggingface.co, not huggingface.co/models), (2) Format is 'username/dataset-name' (e.g., 'wikitext/wikitext-103-v1'), (3) Dataset name is spelled correctly"
                )
            elif "authentica" in error_msg or "unauthorized" in error_msg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot access dataset '{dataset_id}'. It may be private or require authentication."
                )
            else:
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
