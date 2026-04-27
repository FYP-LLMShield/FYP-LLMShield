import logging
import time
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.user import (
    UserInDB,
    MFASetupRequest, MFAVerifyRequest, MFADisableRequest,
    MFASetupResponse, MFAStatusResponse, RecoveryCodeRequest
)
from app.utils.user_service import user_service as mongo_user_service
from app.utils.unified_user_service import unified_user_service
from app.utils.auth import get_current_user, verify_token, create_access_token, create_refresh_token
from app.utils.mfa import mfa_utils
from app.utils.mfa_pending_setup import create_setup_session, peek_setup_session, pop_setup_session
from app.core.config import settings

router = APIRouter()
security = HTTPBearer()
_log = logging.getLogger(__name__)

@router.get("/status", response_model=MFAStatusResponse)
async def get_mfa_status(current_user: UserInDB = Depends(get_current_user)):
    """
    Get current MFA status for the authenticated user.
    Accepts both Supabase Auth JWT and backend JWT.
    """
    try:
        user = await unified_user_service.get_user_by_email(current_user.email)
        if not user:
            # Supabase Auth user with no row yet: return default (no MFA)
            return MFAStatusResponse(
                mfa_enabled=False,
                setup_complete=False,
                recovery_codes_remaining=0
            )
        remaining_codes = len([code for code in user.recovery_codes if code])
        return MFAStatusResponse(
            mfa_enabled=user.mfa_enabled,
            setup_complete=user.mfa_setup_complete,
            recovery_codes_remaining=remaining_codes
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get MFA status: {str(e)}"
        )

@router.post("/setup/initiate", response_model=MFASetupResponse)
async def initiate_mfa_setup(current_user: UserInDB = Depends(get_current_user)):
    """
    Initiate MFA setup - generates secret and QR code.
    Accepts both Supabase Auth JWT and backend JWT. Ensures user exists in DB for Supabase Auth users.
    """
    try:
        email = current_user.email
        user = await unified_user_service.get_user_by_email(email)
        if not user:
            await unified_user_service.ensure_user_for_mfa(current_user)
            user = await unified_user_service.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not create or find user for MFA setup."
            )
        if user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA is already enabled for this account"
            )
        secret = mfa_utils.generate_secret()
        qr_code = mfa_utils.generate_qr_code(email, secret)
        backup_url = mfa_utils.generate_backup_url(email, secret)
        recovery_codes = mfa_utils.generate_recovery_codes()
        # Pending secret in Mongo (or memory) so /complete uses the same secret as the QR.
        setup_id = await create_setup_session(str(email), secret, recovery_codes)
        _log.info(
            "MFA initiate OK email=%s setup_id=%s... secret_len=%d",
            str(email).strip().lower(),
            setup_id[:16],
            len(secret or ""),
        )
        return MFASetupResponse(
            qr_code=qr_code,
            secret=secret,
            backup_url=backup_url,
            recovery_codes=recovery_codes,
            setup_id=setup_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate MFA setup: {str(e)}"
        )

@router.post("/setup/complete", response_model=dict)
async def complete_mfa_setup(
    setup_request: MFASetupRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Complete MFA setup by verifying TOTP code. Accepts both Supabase Auth JWT and backend JWT.
    """
    try:
        email = current_user.email
        user = await unified_user_service.get_user_by_email(email)
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

        email_str = str(email).strip().lower()
        sid = setup_request.setup_id
        db_secret_len = len((user.mfa_secret or "").strip()) if user.mfa_secret else 0
        _log.info(
            "MFA complete start email=%s setup_id_present=%s setup_id_prefix=%s totp_len=%d db_mfa_secret_len=%d server_unix_time=%d",
            email_str,
            bool(sid),
            (sid[:16] + "...") if sid else "(none)",
            len(setup_request.totp_code or ""),
            db_secret_len,
            int(time.time()),
        )

        # Preferred: verify against pending setup from /initiate (same secret as QR).
        if sid:
            pending = await peek_setup_session(sid, email_str)
            if not pending:
                _log.warning(
                    "MFA complete REJECT no_pending_session email=%s setup_id=%s... (see MFA pending PEEK logs above)",
                    email_str,
                    sid[:16],
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="MFA setup expired or invalid. Please click Enable MFA again to start over.",
                )
            secret = pending["secret"]
            recovery_codes = pending["recovery_codes"]
            totp_ok = mfa_utils.verify_totp_code(secret, setup_request.totp_code)
            if not totp_ok:
                raw = setup_request.totp_code or ""
                digits_only = "".join(c for c in str(raw).strip() if c.isdigit())
                _log.warning(
                    "MFA complete REJECT totp_mismatch path=pending email=%s setup_id=%s... secret_len=%d "
                    "submitted_code_len=%d digits_only_len=%d (expect 6 digits; check clock skew vs server_unix_time on start line)",
                    email_str,
                    sid[:16],
                    len("".join(str(secret or "").split()).strip()),
                    len(str(raw).strip()),
                    len(digits_only),
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid TOTP code",
                )
            _log.info(
                "MFA complete TOTP OK path=pending email=%s setup_id=%s... finalizing",
                email_str,
                sid[:16],
            )
            success = await unified_user_service.finalize_mfa_setup(
                email_str, secret, recovery_codes
            )
            if not success:
                _log.error("MFA complete finalize_mfa_setup FAILED email=%s setup_id=%s...", email_str, sid[:16])
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to enable MFA",
                )
            await pop_setup_session(sid, email_str)
            _log.info("MFA complete SUCCESS path=pending email=%s setup_id=%s...", email_str, sid[:16])
            return {"message": "MFA enabled successfully", "mfa_enabled": True}

        # Legacy: temp secret only in DB (older clients without setup_id).
        _log.info("MFA complete path=legacy_db_secret (no setup_id in request)")
        if not user.mfa_secret:
            _log.warning("MFA complete REJECT legacy no_db_secret email=%s", email_str)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA setup not initiated. Please start the setup process first.",
            )
        totp_ok_legacy = mfa_utils.verify_totp_code(user.mfa_secret, setup_request.totp_code)
        if not totp_ok_legacy:
            _log.warning(
                "MFA complete REJECT totp_mismatch path=legacy email=%s db_secret_len=%d server_unix_time=%d",
                email_str,
                db_secret_len,
                int(time.time()),
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid TOTP code",
            )
        success = await unified_user_service.enable_mfa(email_str)
        if not success:
            _log.error("MFA complete enable_mfa FAILED path=legacy email=%s", email_str)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to enable MFA",
            )
        _log.info("MFA complete SUCCESS path=legacy email=%s", email_str)
        return {"message": "MFA enabled successfully", "mfa_enabled": True}
    
    except HTTPException as e:
        _log.info("MFA complete HTTPException status=%s detail=%s", e.status_code, e.detail)
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete MFA setup: {str(e)}"
        )

@router.post("/verify", response_model=dict)
async def verify_mfa_code(
    verify_request: MFAVerifyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Verify TOTP code for MFA login completion
    """
    try:
        # Verify partial token and get email
        from jose import jwt, JWTError
        from app.core.config import settings
        
        try:
            payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            email = payload.get("sub")
            mfa_pending = payload.get("mfa_pending")
            
            if email is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
            
            # For MFA verification, we accept both regular tokens and partial tokens
            # Regular tokens are for already authenticated users verifying MFA
            # Partial tokens are for completing MFA login
            
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
        
        # Get user from database (tries Supabase first, falls back to MongoDB)
        user = await unified_user_service.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if not user.mfa_enabled or not user.mfa_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA is not enabled for this account"
            )
        
        # Verify TOTP code
        if not mfa_utils.verify_totp_code(user.mfa_secret, verify_request.totp_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid TOTP code"
            )
        
        # If this is a partial token (MFA login completion), issue full tokens
        if mfa_pending:
            access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                data={"sub": user.email}, expires_delta=access_token_expires
            )
            refresh_token = create_refresh_token(data={"sub": user.email})
            
            # Update last login in both databases
            await unified_user_service.update_user_last_login(user.email)
            
            return {
                "message": "MFA login successful",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "name": user.name,
                    "is_verified": user.is_verified,
                    "mfa_enabled": user.mfa_enabled
                }
            }
        else:
            # Regular MFA verification for already authenticated users
            return {
                "message": "TOTP code verified successfully",
                "verified": True
            }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify MFA code: {str(e)}"
        )

@router.post("/disable", response_model=dict)
async def disable_mfa(
    disable_request: MFADisableRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Disable MFA (requires password + TOTP confirmation). Accepts both Supabase Auth JWT and backend JWT.
    """
    try:
        import logging
        _log = logging.getLogger(__name__)

        email = current_user.email
        user = await unified_user_service.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        if not user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA is not enabled for this account"
            )

        # Debug logging
        _log.info(f"MFA disable for user {email}: hashed_password={repr(user.hashed_password)}, has_google_id={bool(getattr(user, 'google_id', None))}")

        # Verify password only if user has a password (e.g. email sign-up). Skip for Google/social sign-in.
        # Check if user has a non-empty password (OAuth users have empty string or None)
        # Also skip password check for Google OAuth users (they have google_id)
        is_oauth_user = bool(getattr(user, 'google_id', None))
        has_password = not is_oauth_user and user.hashed_password and user.hashed_password.strip()

        if has_password:
            if not disable_request.current_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password is required to disable MFA for this account"
                )
            if not await mongo_user_service.verify_password(email, disable_request.current_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid password"
                )
        
        # Verify TOTP code
        if not mfa_utils.verify_totp_code(user.mfa_secret, disable_request.totp_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid TOTP code"
            )
        
        # Disable MFA in both Supabase and MongoDB
        success = await unified_user_service.disable_mfa(email)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to disable MFA"
            )
        
        return {
            "message": "MFA disabled successfully",
            "mfa_enabled": False
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable MFA: {str(e)}"
        )

@router.post("/recovery/use", response_model=dict)
async def use_recovery_code(recovery_request: RecoveryCodeRequest):
    """
    Use recovery code for login when TOTP is not available
    """
    try:
        # This endpoint should be called during login process
        # For now, we'll implement basic verification
        # In practice, this would be integrated with the login flow
        
        return {
            "message": "Recovery code functionality should be used during login",
            "note": "Use recovery code in the login endpoint instead"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Recovery code processing failed: {str(e)}"
        )

@router.post("/recovery/regenerate", response_model=dict)
async def regenerate_recovery_codes(current_user: UserInDB = Depends(get_current_user)):
    """
    Regenerate recovery codes (replaces existing ones). Accepts both Supabase Auth JWT and backend JWT.
    """
    try:
        email = current_user.email
        user = await unified_user_service.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if not user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA is not enabled for this account"
            )
        
        # Generate new recovery codes
        new_recovery_codes = mfa_utils.generate_recovery_codes()
        
        # Update recovery codes in both Supabase and MongoDB
        success = await unified_user_service.update_recovery_codes(email, new_recovery_codes)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to regenerate recovery codes"
            )
        
        return {
            "message": "Recovery codes regenerated successfully",
            "recovery_codes": new_recovery_codes,
            "warning": "Store these codes securely. The old codes are no longer valid."
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate recovery codes: {str(e)}"
        )