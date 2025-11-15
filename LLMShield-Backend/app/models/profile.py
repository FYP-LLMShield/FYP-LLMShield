"""
Profile models and schemas for LLMShield Backend
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId


class ProfileBase(BaseModel):
    """Base profile model with common fields"""
    profile_name: str = Field(..., min_length=3, max_length=100, description="Profile name")
    description: Optional[str] = Field(None, max_length=500, description="Profile description")
    tags: List[str] = Field(default_factory=list, description="Profile tags")
    is_active: bool = Field(default=True, description="Whether the profile is active")
    
    @validator('profile_name')
    def validate_profile_name(cls, v):
        """Validate profile name format"""
        import re
        if not re.match(r'^[a-zA-Z0-9\s\-_\.]+$', v.strip()):
            raise ValueError("Profile name can only contain letters, numbers, spaces, hyphens, underscores, and dots")
        return v.strip()
    
    @validator('tags')
    def validate_tags(cls, v):
        """Validate tags format"""
        import re
        for tag in v:
            if not isinstance(tag, str):
                raise ValueError("All tags must be strings")
            if len(tag.strip()) == 0:
                raise ValueError("Tags cannot be empty")
            if len(tag.strip()) > 50:
                raise ValueError("Each tag must be less than 50 characters")
            if not re.match(r'^[a-zA-Z0-9\-_]+$', tag.strip()):
                raise ValueError("Tags can only contain letters, numbers, hyphens, and underscores")
        return [tag.strip().lower() for tag in v]


class Profile(ProfileBase):
    """Complete profile model with all fields"""
    id: Optional[str] = Field(None, description="Profile ID")
    user_id: str = Field(..., description="User ID who owns this profile")
    model_config_ids: List[str] = Field(default_factory=list, description="List of model configuration IDs")
    settings: Dict[str, Any] = Field(default_factory=dict, description="Profile-specific settings")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    
    class Config:
        """Pydantic configuration"""
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }
        allow_population_by_field_name = True


class ProfileCreateRequest(ProfileBase):
    """Request model for creating a new profile"""
    model_config_ids: List[str] = Field(default_factory=list, description="List of model configuration IDs")
    settings: Dict[str, Any] = Field(default_factory=dict, description="Profile-specific settings")


class ProfileUpdateRequest(BaseModel):
    """Request model for updating an existing profile"""
    profile_name: Optional[str] = Field(None, min_length=3, max_length=100, description="Profile name")
    description: Optional[str] = Field(None, max_length=500, description="Profile description")
    tags: Optional[List[str]] = Field(None, description="Profile tags")
    is_active: Optional[bool] = Field(None, description="Whether the profile is active")
    model_config_ids: Optional[List[str]] = Field(None, description="List of model configuration IDs")
    settings: Optional[Dict[str, Any]] = Field(None, description="Profile-specific settings")
    
    @validator('profile_name')
    def validate_profile_name(cls, v):
        """Validate profile name format"""
        if v is not None:
            import re
            if not re.match(r'^[a-zA-Z0-9\s\-_\.]+$', v.strip()):
                raise ValueError("Profile name can only contain letters, numbers, spaces, hyphens, underscores, and dots")
            return v.strip()
        return v
    
    @validator('tags')
    def validate_tags(cls, v):
        """Validate tags format"""
        if v is not None:
            import re
            for tag in v:
                if not isinstance(tag, str):
                    raise ValueError("All tags must be strings")
                if len(tag.strip()) == 0:
                    raise ValueError("Tags cannot be empty")
                if len(tag.strip()) > 50:
                    raise ValueError("Each tag must be less than 50 characters")
                if not re.match(r'^[a-zA-Z0-9\-_]+$', tag.strip()):
                    raise ValueError("Tags can only contain letters, numbers, hyphens, and underscores")
            return [tag.strip().lower() for tag in v]
        return v


class ProfileResponse(Profile):
    """Response model for profile operations"""
    pass


class ProfileListResponse(BaseModel):
    """Response model for listing profiles"""
    profiles: List[ProfileResponse] = Field(..., description="List of profiles")
    total: int = Field(..., description="Total number of profiles")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of profiles per page")


class ProfileWithConfigs(ProfileResponse):
    """Profile response with populated model configurations"""
    model_configs: List[Dict[str, Any]] = Field(default_factory=list, description="Populated model configurations")


class ProfileStats(BaseModel):
    """Profile statistics model"""
    total_profiles: int = Field(..., description="Total number of profiles")
    active_profiles: int = Field(..., description="Number of active profiles")
    inactive_profiles: int = Field(..., description="Number of inactive profiles")
    profiles_by_tag: Dict[str, int] = Field(..., description="Profile count by tag")
    recent_profiles: List[ProfileResponse] = Field(..., description="Recently created profiles")