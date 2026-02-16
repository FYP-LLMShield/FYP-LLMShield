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
from app.models.user import UserInDB

logger = logging.getLogger(__name__)
router = APIRouter(tags=["dataset-poisoning"])


@router.post("/analyze/text", response_model=DatasetAnalysisResult)
async def analyze_text_dataset(
    request: DatasetAnalysisRequest,
    current_user: UserInDB = Depends(get_current_user),
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
    current_user: UserInDB = Depends(get_current_user),
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


@router.post("/list/huggingface")
async def list_huggingface_jsonl_files(
    request: DatasetAnalysisRequest,
):
    """
    List all .jsonl and .json files in a HuggingFace dataset.

    Returns: List of available .jsonl and .json files
    """
    try:
        if not request.huggingface_dataset_id:
            raise HTTPException(status_code=400, detail="HuggingFace dataset ID or URL required")

        dataset_id = request.huggingface_dataset_id.strip()
        logger.info(f"📋 Listing .jsonl and .json files in: {dataset_id}")

        # Extract dataset ID from URL if provided
        if "huggingface.co" in dataset_id:
            dataset_id = dataset_id.replace("https://", "").replace("http://", "")
            dataset_id = dataset_id.replace("huggingface.co/", "")
            dataset_id = dataset_id.replace("datasets/", "")
            if "/tree/" in dataset_id:
                dataset_id = dataset_id.split("/tree/")[0]
            dataset_id = dataset_id.rstrip("/")

        from huggingface_hub import list_repo_files

        try:
            files = list_repo_files(repo_id=dataset_id, repo_type="dataset")
            json_files = [f for f in files if f.endswith(('.jsonl', '.json'))]

            logger.info(f"📂 All files: {files}")
            logger.info(f"📋 Filtered JSON files: {json_files}")

            if not json_files:
                raise HTTPException(
                    status_code=400,
                    detail=f"No .jsonl or .json files found in dataset '{dataset_id}'. Available files: {', '.join(files[:5])}{'...' if len(files) > 5 else ''}"
                )

            logger.info(f"✅ Found {len(json_files)} file(s): {json_files}")

            return {
                "success": True,
                "dataset_id": dataset_id,
                "jsonl_files": json_files,
                "file_count": len(json_files)
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ HF list error: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Could not access dataset files: {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ HF list error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


@router.post("/preview/huggingface")
async def preview_huggingface_jsonl_dataset(
    request: DatasetAnalysisRequest,
):
    """
    Preview a specific .jsonl or .json file from a HuggingFace dataset.

    Returns: First 10 sample rows for preview
    """
    try:
        if not request.huggingface_dataset_id:
            raise HTTPException(status_code=400, detail="HuggingFace dataset ID or URL required")

        dataset_id = request.huggingface_dataset_id.strip()
        jsonl_filename = request.text_content.strip() if request.text_content else None

        if not jsonl_filename:
            raise HTTPException(status_code=400, detail="JSON/JSONL filename required for preview")

        logger.info(f"👁️ Previewing: {dataset_id}/{jsonl_filename}")

        # Extract dataset ID from URL if provided
        if "huggingface.co" in dataset_id:
            dataset_id = dataset_id.replace("https://", "").replace("http://", "")
            dataset_id = dataset_id.replace("huggingface.co/", "")
            dataset_id = dataset_id.replace("datasets/", "")
            if "/tree/" in dataset_id:
                dataset_id = dataset_id.split("/tree/")[0]
            dataset_id = dataset_id.rstrip("/")

        from huggingface_hub import hf_hub_download

        try:
            logger.info(f"📥 Downloading for preview: {jsonl_filename}")
            file_path = hf_hub_download(repo_id=dataset_id, repo_type="dataset", filename=jsonl_filename)

            # Read and parse first 10 rows with encoding handling
            import json
            preview_rows = []
            total_rows = 0

            # Try different encodings
            encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'iso-8859-1', 'cp1252']
            file_opened = False

            for encoding in encodings:
                try:
                    with open(file_path, 'r', encoding=encoding, errors='ignore') as f:
                        for line in f:
                            if line.strip():
                                try:
                                    obj = json.loads(line)
                                    total_rows += 1
                                    if len(preview_rows) < 10:
                                        preview_rows.append(obj)
                                except json.JSONDecodeError:
                                    continue
                    file_opened = True
                    logger.info(f"✅ File decoded with encoding: {encoding}")
                    break
                except (UnicodeDecodeError, LookupError):
                    continue

            if not file_opened:
                raise Exception("Could not decode file with any supported encoding")

            logger.info(f"✅ Preview loaded: {len(preview_rows)} rows shown (Total: {total_rows})")

            return {
                "success": True,
                "dataset_id": dataset_id,
                "jsonl_file": jsonl_filename,
                "total_rows": total_rows,
                "preview_rows": preview_rows,
                "preview_count": len(preview_rows)
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ HF preview error: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Could not access file: {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ HF preview error: {e}")
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")


@router.post("/scan/huggingface")
async def scan_huggingface_jsonl_dataset(
    request: DatasetAnalysisRequest,
):
    """
    Scan a HuggingFace dataset for .jsonl files and analyze them with LLM Shield.

    Accepts: HuggingFace dataset URL or dataset ID
    Automatically detects and scans .jsonl files
    """
    try:
        if not request.huggingface_dataset_id:
            raise HTTPException(status_code=400, detail="HuggingFace dataset ID or URL required")

        dataset_id = request.huggingface_dataset_id.strip()
        logger.info(f"🔍 Checking for .jsonl files in: {dataset_id}")

        # Extract dataset ID from URL if provided
        if "huggingface.co" in dataset_id:
            # Parse URL: https://huggingface.co/datasets/namespace/repo-name/tree/main
            # Or: https://huggingface.co/datasets/namespace/repo-name
            dataset_id = dataset_id.replace("https://", "").replace("http://", "")
            dataset_id = dataset_id.replace("huggingface.co/", "")
            dataset_id = dataset_id.replace("datasets/", "")
            # Remove /tree/main or /tree/branch or any trailing path
            if "/tree/" in dataset_id:
                dataset_id = dataset_id.split("/tree/")[0]
            # Remove trailing slashes
            dataset_id = dataset_id.rstrip("/")

        # Check for .jsonl and .json files in the dataset
        from huggingface_hub import list_repo_files

        try:
            files = list_repo_files(repo_id=dataset_id, repo_type="dataset")
            json_files = [f for f in files if f.endswith(('.jsonl', '.json'))]

            if not json_files:
                raise HTTPException(
                    status_code=400,
                    detail=f"No .jsonl or .json files found in dataset '{dataset_id}'. Available files: {', '.join(files[:5])}{'...' if len(files) > 5 else ''}"
                )

            logger.info(f"✅ Found {len(json_files)} file(s): {json_files}")

            # Download and scan the selected file (or first file if none specified)
            from huggingface_hub import hf_hub_download

            # Try to get filename from jsonl_file or text_content (for backward compatibility)
            selected_file = request.jsonl_file or (request.text_content if request.text_content and request.text_content.endswith(('.jsonl', '.json')) else None)

            if selected_file and selected_file in json_files:
                json_file = selected_file
            else:
                json_file = json_files[0]

            logger.info(f"📥 Downloading: {json_file}")

            file_path = hf_hub_download(repo_id=dataset_id, repo_type="dataset", filename=json_file)

            # Read file content
            with open(file_path, 'rb') as f:
                content = f.read()

            # Scan with LLM Shield
            from app.services.llm_shield_scanner_service import get_scanner_service
            scanner = get_scanner_service()

            result = scanner.scan_file(content, json_file)

            if not result.get("success", False):
                raise HTTPException(status_code=500, detail=result.get("error", "Scan failed"))

            logger.info(f"✅ HuggingFace file scan completed: {json_file}")
            return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ HF .jsonl detection error: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Could not access dataset files: {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ HF scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


@router.post("/analyze/huggingface", response_model=DatasetAnalysisResult)
async def analyze_huggingface_dataset(
    request: DatasetAnalysisRequest,
    current_user: UserInDB = Depends(get_current_user),
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


@router.post("/scan/text")
async def scan_text_with_llm_shield(
    request: DatasetAnalysisRequest,
):
    """
    Scan text input (single or multiple rows) for poisoning using LLM Shield MultiTaskBERT model.

    Supports:
    - Single text input: Returns single prediction with probabilities
    - Multiple rows (CSV/JSON/JSONL): Returns per-row analysis with statistics
    """
    try:
        if not request.text_content or not request.text_content.strip():
            raise HTTPException(status_code=400, detail="Text input is empty")

        from app.services.llm_shield_scanner_service import get_scanner_service
        scanner = get_scanner_service()

        text_content = request.text_content.strip()

        # Check if input contains multiple lines/rows
        lines = text_content.split('\n')
        non_empty_lines = [line for line in lines if line.strip()]

        # If single line, process as single text
        if len(non_empty_lines) == 1:
            result = scanner.scan_text(text_content)
            if not result.get("success", False):
                raise HTTPException(status_code=500, detail=result.get("error", "Scan failed"))
            logger.info(f"✅ LLM Shield single text scan completed")
            return result

        # Multiple rows - treat as dataset
        # Convert pasted text to bytes and scan as if it were a file
        content_bytes = text_content.encode('utf-8')

        # Try to determine format and scan
        result = scanner.scan_file(content_bytes, "data.csv")

        if not result.get("success", False):
            raise HTTPException(status_code=500, detail=result.get("error", "Scan failed"))

        logger.info(f"✅ LLM Shield text dataset scan completed")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ LLM Shield text scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


@router.post("/scan/upload")
async def scan_dataset_with_llm_shield(
    file: UploadFile = File(...)
):
    """
    Scan a dataset file for poisoning using LLM Shield MultiTaskBERT model.

    Accepts: .jsonl and .csv files only
    Returns: Per-row security classification (Safe/Poisoned)
    """
    try:
        # Validate file extension
        filename = file.filename.lower() if file.filename else ""
        if not filename.endswith(('.jsonl', '.csv')):
            raise HTTPException(
                status_code=400,
                detail="Only .jsonl and .csv files are supported"
            )

        # Read file content
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="File is empty")

        # Get scanner service and scan file
        from app.services.llm_shield_scanner_service import get_scanner_service
        scanner = get_scanner_service()

        result = scanner.scan_file(content, file.filename)

        if not result.get("success", False):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Scan failed")
            )

        logger.info(f"✅ LLM Shield scan completed for {file.filename}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ LLM Shield scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "dataset-poisoning-detection",
        "version": "1.0.0",
    }
