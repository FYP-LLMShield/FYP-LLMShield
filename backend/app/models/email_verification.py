"""
Email verification models for user registration
"""

from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
import random
import hashlib


class EmailVerificationToken(BaseModel):
    """Email verification token model"""
    id: Optional[str] = None
    email: EmailStr
    code: str
    username: str
    password_hash: str
    expires_at: datetime
    created_at: datetime

    @classmethod
    def create_for_registration(cls, email: str, username: str, password: str) -> "EmailVerificationToken":
        """Create verification token for user registration"""
        from app.utils.password_hash import hash_password
        
        # Generate 6-digit code
        code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        
        # Hash password (72-byte safe)
        password_hash = hash_password(password)
        
        return cls(
            email=email,
            code=code,
            username=username,
            password_hash=password_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=10),
            created_at=datetime.utcnow()
        )

    def is_valid(self) -> bool:
        """Check if token is still valid"""
        return datetime.utcnow() < self.expires_at

    def to_dict(self) -> dict:
        """Convert to dictionary for database storage"""
        return {
            "email": self.email,
            "code": self.code,
            "username": self.username,
            "password_hash": self.password_hash,
            "expires_at": self.expires_at,
            "created_at": self.created_at
        }


class EmailVerificationRequest(BaseModel):
    """Request model for email verification"""
    email: EmailStr
    code: str

    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if not v or len(v) != 6 or not v.isdigit():
            raise ValueError('Code must be 6 digits')
        return v


class ResendVerificationRequest(BaseModel):
    """Request model for resending verification code"""
    email: EmailStr