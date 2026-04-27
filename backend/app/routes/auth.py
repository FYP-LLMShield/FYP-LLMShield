from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.user import (
    UserRegistration, UserLogin, Token, UserResponse, 
    PasswordResetRequest, PasswordReset, ProfileUpdate
)
from app.models.password_reset import ForgotPasswordRequest, ResetPasswordRequest
from app.models.google_auth import GoogleSignInRequest, GoogleSignInResponse
from app.utils.user_service import user_service as mongo_user_service
from app.utils.unified_user_service import unified_user_service
from app.utils.auth import create_access_token, create_refresh_token, verify_token, get_current_user as get_current_user_dep
from app.utils.mfa import mfa_utils
from app.utils.password_reset_service import PasswordResetService
from app.utils.google_auth import GoogleAuthService
from app.core.config import settings
from app.core.database import get_database

router = APIRouter()
security = HTTPBearer()

@router.post("/register", response_model=dict)
async def register(user_data: UserRegistration):
    """
    Register a new user
    
    This endpoint creates a new user account with:
    - Email validation
    - Password strength validation  
    - Unique email check
    - Email verification token generation
    """
    try:
        # Create user in both databases (dual-write)
        import logging
        _log = logging.getLogger(__name__)
        try:
            _log.info(f"Registration attempt for email: {user_data.email}")
            user, is_from_supabase = await unified_user_service.create_user(user_data)
        except HTTPException as http_err:
            # Re-raise HTTP errors (like "Email already registered")
            _log.warning(f"Registration failed with HTTPException: {http_err.detail}")
            raise http_err

        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create account. Please try again later."
            )

        # Send verification email (do not fail registration if email fails)
        import logging
        from urllib.parse import urlencode
        _log = logging.getLogger(__name__)
        verification_token = getattr(user, "verification_token", None)
        if verification_token and settings.FRONTEND_URL:
            # URL-encode the token to safely handle special characters
            query_string = urlencode({"verify": "1", "token": verification_token})
            verification_link = f"{settings.FRONTEND_URL.rstrip('/')}/auth?{query_string}"
            try:
                from app.core.database import get_database
                from app.utils.email_service import EmailService, EmailConfig
                db = await get_database()
                if db is not None:
                    email_service = EmailService(db)
                    if EmailConfig.is_configured():
                        _log.info(f"Attempting to send verification email to {user.email}")
                        email_sent = await email_service.send_verification_link_email(
                            email=user.email,
                            name=user.name,
                            verification_link=verification_link,
                        )
                        if email_sent:
                            _log.info(f"Verification email sent successfully to {user.email}")
                        else:
                            _log.warning(f"Failed to send verification email to {user.email}. User can verify manually: {verification_link}")
                    else:
                        _log.warning(
                            "Email not configured (set EMAIL_USERNAME and EMAIL_PASSWORD in .env). "
                            "Verify manually by opening: %s",
                            verification_link,
                        )
            except Exception as e:
                _log.warning("Could not send verification email: %s. Verify manually: %s", e, verification_link)
        
        return {
            "message": "User registered successfully. Please check your email for verification.",
            "user_id": str(user.id),
            "email": user.email,
            "verification_required": True,
            "database": "supabase" if is_from_supabase else "mongodb"
        }
    
    except HTTPException as e:
        # HTTPException is already properly formatted, just re-raise
        import logging
        _log = logging.getLogger(__name__)
        _log.warning(f"HTTP exception during registration: {e.detail}")
        raise e
    except Exception as e:
        import logging
        _log = logging.getLogger(__name__)
        error_msg = str(e).lower()
        _log.error(f"Exception during registration: {error_msg}")

        # Provide specific error messages based on exception
        if "email" in error_msg and "already" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already registered. Please use a different email or login."
            )
        elif "username" in error_msg and "already" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This username is already taken. Please choose a different username."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to create account. Please check your input and try again."
            )

@router.post("/login", response_model=dict)
async def login(
    login_data: UserLogin,
    response: Response = None
):
    """
    Login user with MFA support
    
    Returns access token and refresh token for authenticated sessions
    Handles MFA verification if enabled
    """
    try:
        # First check if user exists
        import logging
        _log = logging.getLogger(__name__)

        user_exists = await unified_user_service.get_user_by_email(login_data.email)
        if not user_exists:
            # User doesn't exist
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account not found. Please create an account first.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # User exists, now check password
        user = await unified_user_service.authenticate_user(
            login_data.email,
            login_data.password
        )

        if not user:
            # User exists but password is wrong
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password. Please try again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Prevent login until email is verified (when required by config)
        if settings.REQUIRE_EMAIL_VERIFICATION and not getattr(user, "is_verified", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Please check your email and click the verification link before logging in.",
            )

        # Debug: Log MFA status
        _log.info(f"User {user.email} login - MFA enabled: {user.mfa_enabled}, MFA secret exists: {bool(user.mfa_secret)}")

        # Check if MFA is enabled - ALWAYS require MFA verification if enabled
        if user.mfa_enabled and user.mfa_secret:
            # MFA is enabled - verification is ALWAYS required on login
            mfa_verified = False

            # Check TOTP code
            if login_data.totp_code:
                mfa_verified = mfa_utils.verify_totp_code(
                    user.mfa_secret,
                    login_data.totp_code
                )

            # Check recovery code if TOTP failed
            elif login_data.recovery_code and not mfa_verified:
                # MFA operations still use MongoDB for now (can be extended later)
                mfa_verified = await mongo_user_service.verify_and_consume_recovery_code(
                    user.email,
                    login_data.recovery_code
                )

            # If MFA not verified, return MFA requirement
            if not mfa_verified:
                return {
                    "message": "MFA verification required",
                    "mfa_required": True,
                    "user_id": str(user.id),
                    "partial_token": create_access_token(
                        data={"sub": user.email, "mfa_pending": True},
                        expires_delta=timedelta(minutes=5)
                    )
                }

            # MFA verified - set trusted device if requested
            if login_data.trust_device:
                # MFA operations still use MongoDB for now (can be extended later)
                trusted_token = await mongo_user_service.create_trusted_device(user.email)
                if trusted_token:
                    # Set secure cookie for 30 days
                    response.set_cookie(
                        key="trusted_device",
                        value=trusted_token,
                        max_age=30 * 24 * 60 * 60,  # 30 days
                        httponly=True,
                        secure=True,
                        samesite="strict"
                    )
        
        # Create tokens
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        refresh_token = create_refresh_token(data={"sub": user.email})
        
        # Update last login in both databases
        await unified_user_service.update_user_last_login(user.email)
        
        return {
            "message": "Login successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # seconds
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "is_verified": user.is_verified,
                "mfa_enabled": user.mfa_enabled
            }
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )

@router.post("/mfa-login", response_model=dict)
async def complete_mfa_login(
    user_credentials: UserLogin,
    response: Response,
    partial_token: str = None
):
    """
    Complete MFA login process
    Used when MFA is required after initial password verification
    """
    try:
        if not partial_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Partial token required for MFA login"
            )
        
        # 👉 Do your MFA validation logic here
        # e.g., check partial_token, verify OTP, issue final JWT
        return {
            "message": "MFA login successful",
            "authenticated": True
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MFA login failed: {str(e)}"
        )


@router.post("/verify-email/{token}")
async def verify_email(token: str):
    """
    Verify user email with verification token
    
    This would typically be called when user clicks verification link in email
    """
    try:
        success = await unified_user_service.verify_user_email(token)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token"
            )
        
        return {
            "message": "Email verified successfully. You can now login.",
            "verified": True
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Email verification failed: {str(e)}"
        )

@router.get("/me", response_model=dict)
async def get_current_user(current_user=Depends(get_current_user_dep)):
    """
    Get current user information (accepts Supabase access tokens + backend JWTs).

    Important: when using Supabase Auth tokens, `get_current_user_dep` returns a minimal
    user payload derived from the JWT. We then hydrate from the app user store (Supabase users
    table / Mongo fallback) so profile fields (profile_picture, phone, etc.) persist.
    """
    try:
        user = await unified_user_service.get_user_by_email(current_user.email)
    except Exception:
        user = None
    if not user:
        user = current_user
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "username": getattr(user, "username", None),
            "name": getattr(user, "name", None),
            "is_verified": getattr(user, "is_verified", False),
            "is_active": getattr(user, "is_active", True),
            "created_at": getattr(user, "created_at", None),
            "mfa_enabled": getattr(user, "mfa_enabled", False),
            "profile_picture": getattr(user, "profile_picture", None),
            "phone_number": getattr(user, "phone_number", None),
            "location": getattr(user, "location", None),
            "job_role": getattr(user, "job_role", None),
            "company": getattr(user, "company", None),
            "bio": getattr(user, "bio", None),
        }
    }

@router.post("/refresh", response_model=dict)
async def refresh_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Refresh access token using refresh token
    """
    try:
        # Verify refresh token
        email = verify_token(credentials.credentials, token_type="refresh")
        
        # Get user (tries Supabase first, falls back to MongoDB)
        user = await unified_user_service.get_user_by_email(email)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Create new access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token(
            data={"sub": email}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token refresh failed: {str(e)}"
        )

@router.post("/forgot-password", response_model=dict)
async def forgot_password(request: ForgotPasswordRequest):
    """
    Request password reset - sends reset email if user exists
    """
    try:
        db = await get_database()
        password_reset_service = PasswordResetService(db)
        
        success = await password_reset_service.request_password_reset(request.email)
        
        return {
            "message": "If an account with this email exists, you will receive a password reset email shortly.",
            "success": True
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password reset request failed: {str(e)}"
        )

@router.post("/reset-password", response_model=dict)
async def reset_password(reset_data: ResetPasswordRequest):
    """
    Reset password using valid reset token
    """
    try:
        db = await get_database()
        password_reset_service = PasswordResetService(db)
        
        success = await password_reset_service.reset_password(
            reset_data.token, 
            reset_data.new_password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        return {
            "message": "Password reset successfully. You can now login with your new password.",
            "success": True
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password reset failed: {str(e)}"
        )

@router.put("/profile", response_model=dict)
async def update_profile(
    profile_data: ProfileUpdate,
    current_user=Depends(get_current_user_dep),
):
    """
    Update user profile (name, password, etc.)
    """
    try:
        email = current_user.email
        
        # Update profile
        updated_user = await unified_user_service.update_profile(
            email, 
            profile_data.dict(exclude_unset=True)
        )
        
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {
            "message": "Profile updated successfully",
            "user": {
                "id": str(updated_user.id),
                "email": updated_user.email,
                "username": getattr(updated_user, "username", None),
                "name": updated_user.name,
                "is_verified": updated_user.is_verified,
                "updated_at": updated_user.updated_at,
                "mfa_enabled": updated_user.mfa_enabled,
                "profile_picture": getattr(updated_user, "profile_picture", None),
                "phone_number": getattr(updated_user, "phone_number", None),
                "location": getattr(updated_user, "location", None),
                "job_role": getattr(updated_user, "job_role", None),
                "company": getattr(updated_user, "company", None),
                "bio": getattr(updated_user, "bio", None),
            }
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile update failed: {str(e)}"
        )

@router.post("/logout", response_model=dict)
async def logout(
    response: Response,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Logout user - clear trusted device cookies
    """
    try:
        # Clear trusted device cookie
        response.delete_cookie(
            key="trusted_device",
            httponly=True,
            secure=True,
            samesite="strict"
        )
        
        return {
            "message": "Logged out successfully"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Logout failed: {str(e)}"
        )

@router.post("/resend-verification-email", response_model=dict)
async def resend_verification_email(request: dict):
    """
    Resend verification email to user
    Request body: {"email": "user@example.com"}
    """
    try:
        email = request.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required"
            )

        # Get user from Supabase
        user = await unified_user_service.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # If already verified, no need to resend
        if user.is_verified:
            return {
                "message": "Your email is already verified",
                "verified": True
            }

        # Generate new verification token
        import secrets
        verification_token = secrets.token_urlsafe(32)

        # Update user with new token in Supabase
        from app.utils.supabase_user_service import SupabaseUserService
        supabase_service_inst = SupabaseUserService()
        supabase_service_inst.client.table("users").update({
            "verification_token": verification_token
        }).eq("email", email).execute()

        # Send verification email
        if settings.FRONTEND_URL:
            verification_link = f"{settings.FRONTEND_URL.rstrip('/')}/auth?verify=1&token={verification_token}"
            try:
                from app.core.database import get_database
                from app.utils.email_service import EmailService, EmailConfig
                db = await get_database()
                if db is not None:
                    email_service = EmailService(db)
                    if EmailConfig.is_configured():
                        email_sent = await email_service.send_verification_link_email(
                            email=user.email,
                            name=user.name,
                            verification_link=verification_link,
                        )
                        if email_sent:
                            return {
                                "message": "Verification email sent successfully",
                                "email": email,
                                "resent": True
                            }
                        else:
                            return {
                                "message": "Verification link generated. Please verify manually.",
                                "verification_link": verification_link,
                                "resent": False
                            }
            except Exception as e:
                import logging
                logging.error(f"Failed to resend verification email: {e}")
                return {
                    "message": "Could not send email, but you can verify manually using the link below",
                    "verification_link": verification_link,
                    "resent": False
                }

        return {
            "message": "Verification email process initiated",
            "resent": True
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Resend failed: {str(e)}"
        )

@router.post("/google-signin", response_model=dict)
@router.post("/google", response_model=dict)  # Alias for frontend compatibility
async def google_signin(request: GoogleSignInRequest, response: Response):
    """
    Authenticate user with Google Sign-In.
    - mode=signup (or omitted): create user if not exists, then sign in (Continue with Google on sign-up).
    - mode=signin: only sign in if user already exists; if not, return 403 "Please sign up first" (Continue with Google on login).
    """
    try:
        db = await get_database()
        google_auth_service = GoogleAuthService(db)
        
        google_user = await google_auth_service.verify_google_token(request.id_token)
        if not google_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Google ID token"
            )
        
        is_signin_only = (request.mode or "").strip().lower() == "signin"
        
        if is_signin_only:
            # Login form: only allow if user already exists; do not create
            existing_user = await unified_user_service.get_user_by_email(google_user.email)
            if not existing_user:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No account found with this Google email. Please sign up first.",
                )
            user, is_new_user = existing_user, False
        else:
            # Sign-up form or default: get or create user
            user, is_new_user = await google_auth_service.get_or_create_user(google_user)

        # Check if MFA is enabled - ALWAYS require MFA verification if enabled
        import logging
        _log = logging.getLogger(__name__)
        _log.info(f"Google user {user.email} login - MFA enabled: {user.mfa_enabled}, MFA secret exists: {bool(user.mfa_secret)}")

        if user.mfa_enabled and user.mfa_secret:
            # MFA is enabled - verification is ALWAYS required
            # Return MFA requirement with partial token
            return {
                "message": "MFA verification required",
                "mfa_required": True,
                "user_id": str(user.id),
                "partial_token": create_access_token(
                    data={"sub": user.email, "mfa_pending": True},
                    expires_delta=timedelta(minutes=5)
                )
            }

        # Create tokens
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        refresh_token = create_refresh_token(data={"sub": user.email})

        # Update last login in both databases
        await unified_user_service.update_user_last_login(user.email)
        
        return {
            "message": "Google Sign-In successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # seconds
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "username": user.username,
                "is_verified": user.is_verified,
                "profile_picture": user.profile_picture
            },
            "is_new_user": is_new_user
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Google Sign-In failed: {str(e)}"
        )


@router.post("/test-email")
async def test_email(request: dict):
    """
    Test endpoint to verify email configuration and send a test email
    Request body: {"email": "test@example.com"}
    """
    import logging
    _log = logging.getLogger(__name__)

    try:
        email = request.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        from app.utils.email_service import EmailService, EmailConfig
        from app.core.database import get_database

        _log.info(f"Testing email configuration for {email}")

        # Check configuration
        if not EmailConfig.is_configured():
            return {
                "status": "error",
                "message": "Email not configured",
                "details": {
                    "SMTP_USERNAME": EmailConfig.SMTP_USERNAME or "NOT SET",
                    "SMTP_PASSWORD": "***" if EmailConfig.SMTP_PASSWORD else "NOT SET",
                    "SMTP_SERVER": EmailConfig.SMTP_SERVER,
                    "SMTP_PORT": EmailConfig.SMTP_PORT
                }
            }

        # Get database and email service
        db = await get_database()
        if db is None:
            return {"status": "error", "message": "Database connection failed"}

        email_service = EmailService(db)

        # Send test email
        success = email_service._send_email_smtp(
            to_email=email,
            subject="LLMShield Test Email",
            message="This is a test email from LLMShield. If you received this, email sending is working correctly!"
        )

        if success:
            return {
                "status": "success",
                "message": f"Test email sent successfully to {email}",
                "from_email": EmailConfig.DEFAULT_FROM_EMAIL,
                "smtp_server": EmailConfig.SMTP_SERVER
            }
        else:
            return {
                "status": "error",
                "message": f"Failed to send test email to {email}. Check backend logs for details.",
                "from_email": EmailConfig.DEFAULT_FROM_EMAIL
            }

    except Exception as e:
        import logging
        _log = logging.getLogger(__name__)
        _log.error(f"Test email failed: {e}")
        return {
            "status": "error",
            "message": f"Test email error: {str(e)}"
        }