"""
Scan History API Routes
Handles scan history endpoints for users
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime

from app.models.scan_history import (
    ScanHistoryCreate, 
    ScanHistoryResponse, 
    ScanHistoryDetailResponse
)
from app.services.scan_history_service import ScanHistoryService
from app.utils.auth import get_current_user
from app.models.user import UserInDB
from app.core.database import get_database

router = APIRouter(prefix="/scan-history", tags=["scan-history"])

async def get_scan_history_service() -> ScanHistoryService:
    """Dependency to get scan history service"""
    database = await get_database()
    return ScanHistoryService(database)

@router.post("/", response_model=ScanHistoryResponse)
async def create_scan_history(
    scan_data: ScanHistoryCreate,
    current_user: UserInDB = Depends(get_current_user),
    scan_service: ScanHistoryService = Depends(get_scan_history_service)
):
    """Create a new scan history entry"""
    try:
        scan_history = await scan_service.create_scan_history(
            user_id=str(current_user.id),
            scan_data=scan_data
        )
        
        # Convert to response model
        response_data = scan_history.dict()
        response_data["id"] = str(response_data["id"])
        response_data["user_id"] = str(response_data["user_id"])
        
        return ScanHistoryResponse(**response_data)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create scan history: {str(e)}")

@router.get("/")
async def get_user_scan_history(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Number of records per page"),
    input_type: Optional[str] = Query(None, description="Filter by input type"),
    scan_type: Optional[str] = Query(None, description="Filter by scan type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: UserInDB = Depends(get_current_user),
    scan_service: ScanHistoryService = Depends(get_scan_history_service)
):
    """Get scan history for the current user with pagination"""
    try:
        # Calculate skip based on page
        skip = (page - 1) * limit
        
        scan_histories = await scan_service.get_user_scan_history(
            user_id=str(current_user.id),
            limit=limit,
            skip=skip,
            scan_type=scan_type,
            status=status
        )
        
        # Get total count for pagination
        total_count = await scan_service.get_user_scan_count(str(current_user.id), scan_type, status)
        total_pages = (total_count + limit - 1) // limit  # Ceiling division
        
        # Convert scan histories to the expected format
        scans = []
        for scan in scan_histories:
            scan_dict = scan.dict()
            # Map backend fields to frontend expected fields
            scans.append({
                "id": scan_dict["id"],
                "scan_id": scan_dict["scan_id"],
                "scan_type": scan_dict.get("scan_type", "unknown"),  # Keep scan_type as scan_type
                "input_type": scan_dict.get("input_type"),  # Keep input_type separate
                "input_size": scan_dict.get("input_size", 0),
                "scan_duration": scan_dict.get("duration", 0) or 0,
                "findings_count": scan_dict["total_findings"],
                "high_risk_count": scan_dict["high_findings"],
                "medium_risk_count": scan_dict["medium_findings"],
                "low_risk_count": scan_dict["low_findings"],
                "created_at": scan_dict["timestamp"].isoformat() if scan_dict["timestamp"] else None
            })
        
        return {
            "scans": scans,
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scan history: {str(e)}")

@router.get("/stats")
async def get_user_scan_stats(
    current_user: UserInDB = Depends(get_current_user),
    scan_service: ScanHistoryService = Depends(get_scan_history_service)
):
    """Get scan statistics for the current user"""
    try:
        stats = await scan_service.get_user_scan_stats(str(current_user.id))
        return stats
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scan stats: {str(e)}")

@router.get("/{scan_history_id}", response_model=ScanHistoryDetailResponse)
async def get_scan_history_detail(
    scan_history_id: str,
    current_user: UserInDB = Depends(get_current_user),
    scan_service: ScanHistoryService = Depends(get_scan_history_service)
):
    """Get detailed scan history including full scan results"""
    try:
        scan_history = await scan_service.get_scan_history_detail(
            user_id=str(current_user.id),
            scan_history_id=scan_history_id
        )
        
        if not scan_history:
            raise HTTPException(status_code=404, detail="Scan history not found")
        
        return scan_history
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scan history detail: {str(e)}")

@router.delete("/{scan_history_id}")
async def delete_scan_history(
    scan_history_id: str,
    current_user: UserInDB = Depends(get_current_user),
    scan_service: ScanHistoryService = Depends(get_scan_history_service)
):
    """Delete a specific scan history entry"""
    try:
        deleted = await scan_service.delete_scan_history(
            user_id=str(current_user.id),
            scan_history_id=scan_history_id
        )
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Scan history not found")
        
        return {"message": "Scan history deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete scan history: {str(e)}")

@router.get("/by-scan-id/{scan_id}", response_model=ScanHistoryDetailResponse)
async def get_scan_history_by_scan_id(
    scan_id: str,
    current_user: UserInDB = Depends(get_current_user),
    scan_service: ScanHistoryService = Depends(get_scan_history_service)
):
    """Get scan history by original scan ID"""
    try:
        scan_history = await scan_service.get_scan_history_by_scan_id(
            user_id=str(current_user.id),
            scan_id=scan_id
        )
        
        if not scan_history:
            raise HTTPException(status_code=404, detail="Scan history not found")
        
        return scan_history
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scan history: {str(e)}")