# Updated app/models/user.py - Add subscription fields

from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, field_validator
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler=None):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")
        return field_schema

# Request Models (from frontend) - Keep existing ones
class UserRegistration(BaseModel):
    email: EmailStr
    password: str
    username: str
    name: str
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not v:
            raise ValueError('Password is required')
        if len(v) > 72:
            raise ValueError('Password cannot be longer than 72 characters')
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

class UserCreate(BaseModel):
    """Model for creating new users with email verification"""
    email: EmailStr
    username: str
    name: str
    display_name: str = ""
    password: str

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if not v or not v.strip():
            raise ValueError('Username is required')
        if len(v.strip()) < 3:
            raise ValueError('Username must be at least 3 characters long')
        if len(v.strip()) > 50:
            raise ValueError('Username must be at most 50 characters long')
        return v.strip()

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not v:
            raise ValueError('Password is required')
        if len(v) > 72:
            raise ValueError('Password cannot be longer than 72 characters')
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

class MessageResponse(BaseModel):
    """Generic message response model"""
    message: str

class UserLogin(BaseModel):
    """Login accepts email or username in the email field for evaluation flexibility."""
    email: str  # Email or username (backend authenticates by both)
    password: str
    totp_code: Optional[str] = None
    recovery_code: Optional[str] = None
    trust_device: bool = False

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str
    new_password: str
    
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        if not v:
            raise ValueError('Password is required')
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if len(v) > 72:
            raise ValueError('Password cannot be longer than 72 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if v is not None:
            if not v or not v.strip():
                raise ValueError('Username is required')
            if len(v.strip()) < 3:
                raise ValueError('Username must be at least 3 characters long')
            if len(v.strip()) > 20:
                raise ValueError('Username must be at most 20 characters long')
            # Allow only alphanumeric characters and underscores
            if not v.replace('_', '').isalnum():
                raise ValueError('Username can only contain letters, numbers, and underscores')
            return v.strip().lower()
        return v
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            if not v or not v.strip():
                raise ValueError('Name is required')
            if len(v.strip()) < 2:
                raise ValueError('Name must be at least 2 characters long')
        return v.strip() if v else v
    
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        if v and len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if v and not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if v and not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if v and not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v

# UPDATED: Database Model with MFA fields AND subscription reference
class UserInDB(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    email: EmailStr
    hashed_password: Optional[str] = None  # Optional for Google users
    username: str
    name: str
    is_verified: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    
    # Google OAuth fields
    google_id: Optional[str] = None
    profile_picture: Optional[str] = None
    display_name: Optional[str] = ""
    
    # Account management
    verification_token: Optional[str] = None
    reset_token: Optional[str] = None
    reset_token_expires: Optional[datetime] = None
    
    # MFA fields
    mfa_enabled: bool = False
    mfa_secret: Optional[str] = None
    recovery_codes: List[str] = Field(default_factory=list)
    trusted_devices: List[Any] = Field(default_factory=list)
    mfa_setup_complete: bool = False
    
    # NEW: Subscription reference
    subscription_id: Optional[PyObjectId] = None
    
    # NEW: Quick access fields (denormalized for performance)
    current_subscription_tier: str = "premium"  # For now, everyone gets premium
    subscription_status: str = "active"

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }

# Response Models (to frontend) - Updated with subscription info
class UserResponse(BaseModel):
    id: str
    email: EmailStr
    username: str
    name: str
    is_verified: bool
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    
    # NEW: Subscription info in user response
    subscription_tier: str
    subscription_status: str
    features_available: List[str] = Field(default_factory=list)

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    email: Optional[str] = None

# MFA Request/Response Models (keep existing)
class MFASetupRequest(BaseModel):
    totp_code: str

class MFAVerifyRequest(BaseModel):
    totp_code: str

class MFADisableRequest(BaseModel):
    current_password: Optional[str] = None  # Optional for Google/social sign-in users
    totp_code: str

class MFASetupResponse(BaseModel):
    qr_code: str
    secret: str
    backup_url: str
    recovery_codes: List[str]

class MFAStatusResponse(BaseModel):
    mfa_enabled: bool
    setup_complete: bool
    recovery_codes_remaining: int

class RecoveryCodeRequest(BaseModel):
    recovery_code: str