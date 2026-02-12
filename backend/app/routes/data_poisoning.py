"""
Behavioral Poisoning Detection API Routes
===========================================
FastAPI routes for behavioral poisoning scan of Hugging Face models.
Replaced old data poisoning comparison feature with new HF model scanning.
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse

from app.utils.auth import get_current_user
from app.models.data_poisoning import (
    ScanRequest,
    ScanResult,
    ScanStatusResponse,
    ScanListResponse,
    ReportRequest,
)
from app.services.data_poisoning_service import get_scanner

logger = logging.getLogger(__name__)

# Create router
router = APIRouter()


@router.post(
    "/scan",
    response_model=ScanStatusResponse,
    summary="Initiate Behavioral Poisoning Scan",
    tags=["Behavioral Poisoning Scan"],
)
async def initiate_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
) -> ScanStatusResponse:
    """
    Initiate a behavioral poisoning scan on a Hugging Face model.

    Takes a Hugging Face model URL and runs file-level safety checks
    and behavioral tests to detect potential poisoning/backdoors.

    **Parameters:**
    - `model_url`: URL to the Hugging Face model (e.g., https://huggingface.co/meta-llama/Llama-2-7b)
    - `run_behavioral_tests`: Whether to run behavioral tests (more thorough but slower)
    - `max_download_size_gb`: Maximum download size limit
    - `timeout_seconds`: Timeout for the entire scan

    **Returns:**
    - `scan_id`: Unique identifier for tracking this scan
    - `status`: Current status (queued, scanning, completed, failed)
    - `progress_percent`: Progress percentage (0-100)
    """
    try:
        logger.info(f"Scan initiated by user {current_user.get('email')} for model: {request.model_url}")

        scanner = get_scanner()

        # Run scan in background
        def run_scan():
            try:
                import asyncio

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                result = loop.run_until_complete(
                    scanner.scan_model(
                        model_url=request.model_url,
                        max_download_size_gb=request.max_download_size_gb,
                        run_behavioral_tests=request.run_behavioral_tests,
                        timeout_seconds=request.timeout_seconds,
                    )
                )
                logger.info(f"Scan completed: {result.scan_id} with verdict {result.verdict}")
            except Exception as e:
                logger.error(f"Background scan failed: {e}", exc_info=True)

        background_tasks.add_task(run_scan)

        # Get the scan instance (it will be in "scanning" state initially)
        # For immediate response, we return status immediately
        scan_id = "scan_pending"  # Will be replaced after starting

        return ScanStatusResponse(
            scan_id=scan_id,
            status="queued",
            progress_percent=0,
            message="Scan queued and will start processing shortly",
            result=None,
        )

    except ValueError as e:
        logger.error(f"Invalid request: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid request: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Failed to initiate scan: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate scan. Please try again.",
        )


@router.post(
    "/scan/quick",
    response_model=ScanResult,
    summary="Quick Behavioral Poisoning Scan",
    tags=["Behavioral Poisoning Scan"],
)
async def quick_scan(
    request: ScanRequest,
    current_user: dict = Depends(get_current_user),
) -> ScanResult:
    """
    Run a quick behavioral poisoning scan (blocks until complete).
    Suitable for smaller models or when you want immediate results.

    File safety checks are always performed. Behavioral tests are optional.

    **Note:** This endpoint blocks until the scan completes.
    For large models, use `/scan` endpoint for async behavior.

    **Returns:** Complete ScanResult with verdict and risk assessment
    """
    try:
        logger.info(
            f"Quick scan initiated by user {current_user.get('email')} for model: {request.model_url}"
        )

        scanner = get_scanner()
        result = await scanner.scan_model(
            model_url=request.model_url,
            max_download_size_gb=request.max_download_size_gb,
            run_behavioral_tests=request.run_behavioral_tests,
            timeout_seconds=request.timeout_seconds,
        )

        logger.info(f"Quick scan completed: {result.scan_id} with verdict {result.verdict}")
        return result

    except ValueError as e:
        logger.error(f"Invalid request: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid request: {str(e)}"
        )
    except asyncio.TimeoutError:
        logger.error("Scan timed out")
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Scan timed out. Model may be too large or network too slow.",
        )
    except Exception as e:
        logger.error(f"Scan failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scan failed: {str(e)[:200]}",
        )


@router.get(
    "/scan/{scan_id}",
    response_model=ScanStatusResponse,
    summary="Get Scan Status",
    tags=["Behavioral Poisoning Scan"],
)
async def get_scan_status(
    scan_id: str,
    current_user: dict = Depends(get_current_user),
) -> ScanStatusResponse:
    """
    Get the status and result of a previously initiated scan.

    **Parameters:**
    - `scan_id`: The scan ID returned from the initial `/scan` request

    **Returns:**
    - Status information and the full result if completed
    """
    try:
        scanner = get_scanner()
        result = scanner.get_scan_result(scan_id)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Scan {scan_id} not found"
            )

        # Determine progress and status
        if result.status == "completed":
            progress = 100
            message = f"Scan completed with verdict: {result.verdict}"
        elif result.status == "failed":
            progress = 0
            message = f"Scan failed: {result.error_message or 'Unknown error'}"
        else:
            progress = 50  # Scanning in progress
            message = "Scan in progress..."

        return ScanStatusResponse(
            scan_id=scan_id,
            status=result.status,
            progress_percent=progress,
            message=message,
            result=result if result.status == "completed" else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving scan status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve scan status",
        )


@router.get(
    "/scans",
    response_model=ScanListResponse,
    summary="List Recent Scans",
    tags=["Behavioral Poisoning Scan"],
)
async def list_scans(
    limit: int = 10,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
) -> ScanListResponse:
    """
    List recent behavioral poisoning scans.

    **Parameters:**
    - `limit`: Maximum number of results to return (default 10, max 100)
    - `offset`: Pagination offset (default 0)

    **Returns:** List of recent scan results with pagination info
    """
    try:
        limit = min(limit, 100)  # Cap at 100

        scanner = get_scanner()
        scans, total = scanner.list_scans(limit=limit, offset=offset)

        return ScanListResponse(
            scans=scans,
            total=total,
            limit=limit,
            offset=offset,
        )

    except Exception as e:
        logger.error(f"Error listing scans: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list scans",
        )


@router.post(
    "/report/{scan_id}",
    summary="Generate Report",
    tags=["Behavioral Poisoning Scan"],
)
async def generate_report(
    scan_id: str,
    report_request: ReportRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a downloadable report for a completed scan.

    **Parameters:**
    - `scan_id`: The scan ID
    - `format`: Report format (json, html)

    **Returns:** File download with the report
    """
    try:
        scanner = get_scanner()
        result = scanner.get_scan_result(scan_id)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Scan {scan_id} not found"
            )

        if result.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Report can only be generated for completed scans",
            )

        # Generate report content
        if report_request.format == "json":
            content = result.model_dump_json(indent=2)
            media_type = "application/json"
            filename = f"scan_{scan_id}_report.json"
        elif report_request.format == "html":
            content = _generate_html_report(result)
            media_type = "text/html"
            filename = f"scan_{scan_id}_report.html"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported format: {report_request.format}",
            )

        return JSONResponse(
            {
                "filename": filename,
                "format": report_request.format,
                "content": content if report_request.format == "json" else None,
                "data_uri": f"data:text/html,{content}" if report_request.format == "html" else None,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate report",
        )


def _generate_html_report(result: ScanResult) -> str:
    """Generate an HTML report for the scan result."""
    verdict_color = {
        "safe": "green",
        "suspicious": "orange",
        "unsafe": "red",
        "unknown": "gray",
    }.get(result.verdict.value, "gray")

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Behavioral Poisoning Scan Report</title>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }}
            .container {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
            h1 {{ color: #333; border-bottom: 2px solid #14b8a6; padding-bottom: 10px; }}
            .verdict {{ font-size: 24px; font-weight: bold; color: {verdict_color}; margin: 20px 0; }}
            .metric {{ margin: 15px 0; padding: 10px; background: #f9f9f9; border-left: 4px solid #14b8a6; }}
            .metric-label {{ font-weight: bold; color: #333; }}
            .metric-value {{ color: #666; margin-top: 5px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th {{ background: #14b8a6; color: white; padding: 10px; text-align: left; }}
            td {{ padding: 10px; border-bottom: 1px solid #ddd; }}
            tr:hover {{ background: #f5f5f5; }}
            .recommendation {{ padding: 15px; background: #fffbee; border-left: 4px solid #ff9800; margin-top: 20px; }}
            .timestamp {{ color: #999; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🛡️ Behavioral Poisoning Scan Report</h1>
            <p class="timestamp">Scan ID: {result.scan_id} | Time: {result.timestamp.isoformat()}</p>

            <h2>Model: {result.model_id}</h2>

            <div class="verdict">Verdict: {result.verdict.value.upper()}</div>
            <p><strong>Confidence:</strong> {result.confidence:.0%}</p>
            <p><strong>Explanation:</strong> {result.explanation}</p>

            <h3>Risk Assessment</h3>
            {_html_risk_assessment(result.risk_assessment) if result.risk_assessment else ""}

            <h3>File Safety Analysis</h3>
            {_html_file_safety(result.file_safety) if result.file_safety else ""}

            <h3>Behavioral Tests</h3>
            {_html_behavioral_tests(result.behavioral_tests)}

            {_html_recommendation(result.risk_assessment) if result.risk_assessment else ""}
        </div>
    </body>
    </html>
    """
    return html


def _html_risk_assessment(risk: object) -> str:
    """Generate HTML for risk assessment."""
    return f"""
    <div class="metric">
        <div class="metric-label">System Compromise Risk</div>
        <div class="metric-value">{risk.system_compromise_risk:.0%}</div>
    </div>
    <div class="metric">
        <div class="metric-label">Behavior Manipulation Risk</div>
        <div class="metric-value">{risk.behavior_manipulation_risk:.0%}</div>
    </div>
    <div class="metric">
        <div class="metric-label">Combined Risk Score</div>
        <div class="metric-value">{risk.combined_risk_score:.0%}</div>
    </div>
    """


def _html_file_safety(file_safety: object) -> str:
    """Generate HTML for file safety results."""
    return f"""
    <div class="metric">
        <div class="metric-label">Safe Format</div>
        <div class="metric-value">{'✓ Yes' if file_safety.has_safe_format else '✗ No'}</div>
    </div>
    <div class="metric">
        <div class="metric-label">Unsafe Serialization Detected</div>
        <div class="metric-value">{'✓ Yes' if file_safety.has_unsafe_serialization else '✗ No'}</div>
    </div>
    <div class="metric">
        <div class="metric-label">Suspicious Code</div>
        <div class="metric-value">{'✓ Detected' if file_safety.has_suspicious_code else '✗ None found'}</div>
    </div>
    <div class="metric">
        <div class="metric-label">Risk Score</div>
        <div class="metric-value">{file_safety.risk_score:.0%}</div>
    </div>
    <div class="metric">
        <div class="metric-label">Details</div>
        <div class="metric-value">{'<br>'.join(file_safety.details)}</div>
    </div>
    """


def _html_behavioral_tests(tests: list) -> str:
    """Generate HTML for behavioral test results."""
    if not tests:
        return "<p>No behavioral tests run.</p>"

    html = "<table><tr><th>Test</th><th>Category</th><th>Status</th><th>Confidence</th><th>Details</th></tr>"
    for test in tests:
        status = "✓ PASS" if test.passed else "✗ FAIL"
        html += f"""
        <tr>
            <td>{test.test_name}</td>
            <td>{test.category.value}</td>
            <td>{status}</td>
            <td>{test.confidence:.0%}</td>
            <td>{test.details}</td>
        </tr>
        """
    html += "</table>"
    return html


def _html_recommendation(risk: object) -> str:
    """Generate HTML for recommendation."""
    return f"""
    <div class="recommendation">
        <strong>Recommendation:</strong><br>
        {risk.recommendation}
    </div>
    """
