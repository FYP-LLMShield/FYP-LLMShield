"""
Password reset models for forgot password functionality
"""

from datetime import datetime, timedelta
from typing import Optional, Tuple
from pydantic import BaseModel, EmailStr, validator
import secrets
import hashlib


class PasswordResetToken(BaseModel):
    """Password reset token model"""
    id: Optional[str] = None
    user_id: str
    email: EmailStr
    token_hash: str
    expires_at: datetime
    created_at: datetime
    used: bool = False

    @classmethod
    def create_for_user(cls, user_id: str, email: str) -> Tuple["PasswordResetToken", str]:
        """Create password reset token for user"""
        # Generate secure random token
        raw_token = secrets.token_urlsafe(32)
        
        # Hash the token for storage
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        
        token_obj = cls(
            user_id=user_id,
            email=email,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(hours=1),  # 1 hour expiry
            created_at=datetime.utcnow(),
            used=False
        )
        
        return token_obj, raw_token

    def is_valid(self) -> bool:
        """Check if token is still valid"""
        return not self.used and datetime.utcnow() < self.expires_at

    def verify_token(self, raw_token: str) -> bool:
        """Verify the raw token against stored hash"""
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        return token_hash == self.token_hash

    def to_dict(self) -> dict:
        """Convert to dictionary for database storage"""
        return {
            "user_id": self.user_id,
            "email": self.email,
            "token_hash": self.token_hash,
            "expires_at": self.expires_at,
            "created_at": self.created_at,
            "used": self.used
        }


class ForgotPasswordRequest(BaseModel):
    """Request model for forgot password"""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Request model for password reset"""
    token: str
    new_password: str

    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v