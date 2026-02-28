"""
Email verification routes for user registration
"""

from fastapi import APIRouter, Depends, HTTPException, status
from app.models.email_verification import EmailVerificationRequest, ResendVerificationRequest
from app.models.user import UserCreate, UserResponse, MessageResponse
from app.utils.email_service import EmailService, EmailConfig
from app.utils.user_service import UserService
from app.core.database import get_database
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Email Verification"])


async def get_email_service():
    """Dependency to get EmailService instance"""
    db = await get_database()
    return EmailService(db)


async def get_user_service():
    """Dependency to get UserService instance"""
    from app.utils.user_service import user_service
    return user_service


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Register a new user with email verification",
    description="Create a new user account. Email verification is required before account activation."
)
async def register_user(
    user_data: UserCreate,
    email_service: EmailService = Depends(get_email_service),
    user_service: UserService = Depends(get_user_service)
):
    """
    Register a new user with email verification

    - **email**: Valid email address (verification code will be sent)
    - **username**: Unique username (3-50 characters)
    - **name**: Full name of the user
    - **display_name**: Display name for the user
    - **password**: Password (minimum 8 characters with complexity requirements)

    This endpoint sends a verification email and does NOT create the user account yet.
    Use /auth/verify-email to complete registration.
    """
    try:
        # Check if email configuration is set up
        if not EmailConfig.is_configured():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Email service is not configured. Please contact administrator."
            )

        # Set default name if not provided or empty
        if not user_data.name.strip():
            user_data.name = user_data.username

        # Set default display name if not provided
        if not user_data.display_name.strip():
            user_data.display_name = user_data.name or user_data.username

        # Check if email already exists (in actual users or pending verification)
        from app.utils.unified_user_service import unified_user_service
        existing_user = await unified_user_service.get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )

        # Check if username already exists
        existing_username = await unified_user_service.get_user_by_username(user_data.username)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken"
            )

        # Create verification token and send email
        verification_token = await email_service.create_verification_token(
            email=user_data.email,
            username=user_data.username,
            password=user_data.password
        )

        if not verification_token:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create verification token"
            )

        # Send verification email
        email_sent = await email_service.send_verification_email(
            email=user_data.email,
            code=verification_token.code
        )

        if not email_sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send verification email. Please try again."
            )

        return MessageResponse(
            message="Verification code sent to your email. Please verify to complete registration."
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )


@router.post(
    "/verify-email",
    status_code=status.HTTP_201_CREATED,
    summary="Verify email and complete registration",
    description="Verify email code and create user account"
)
async def verify_email(
    verification_data: EmailVerificationRequest,
    email_service: EmailService = Depends(get_email_service),
    user_service: UserService = Depends(get_user_service)
):
    """
    Verify email code and complete user registration

    - **email**: Email address used during registration
    - **code**: 6-digit verification code received via email

    This endpoint validates the code and creates the actual user account.
    """
    try:
        logger.info(f"Verification attempt for email: {verification_data.email}, code: {verification_data.code}")

        # Verify the email code
        verification_token = await email_service.verify_email_code(
            email=verification_data.email,
            code=verification_data.code
        )

        if not verification_token:
            logger.warning(f"Verification failed for email: {verification_data.email}, code: {verification_data.code}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code"
            )

        logger.info(f"Verification token found for email: {verification_data.email}")

        # Check if user already exists (safety check)
        from app.utils.unified_user_service import unified_user_service
        existing_user = await unified_user_service.get_user_by_email(verification_data.email)
        if existing_user:
            # Clean up token and return error
            await email_service.delete_verification_token(verification_data.email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )

        # Create the user directly in database without UserCreate validation
        # since we already have the hashed password from the verification token

        # Override the password hashing in user service by directly creating user
        from app.models.user import UserInDB
        from datetime import datetime

        # Determine user role
        role = user_service._determine_user_role(verification_token.username, verification_token.email)

        user_doc = UserInDB(
            email=verification_token.email,
            username=verification_token.username,
            name=verification_token.username,
            display_name=verification_token.username,
            hashed_password=verification_token.password_hash,  # Already hashed
            role=role,
            active_jwt_identifier=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # Insert into database
        result = await user_service.collection.insert_one(user_doc.dict(by_alias=True, exclude={"id"}))

        if not result.inserted_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user account"
            )

        # Delete verification token
        await email_service.delete_verification_token(verification_data.email)

        # Auto-login the user by creating JWT token
        from app.auth.security import SecurityUtils
        access_token = SecurityUtils.create_access_token(data={"sub": str(result.inserted_id)})

        # Extract JTI from token for single-session control
        jti = SecurityUtils.extract_jti_from_token(access_token)

        # Update user's active JWT identifier
        await user_service.update_active_jwt_identifier(str(result.inserted_id), jti)

        from app.models.user import Token
        return {
            "message": "Email verified and user registered successfully!",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(result.inserted_id),
                "email": verification_token.email,
                "username": verification_token.username,
                "name": verification_token.username,
                "display_name": verification_token.username,
                "role": role
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email verification failed. Please try again."
        )


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend verification code",
    description="Resend verification code for pending registration"
)
async def resend_verification_code(
    resend_data: ResendVerificationRequest,
    email_service: EmailService = Depends(get_email_service)
):
    """
    Resend verification code for pending registration

    - **email**: Email address used during registration

    Generates a new verification code and sends it via email.
    """
    try:
        # Check if email configuration is set up
        if not EmailConfig.is_configured():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Email service is not configured. Please contact administrator."
            )

        # Resend verification code
        new_code = await email_service.resend_verification_code(resend_data.email)

        if not new_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No pending verification found for this email. Please register again."
            )

        return MessageResponse(
            message="New verification code sent to your email."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resend verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resend verification code. Please try again."
        )