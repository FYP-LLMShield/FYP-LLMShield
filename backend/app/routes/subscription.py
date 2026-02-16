from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.subscription import (
    SubscriptionResponse, UsageResponse, SubscriptionUpdateRequest,
    ScanType, SubscriptionTier
)
from app.utils.subscription_service import subscription_service
from app.utils.auth import verify_token
from app.utils.user_service import user_service

router = APIRouter()
security = HTTPBearer()

async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Helper to get current user ID from JWT token"""
    email = verify_token(credentials.credentials)
    from app.utils.unified_user_service import unified_user_service
    user = await unified_user_service.get_user_by_email(email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return str(user.id)

@router.get("/me", response_model=SubscriptionResponse)
async def get_my_subscription(user_id: str = Depends(get_current_user_id)):
    """Get current user's subscription details"""
    try:
        subscription = await subscription_service.get_subscription_summary(user_id)
        return subscription
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get subscription: {str(e)}"
        )

@router.get("/usage", response_model=UsageResponse)
async def get_my_usage(user_id: str = Depends(get_current_user_id)):
    """Get current user's usage statistics for current month"""
    try:
        usage = await subscription_service.get_usage_summary(user_id)
        return usage
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get usage: {str(e)}"
        )

@router.post("/check-scan/{scan_type}")
async def check_scan_access(
    scan_type: ScanType, 
    user_id: str = Depends(get_current_user_id)
):
    """Check if user can perform a specific scan type"""
    try:
        can_scan, reason = await subscription_service.can_perform_scan(user_id, scan_type)
        
        return {
            "can_scan": can_scan,
            "reason": reason,
            "scan_type": scan_type
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check scan access: {str(e)}"
        )

@router.post("/record-scan/{scan_type}")
async def record_scan(
    scan_type: ScanType,
    user_id: str