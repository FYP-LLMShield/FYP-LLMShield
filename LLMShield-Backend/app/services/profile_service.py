"""
Profile service for managing user profiles and their model configurations
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection

from app.core.database import get_database
from app.models.profile import (
    Profile, ProfileCreateRequest, ProfileUpdateRequest, 
    ProfileResponse, ProfileListResponse, ProfileStats, ProfileWithConfigs
)
from app.models.model_config import ModelConfig
from app.services.model_config_service import ModelConfigService


class ProfileService:
    """Service for managing user profiles and their model configurations"""
    
    def __init__(self):
        self.collection_name = "profiles"
        self.model_config_service = ModelConfigService()
    
    async def get_collection(self):
        """Get profiles collection"""
        db = await get_database()
        return db[self.collection_name]
    
    async def create_profile(self, user_id: str, profile_request: ProfileCreateRequest) -> Profile:
        """Create a new profile for a user"""
        collection = await self.get_collection()
        
        # Check if profile name already exists for this user
        existing_profile = await collection.find_one({
            "user_id": user_id,
            "profile_name": profile_request.profile_name
        })
        
        if existing_profile:
            raise ValueError(f"Profile with name '{profile_request.profile_name}' already exists")
        
        # Validate tags
        if profile_request.tags:
            for tag in profile_request.tags:
                if not tag.strip():
                    raise ValueError("Tags cannot be empty")
        
        # Create profile document
        now = datetime.utcnow()
        profile_data = {
            "user_id": user_id,
            "profile_name": profile_request.profile_name,
            "description": profile_request.description,
            "tags": profile_request.tags or [],
            "model_config_ids": [],
            "is_active": True,
            "settings": profile_request.settings,
            "created_at": now,
            "updated_at": now
        }
        
        # Insert into database
        result = await collection.insert_one(profile_data)
        profile_data["id"] = str(result.inserted_id)
        
        return Profile(**profile_data)
    
    async def get_profile(self, user_id: str, profile_id: str) -> Optional[Profile]:
        """Get a specific profile by ID"""
        collection = await self.get_collection()
        
        try:
            object_id = ObjectId(profile_id)
        except Exception:
            return None
        
        profile_doc = await collection.find_one({
            "_id": object_id,
            "user_id": user_id
        })
        
        if not profile_doc:
            return None
        
        profile_doc["id"] = str(profile_doc["_id"])
        del profile_doc["_id"]
        
        return Profile(**profile_doc)
    
    async def get_profile_with_configs(self, user_id: str, profile_id: str) -> Optional[ProfileWithConfigs]:
        """Get a profile with populated model configurations"""
        profile = await self.get_profile(user_id, profile_id)
        if not profile:
            return None
        
        # Get model configurations
        model_configs = []
        for config_id in profile.model_config_ids:
            try:
                config = await self.model_config_service.get_model_config(user_id, config_id)
                if config:
                    model_configs.append(config.dict())
            except Exception:
                # Skip invalid config IDs
                continue
        
        profile_dict = profile.dict()
        profile_dict["model_configs"] = model_configs
        
        return ProfileWithConfigs(**profile_dict)
    
    async def get_user_profiles(
        self, 
        user_id: str, 
        page: int = 1, 
        page_size: int = 20,
        active_only: bool = False,
        tags: Optional[List[str]] = None
    ) -> ProfileListResponse:
        """Get all profiles for a user with pagination and filtering"""
        collection = await self.get_collection()
        
        # Build query
        query = {"user_id": user_id}
        
        if active_only:
            query["is_active"] = True
        
        if tags:
            query["tags"] = {"$in": [tag.lower() for tag in tags]}
        
        # Get total count
        total = await collection.count_documents(query)
        
        # Calculate skip
        skip = (page - 1) * page_size
        
        # Get profiles with pagination
        cursor = collection.find(query).skip(skip).limit(page_size).sort("created_at", -1)
        profiles = []
        
        async for profile_doc in cursor:
            profile_doc["id"] = str(profile_doc["_id"])
            del profile_doc["_id"]
            profiles.append(ProfileResponse(**profile_doc))
        
        return ProfileListResponse(
            profiles=profiles,
            total=total,
            page=page,
            page_size=page_size
        )
    
    async def list_profiles(
        self, 
        user_id: str, 
        page: int = 1, 
        page_size: int = 10,
        search: Optional[str] = None,
        tags: Optional[List[str]] = None,
        is_active: Optional[bool] = None
    ) -> ProfileListResponse:
        """List profiles for a user with pagination and filtering"""
        collection = await self.get_collection()
        
        # Build query
        query = {"user_id": user_id}
        
        if search:
            query["$or"] = [
                {"profile_name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]
        
        if tags:
            query["tags"] = {"$in": tags}
        
        if is_active is not None:
            query["is_active"] = is_active
        
        # Get total count
        total = await collection.count_documents(query)
        
        # Calculate pagination
        skip = (page - 1) * page_size
        cursor = collection.find(query).skip(skip).limit(page_size).sort("created_at", -1)
        
        profiles = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            profiles.append(Profile(**doc))
        
        return ProfileListResponse(
            profiles=profiles,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size
        )
    
    async def update_profile(
        self, 
        user_id: str, 
        profile_id: str, 
        update_request: ProfileUpdateRequest
    ) -> Optional[Profile]:
        """Update a profile"""
        collection = await self.get_collection()
        
        try:
            object_id = ObjectId(profile_id)
        except Exception:
            return None
        
        # Check if profile exists
        existing_profile = await collection.find_one({
            "_id": object_id,
            "user_id": user_id
        })
        
        if not existing_profile:
            return None
        
        # Check for name conflicts if name is being updated
        if update_request.profile_name and update_request.profile_name != existing_profile["profile_name"]:
            name_conflict = await collection.find_one({
                "user_id": user_id,
                "profile_name": update_request.profile_name,
                "_id": {"$ne": object_id}
            })
            
            if name_conflict:
                raise ValueError(f"Profile with name '{update_request.profile_name}' already exists")
        
        # Build update document
        update_data = {"updated_at": datetime.utcnow()}
        
        if update_request.profile_name is not None:
            update_data["profile_name"] = update_request.profile_name
        
        if update_request.description is not None:
            update_data["description"] = update_request.description
        
        if update_request.tags is not None:
            update_data["tags"] = update_request.tags
        
        if update_request.settings is not None:
            update_data["settings"] = update_request.settings
        
        if update_request.is_active is not None:
            update_data["is_active"] = update_request.is_active
        
        # Update profile
        result = await collection.update_one(
            {"_id": object_id, "user_id": user_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            return None
        
        # Return updated profile
        return await self.get_profile(user_id, profile_id)
    
    async def delete_profile(self, user_id: str, profile_id: str) -> bool:
        """Delete a profile"""
        collection = await self.get_collection()
        
        try:
            object_id = ObjectId(profile_id)
        except Exception:
            return False
        
        result = await collection.delete_one({
            "_id": object_id,
            "user_id": user_id
        })
        
        return result.deleted_count > 0
    
    async def add_model_config_to_profile(
        self, 
        user_id: str, 
        profile_id: str, 
        model_config_id: str
    ) -> bool:
        """Add a model configuration to a profile"""
        collection = await self.get_collection()
        
        try:
            profile_object_id = ObjectId(profile_id)
        except Exception:
            return False
        
        # Verify model config exists and belongs to user
        model_config = await self.model_config_service.get_model_config(user_id, model_config_id)
        if not model_config:
            return False
        
        # Add to profile
        result = await collection.update_one(
            {"_id": profile_object_id, "user_id": user_id},
            {
                "$addToSet": {"model_config_ids": model_config_id},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return result.modified_count > 0
    
    async def remove_model_config_from_profile(
        self, 
        user_id: str, 
        profile_id: str, 
        model_config_id: str
    ) -> bool:
        """Remove a model configuration from a profile"""
        collection = await self.get_collection()
        
        try:
            profile_object_id = ObjectId(profile_id)
        except Exception:
            return False
        
        result = await collection.update_one(
            {"_id": profile_object_id, "user_id": user_id},
            {
                "$pull": {"model_config_ids": model_config_id},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return result.modified_count > 0
    
    async def get_profile_stats(self, user_id: str) -> ProfileStats:
        """Get profile statistics for a user"""
        collection = await self.get_collection()
        
        # Get all profiles for user
        all_profiles = await collection.find({"user_id": user_id}).to_list(length=None)
        
        total_profiles = len(all_profiles)
        active_profiles = len([p for p in all_profiles if p.get("is_active", True)])
        
        # Get total model configs across all profiles
        total_model_configs = sum(len(p.get("model_config_ids", [])) for p in all_profiles)
        
        # Get recent profiles (last 5)
        recent_cursor = collection.find({"user_id": user_id}).sort("created_at", -1).limit(5)
        recent_profiles = []
        async for doc in recent_cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            recent_profiles.append(Profile(**doc))
        
        return ProfileStats(
            total_profiles=total_profiles,
            active_profiles=active_profiles,
            total_model_configs=total_model_configs,
            recent_profiles=recent_profiles
        )


# Create service instance
profile_service = ProfileService()