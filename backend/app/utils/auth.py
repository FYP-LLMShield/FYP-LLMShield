# app/utils/auth.py - FIXED VERSION
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.database import get_database
from app.utils.user_service import user_service  # Use the global instance
from app.models.user import UserInDB
import secrets
import string

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme - auto_error=False to handle missing tokens gracefully
security = HTTPBearer(auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash (bcrypt has 72-byte limit, so truncate if needed)"""
    # Bcrypt has a 72-byte limit (not character limit!)
    # Encode to bytes to check actual byte length, then truncate
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        # Truncate to 72 bytes, then decode back to string
        password = password_bytes[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    """Create JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(token: str, token_type: str = "access"):
    """Verify and decode JWT token"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        if not token:
            logger.warning("Token is empty")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing or empty",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        token_type_from_token: str = payload.get("type")
        
        if email is None:
            logger.warning(f"Token missing 'sub' field. Payload: {payload}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user identifier",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if token_type_from_token != token_type:
            logger.warning(f"Token type mismatch. Expected: {token_type}, Got: {token_type_from_token}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {token_type} token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.debug(f"Token verified successfully for user: {email}")
        return email
    except JWTError as e:
        logger.warning(f"JWT validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> UserInDB:
    """
    Dependency to get current authenticated user
    FIXED: Use global user_service instance instead of creating new one
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Check if credentials are provided
        if credentials is None:
            logger.warning("No Authorization header provided")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required. Please provide a valid token in the Authorization header.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Extract token from credentials
        token = credentials.credentials
        
        if not token:
            logger.warning("Authorization header present but token is empty")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing. Please provide a valid authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.debug(f"Verifying token: {token[:20]}...")
        
        # Verify and decode the token
        email = verify_token(token, "access")
        
        # Get user from database (tries Supabase first, falls back to MongoDB)
        from app.utils.unified_user_service import unified_user_service
        user = await unified_user_service.get_user_by_email(email)
        
        if user is None:
            logger.warning(f"User not found for email: {email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.debug(f"User authenticated successfully: {email}")
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[UserInDB]:
    """
    Dependency to get current user if token is provided.
    Returns None when unauthenticated instead of raising.
    """
    if credentials is None:
        return None

    token = credentials.credentials
    if not token:
        return None

    try:
        email = verify_token(token, "access")
        from app.utils.unified_user_service import unified_user_service
        return await unified_user_service.get_user_by_email(email)
    except HTTPException:
        return None

def generate_verification_token() -> str:
    """Generate a random verification token"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))

def generate_reset_token() -> str:
    """Generate a random password reset token"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))