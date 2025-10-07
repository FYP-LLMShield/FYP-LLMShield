# Updated app/models/user.py - Add subscription fields

from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, validator
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
    full_name: str
    
    @validator('full_name')
    def validate_full_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Full name is required')
        if len(v.strip()) < 2:
            raise ValueError('Full name must be at least 2 characters long')
        return v.strip()
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    # Add MFA fields for future use
    totp_code: Optional[str] = None
    recovery_code: Optional[str] = None
    trust_device: bool = False

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str
    new_password: str
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None
    
    @validator('new_password')
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
    hashed_password: str
    full_name: str
    is_verified: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    
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

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Response Models (to frontend) - Updated with subscription info
class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
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
    current_password: str
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