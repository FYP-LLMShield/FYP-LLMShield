from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.user import (
    MFASetupRequest, MFAVerifyRequest, MFADisableRequest, 
    MFASetupResponse, MFAStatusResponse, RecoveryCodeRequest
)
from app.utils.user_service import user_service
from app.utils.auth import verify_token, create_access_token, create_refresh_token
from app.utils.mfa import mfa_utils
from app.core.config import settings

router = APIRouter()
security = HTTPBearer()

@router.get("/status", response_model=MFAStatusResponse)
async def get_mfa_status(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Get current MFA status for the authenticated user
    """
    try:
        # Verify token and get email
        email = verify_token(credentials.credentials)
        
        # Get user from database
        user = await user_service.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Count remaining recovery codes
        remaining_codes = len([code for code in user.recovery_codes if code])
        
        return MFAStatusResponse(
            mfa_enabled=user.mfa_enabled,
            setup_complete=user.mfa_setup_complete,
            recovery_codes_remaining=remaining_codes
        )
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get MFA status: {str(e)}"
        )

@router.post("/setup/initiate", response_model=MFASetupResponse)
async def initiate_mfa_setup(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Initiate MFA setup - generates secret and QR code
    """
    try:
        # Verify token and get email
        email = verify_token(credentials.credentials)
        
        # Get user from database
        user = await user_service.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA is already enabled for this account"
            )
        
        # Generate TOTP secret
        secret = mfa_utils.generate_secret()
        
        # Generate QR code
        qr_code = mfa_utils.generate_qr_code(email, secret)
        
        # Generate backup URL
        backup_url = mfa_utils.generate_backup_url(email, secret)
        
        # Generate recovery codes
        recovery_codes = mfa_utils.generate_recovery_codes()
        
        # Store temporary secret in user record (not activated yet)
        await user_service.store_temp_mfa_secret(email, secret, recovery_codes)
        
        return MFASetupResponse(
            qr_code=qr_code,
            secret=secret,
            backup_url=backup_url,
            recovery_codes=recovery_codes
        )
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate MFA setup: {str(e)}"
        )

@router.post("/setup/complete", response_model=dict)
async def complete_mfa_setup(
    setup_request: MFASetupRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Complete MFA setup by verifying TOTP code
    """
    try:
        # Verify token and get email
        email = verify_token(credentials.credentials)
        
        # Get user from database
        user = await user_service.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA is already enabled for this account"
            )
        
        if not user.mfa_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA setup not initiated. Please start the setup process first."
            )
        
        # Verify TOTP code
        if not mfa_utils.verify_totp_code(user.mfa_secret, setup_request.totp_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid TOTP code"
            )
        
        # Enable MFA
        success = await user_service.enable_mfa(email)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to enable MFA"
            )
        
        return {
            "message": "MFA enabled successfully",
            "mfa_enabled": True
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete MFA setup: {str(e)}"
        )
