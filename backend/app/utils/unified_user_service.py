"""
Unified User Service with Polyglot Persistence
Primary: Supabase, Fallback: MongoDB
"""
import logging
from typing import Optional, Tuple
from app.models.user import UserInDB, UserRegistration
from app.utils.supabase_user_service import SupabaseUserService
from app.utils.user_service import UserService as MongoUserService

logger = logging.getLogger(__name__)


class UnifiedUserService:
    """
    Unified user service with polyglot persistence
    - Primary: Supabase
    - Fallback: MongoDB
    - Dual-write: Write to both for redundancy
    """
    
    def __init__(self):
        self.supabase_service = SupabaseUserService()
        self.mongo_service = MongoUserService()
    
    async def create_user(self, user_data: UserRegistration) -> Tuple[Optional[UserInDB], bool]:
        """
        Create user in both databases (dual-write)
        Returns: (user, is_from_supabase)
        """
        from fastapi import HTTPException

        supabase_user = None
        mongo_user = None
        supabase_success = False
        mongo_success = False
        supabase_error = None
        mongo_error = None

        # Try Supabase first (primary)
        try:
            if self.supabase_service.is_available():
                supabase_user = await self.supabase_service.create_user(user_data)
                if supabase_user:
                    supabase_success = True
                    logger.info(f"User created in Supabase: {user_data.email}")
        except HTTPException as e:
            # Re-raise HTTP exceptions (validation errors)
            supabase_error = e
            logger.warning(f"Supabase validation error: {e.detail}")
        except Exception as e:
            logger.error(f"Failed to create user in Supabase: {e}")

        # Always try MongoDB (fallback/redundancy)
        try:
            mongo_user = await self.mongo_service.create_user(user_data)
            if mongo_user:
                mongo_success = True
                logger.info(f"User created in MongoDB: {user_data.email}")
        except HTTPException as e:
            # Store HTTP exceptions to re-raise if both databases fail
            mongo_error = e
            logger.warning(f"MongoDB validation error: {e.detail}")
        except Exception as e:
            logger.error(f"Failed to create user in MongoDB: {e}")

        # Return primary (Supabase) if available, otherwise MongoDB
        if supabase_user:
            return supabase_user, True
        elif mongo_user:
            logger.warning(f"User created only in MongoDB (Supabase unavailable): {user_data.email}")
            return mongo_user, False
        else:
            # If both failed and we have an HTTP error, re-raise it (e.g., duplicate email)
            if mongo_error:
                raise mongo_error
            elif supabase_error:
                raise supabase_error

            logger.error(f"Failed to create user in both databases: {user_data.email}")
            return None, False
    
    async def get_user_by_email(self, email: str) -> Optional[UserInDB]:
        """Get user by email - try Supabase first, fallback to MongoDB"""
        # Try Supabase first (primary)
        try:
            if self.supabase_service.is_available():
                user = await self.supabase_service.get_user_by_email(email)
                if user:
                    logger.debug(f"User found in Supabase: {email}")
                    return user
        except Exception as e:
            logger.warning(f"Supabase unavailable, falling back to MongoDB: {e}")
        
        # Fallback to MongoDB
        try:
            user = await self.mongo_service.get_user_by_email(email)
            if user:
                logger.info(f"User found in MongoDB (fallback): {email}")
                # Optionally sync back to Supabase if it comes back online
                if self.supabase_service.is_available():
                    try:
                        # Check if user exists in Supabase
                        existing = await self.supabase_service.get_user_by_email(email)
                        if not existing:
                            # Sync user to Supabase
                            logger.info(f"Syncing user to Supabase: {email}")
                            # This would require a sync method - for now just log
                    except Exception as sync_error:
                        logger.warning(f"Failed to sync user to Supabase: {sync_error}")
                return user
        except Exception as e:
            logger.error(f"Error getting user from MongoDB: {e}")
        
        return None
    
    async def get_user_by_username(self, username: str) -> Optional[UserInDB]:
        """Get user by username - try Supabase first, fallback to MongoDB"""
        # Try Supabase first
        try:
            if self.supabase_service.is_available():
                user = await self.supabase_service.get_user_by_username(username)
                if user:
                    return user
        except Exception as e:
            logger.warning(f"Supabase unavailable, falling back to MongoDB: {e}")
        
        # Fallback to MongoDB
        try:
            user = await self.mongo_service.get_user_by_username(username)
            if user:
                logger.info(f"User found in MongoDB (fallback): {username}")
                return user
        except Exception as e:
            logger.error(f"Error getting user from MongoDB: {e}")
        
        return None
    
    async def authenticate_user(self, username_or_email: str, password: str) -> Optional[UserInDB]:
        """Authenticate user - try Supabase first, fallback to MongoDB"""
        # Try Supabase first
        try:
            if self.supabase_service.is_available():
                user = await self.supabase_service.authenticate_user(username_or_email, password)
                if user:
                    logger.debug(f"User authenticated via Supabase: {username_or_email}")
                    return user
        except Exception as e:
            logger.warning(f"Supabase authentication failed, trying MongoDB: {e}")
        
        # Fallback to MongoDB
        try:
            user = await self.mongo_service.authenticate_user(username_or_email, password)
            if user:
                logger.info(f"User authenticated via MongoDB (fallback): {username_or_email}")
                return user
        except Exception as e:
            logger.error(f"Error authenticating user in MongoDB: {e}")
        
        return None
    
    async def verify_user_email(self, token: str) -> bool:
        """Verify user email - try both databases"""
        supabase_success = False
        mongo_success = False
        
        # Try Supabase
        try:
            if self.supabase_service.is_available():
                supabase_success = await self.supabase_service.verify_user_email(token)
        except Exception as e:
            logger.warning(f"Supabase email verification failed: {e}")
        
        # Try MongoDB
        try:
            mongo_success = await self.mongo_service.verify_user_email(token)
        except Exception as e:
            logger.error(f"MongoDB email verification failed: {e}")
        
        # Return True if either succeeded
        return supabase_success or mongo_success
    
    async def update_user_last_login(self, email: str) -> bool:
        """Update last login in both databases"""
        supabase_success = False
        mongo_success = False
        
        # Update Supabase
        try:
            if self.supabase_service.is_available():
                supabase_success = await self.supabase_service.update_user_last_login(email)
        except Exception as e:
            logger.warning(f"Failed to update last login in Supabase: {e}")
        
        # Update MongoDB
        try:
            mongo_success = await self.mongo_service.update_user_last_login(email)
        except Exception as e:
            logger.error(f"Failed to update last login in MongoDB: {e}")
        
        return supabase_success or mongo_success
    
    async def update_profile(self, email: str, update_data: dict) -> bool:
        """Update profile in both databases"""
        supabase_success = False
        mongo_success = False
        
        # Update Supabase
        try:
            if self.supabase_service.is_available():
                supabase_success = await self.supabase_service.update_profile(email, update_data)
        except Exception as e:
            logger.warning(f"Failed to update profile in Supabase: {e}")
        
        # Update MongoDB
        try:
            mongo_success = await self.mongo_service.update_profile(email, update_data)
        except Exception as e:
            logger.error(f"Failed to update profile in MongoDB: {e}")
        
        return supabase_success or mongo_success
    
    async def create_google_user(self, user_data: dict) -> Tuple[Optional[UserInDB], bool]:
        """Create Google user in both databases"""
        supabase_user = None
        mongo_user = None
        
        # Try Supabase first
        try:
            if self.supabase_service.is_available():
                supabase_user = await self.supabase_service.create_google_user(user_data)
        except Exception as e:
            logger.warning(f"Failed to create Google user in Supabase: {e}")
        
        # Try MongoDB (convert dict to proper format)
        try:
            # Create user directly in MongoDB using the user service
            # Convert dict format to UserRegistration-like format
            from app.models.user import UserRegistration
            from datetime import datetime
            
            # MongoDB expects datetime objects, not ISO strings
            def parse_dt(value):
                if isinstance(value, str):
                    try:
                        return datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except:
                        return datetime.utcnow()
                return value if value else datetime.utcnow()
            
            mongo_user_data = {
                "email": user_data["email"],
                "username": user_data["username"],
                "name": user_data["name"],
                "hashed_password": user_data.get("hashed_password"),
                "is_verified": user_data.get("is_verified", True),
                "is_active": user_data.get("is_active", True),
                "google_id": user_data.get("google_id"),
                "profile_picture": user_data.get("profile_picture"),
                "display_name": user_data.get("display_name", ""),
                "created_at": parse_dt(user_data.get("created_at")),
                "updated_at": parse_dt(user_data.get("updated_at")),
                "last_login": parse_dt(user_data.get("last_login")),
                "mfa_enabled": user_data.get("mfa_enabled", False),
                "mfa_secret": user_data.get("mfa_secret"),
                "recovery_codes": user_data.get("recovery_codes", []),
                "trusted_devices": user_data.get("trusted_devices", []),
                "mfa_setup_complete": user_data.get("mfa_setup_complete", False),
                "verification_token": user_data.get("verification_token"),
                "reset_token": user_data.get("reset_token"),
                "reset_token_expires": parse_dt(user_data.get("reset_token_expires")) if user_data.get("reset_token_expires") else None,
                "subscription_id": user_data.get("subscription_id"),
                "current_subscription_tier": user_data.get("current_subscription_tier", "premium"),
                "subscription_status": user_data.get("subscription_status", "active")
            }
            
            # Use MongoDB collection directly to insert
            collection = await self.mongo_service.get_collection()
            result = await collection.insert_one(mongo_user_data)
            mongo_user_data["_id"] = result.inserted_id
            
            # Convert to UserInDB
            mongo_user = UserInDB(**mongo_user_data)
            
        except Exception as e:
            logger.error(f"Failed to create Google user in MongoDB: {e}")
            mongo_user = None
        
        # Return primary if available
        if supabase_user:
            return supabase_user, True
        elif mongo_user:
            return mongo_user, False
        else:
            return None, False
    
    async def update_google_user(self, email: str, update_data: dict) -> bool:
        """Update Google user in both databases"""
        supabase_success = False
        mongo_success = False
        
        # Update Supabase
        try:
            if self.supabase_service.is_available():
                supabase_success = await self.supabase_service.update_google_user(email, update_data)
        except Exception as e:
            logger.warning(f"Failed to update Google user in Supabase: {e}")
        
        # Update MongoDB
        try:
            mongo_success = await self.mongo_service.update_profile(email, update_data)
        except Exception as e:
            logger.error(f"Failed to update Google user in MongoDB: {e}")
        
        return supabase_success or mongo_success

# Global instance
unified_user_service = UnifiedUserService()
