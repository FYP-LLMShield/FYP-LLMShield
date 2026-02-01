"""
Profile management API routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

from app.utils.auth import get_current_user
from app.models.user import UserInDB
from app.models.profile import (
    ProfileCreateRequest, ProfileUpdateRequest, ProfileResponse, 
    ProfileListResponse, ProfileStats, ProfileWithConfigs
)
from app.services.profile_service import profile_service

router = APIRouter(tags=["profiles"])


@router.post("/", response_model=ProfileResponse, status_code=201)
async def create_profile(
    profile_request: ProfileCreateRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Create a new profile for the current user.
    
    - **profile_name**: Unique name for the profile (3-100 characters)
    - **description**: Optional description (max 500 characters)
    - **tags**: List of tags for categorization
    - **is_active**: Whether the profile is active (default: true)
    - **model_config_ids**: List of model configuration IDs to include
    - **settings**: Profile-specific settings as key-value pairs
    """
    try:
        profile = await profile_service.create_profile(current_user.id, profile_request)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create profile: {str(e)}")


@router.get("/", response_model=ProfileListResponse)
async def list_profiles(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Number of profiles per page"),
    active_only: bool = Query(False, description="Filter to active profiles only"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Get a paginated list of profiles for the current user.
    
    - **page**: Page number (starts from 1)
    - **page_size**: Number of profiles per page (1-100)
    - **active_only**: If true, only return active profiles
    - **tags**: Filter profiles by tags (comma-separated)
    """
    try:
        profiles = await profile_service.get_user_profiles(
            current_user.id, 
            page=page, 
            page_size=page_size,
            active_only=active_only,
            tags=tags
        )
        return profiles
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve profiles: {str(e)}")


@router.get("/stats", response_model=ProfileStats)
async def get_profile_stats(
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Get statistics about the current user's profiles.
    
    Returns:
    - Total number of profiles
    - Number of active/inactive profiles
    - Profile count by tag
    - Recently created profiles
    """
    try:
        stats = await profile_service.get_profile_stats(current_user.id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve profile statistics: {str(e)}")


@router.get("/{profile_id}", response_model=ProfileResponse)
async def get_profile(
    profile_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Get a specific profile by ID.
    
    - **profile_id**: The unique identifier of the profile
    """
    profile = await profile_service.get_profile(current_user.id, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile


@router.get("/{profile_id}/with-configs", response_model=ProfileWithConfigs)
async def get_profile_with_configs(
    profile_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Get a specific profile with populated model configurations.
    
    - **profile_id**: The unique identifier of the profile
    
    Returns the profile with full model configuration details included.
    """
    profile = await profile_service.get_profile_with_configs(current_user.id, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile


@router.put("/{profile_id}", response_model=ProfileResponse)
async def update_profile(
    profile_id: str,
    profile_request: ProfileUpdateRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Update an existing profile.
    
    - **profile_id**: The unique identifier of the profile
    - Only provided fields will be updated
    - Profile name must be unique among user's profiles
    """
    try:
        profile = await profile_service.update_profile(current_user.id, profile_id, profile_request)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")


@router.delete("/{profile_id}", status_code=204)
async def delete_profile(
    profile_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Delete a profile.
    
    - **profile_id**: The unique identifier of the profile
    
    This action cannot be undone.
    """
    success = await profile_service.delete_profile(current_user.id, profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")


@router.post("/{profile_id}/model-configs/{config_id}", response_model=ProfileResponse)
async def add_model_config_to_profile(
    profile_id: str,
    config_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Add a model configuration to a profile.
    
    - **profile_id**: The unique identifier of the profile
    - **config_id**: The unique identifier of the model configuration
    
    The model configuration must belong to the current user.
    """
    try:
        profile = await profile_service.add_model_config_to_profile(
            current_user.id, profile_id, config_id
        )
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add model configuration: {str(e)}")


@router.delete("/{profile_id}/model-configs/{config_id}", response_model=ProfileResponse)
async def remove_model_config_from_profile(
    profile_id: str,
    config_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Remove a model configuration from a profile.
    
    - **profile_id**: The unique identifier of the profile
    - **config_id**: The unique identifier of the model configuration
    """
    try:
        profile = await profile_service.remove_model_config_from_profile(
            current_user.id, profile_id, config_id
        )
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found or model configuration not in profile")
        
        return profile
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove model configuration: {str(e)}")


@router.post("/{profile_id}/duplicate", response_model=ProfileResponse, status_code=201)
async def duplicate_profile(
    profile_id: str,
    new_name: str = Query(..., description="Name for the duplicated profile"),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Create a duplicate of an existing profile with a new name.
    
    - **profile_id**: The unique identifier of the profile to duplicate
    - **new_name**: Name for the new duplicated profile
    
    All settings, tags, and model configurations will be copied.
    """
    # Get the original profile
    original_profile = await profile_service.get_profile(current_user.id, profile_id)
    if not original_profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Create duplicate request
    duplicate_request = ProfileCreateRequest(
        profile_name=new_name,
        description=f"Copy of {original_profile.profile_name}",
        tags=original_profile.tags.copy(),
        is_active=original_profile.is_active,
        model_config_ids=original_profile.model_config_ids.copy(),
        settings=original_profile.settings.copy()
    )
    
    try:
        duplicate_profile = await profile_service.create_profile(current_user.id, duplicate_request)
        return duplicate_profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to duplicate profile: {str(e)}")


@router.patch("/{profile_id}/toggle-active", response_model=ProfileResponse)
async def toggle_profile_active(
    profile_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Toggle the active status of a profile.
    
    - **profile_id**: The unique identifier of the profile
    
    If the profile is active, it will be deactivated, and vice versa.
    """
    # Get current profile
    profile = await profile_service.get_profile(current_user.id, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Toggle active status
    update_request = ProfileUpdateRequest(is_active=not profile.is_active)
    
    try:
        updated_profile = await profile_service.update_profile(current_user.id, profile_id, update_request)
        return updated_profile
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle profile status: {str(e)}")