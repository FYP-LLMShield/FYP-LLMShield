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
from app.utils.auth import create_access_token, create_refresh_token, verify_token
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
        user, is_from_supabase = await unified_user_service.create_user(user_data)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user in database"
            )
        
        return {
            "message": "User registered successfully. Please check your email for verification.",
            "user_id": str(user.id),
            "email": user.email,
            "verification_required": True,
            "database": "supabase" if is_from_supabase else "mongodb"
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
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
        # Authenticate user with password (tries Supabase first, falls back to MongoDB)
        user = await unified_user_service.authenticate_user(
            login_data.email, 
            login_data.password
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if MFA is enabled
        if user.mfa_enabled and user.mfa_secret:
            # Check if device is trusted
            device_trusted = False
            if login_data.trust_device:
                # Check for trusted device token in cookies or headers
                # For now, we'll implement basic logic
                # MFA operations still use MongoDB for now (can be extended later)
                device_trusted = await mongo_user_service.check_trusted_device(user.email, "device_token")
            
            if not device_trusted:
                # MFA verification required
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
                
                # Set trusted device if requested
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
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Get current user information
    
    Requires valid JWT token in Authorization header
    """
    try:
        # Verify token and get email
        email = verify_token(credentials.credentials)
        
        # Get user from database (tries Supabase first, falls back to MongoDB)
        user = await unified_user_service.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "is_verified": user.is_verified,
                "is_active": user.is_active,
                "created_at": user.created_at,
                "mfa_enabled": user.mfa_enabled
            }
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user info: {str(e)}"
        )

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
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Update user profile (name, password, etc.)
    """
    try:
        # Verify token and get email
        email = verify_token(credentials.credentials)
        
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
                "name": updated_user.name,
                "is_verified": updated_user.is_verified,
                "updated_at": updated_user.updated_at,
                "mfa_enabled": updated_user.mfa_enabled
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

@router.post("/google-signin", response_model=dict)
@router.post("/google", response_model=dict)  # Alias for frontend compatibility
async def google_signin(request: GoogleSignInRequest, response: Response):
    """
    Authenticate user with Google Sign-In
    Supports both /google-signin and /google endpoints
    """
    try:
        db = await get_database()
        google_auth_service = GoogleAuthService(db)
        
        # Verify Google ID token
        google_user = await google_auth_service.verify_google_token(request.id_token)
        if not google_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Google ID token"
            )
        
        # Get or create user
        user, is_new_user = await google_auth_service.get_or_create_user(google_user)
        
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