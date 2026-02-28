"""
Unified User Service with Polyglot Persistence
Primary: Supabase, Fallback: MongoDB
"""
import logging
import secrets
from typing import Optional, Tuple
from fastapi import HTTPException
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
        supabase_user = None
        mongo_user = None
        supabase_success = False
        mongo_success = False
        
        # Try Supabase first (primary)
        try:
            if self.supabase_service.is_available():
                supabase_user = await self.supabase_service.create_user(user_data)
                if supabase_user:
                    supabase_success = True
                    logger.info(f"User created in Supabase: {user_data.email}")
        except HTTPException:
            # Propagate 400 (duplicate email/username) to client
            raise
        except Exception as e:
            logger.error(f"Failed to create user in Supabase: {e}")
        
        # Always try MongoDB (fallback/redundancy)
        try:
            mongo_user = await self.mongo_service.create_user(user_data)
            if mongo_user:
                mongo_success = True
                logger.info(f"User created in MongoDB: {user_data.email}")
        except HTTPException:
            # Propagate 400 (duplicate email/username) to client
            raise
        except Exception as e:
            logger.error(f"Failed to create user in MongoDB: {e}")
        
        # Return primary (Supabase) if available, otherwise MongoDB
        if supabase_user:
            return supabase_user, True
        elif mongo_user:
            logger.warning(f"User created only in MongoDB (Supabase unavailable): {user_data.email}")
            return mongo_user, False
        else:
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
    
    async def update_profile(self, email: str, update_data: dict) -> Optional[UserInDB]:
        """Update profile in both databases; return updated user (primary from Supabase, else MongoDB)"""
        updated_user: Optional[UserInDB] = None
        
        # Update Supabase (primary)
        try:
            if self.supabase_service.is_available():
                updated_user = await self.supabase_service.update_profile(email, update_data)
        except Exception as e:
            logger.warning(f"Failed to update profile in Supabase: {e}")
        
        # Update MongoDB (fallback / dual-write)
        try:
            mongo_user = await self.mongo_service.update_profile(email, update_data)
            if mongo_user:
                updated_user = updated_user or mongo_user
        except Exception as e:
            logger.error(f"Failed to update profile in MongoDB: {e}")
        
        return updated_user
    
    async def create_google_user(self, user_data: dict) -> Tuple[Optional[UserInDB], bool]:
        """Create Google user in both databases"""
        supabase_user = None
        mongo_user = None
        
        # Try Supabase first
        try:
            if self.supabase_service.is_available():
                supabase_user = await self.supabase_service.create_google_user(user_data)
                if supabase_user:
                    logger.info(f"Google user created in Supabase: {user_data.get('email')}")
                else:
                    logger.warning(f"Supabase create_google_user returned None for {user_data.get('email')}")
        except Exception as e:
            logger.warning(f"Failed to create Google user in Supabase: {e}", exc_info=True)
        
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

    async def ensure_user_for_mfa(self, user: UserInDB) -> None:
        """
        Ensure a user row exists in at least one DB so MFA can be stored.
        Used when the current user is from Supabase Auth JWT but has no row in public.users/MongoDB yet.
        """
        existing = await self.get_user_by_email(user.email)
        if existing:
            return
        # Create minimal user with a random password (never used; Supabase Auth users sign in via Supabase)
        try:
            reg = UserRegistration(
                email=user.email,
                username=user.username or user.email.split("@")[0],
                name=user.name or user.email.split("@")[0],
                password=secrets.token_urlsafe(32),
            )
            await self.create_user(reg)
            logger.info(f"Created user row for MFA setup: {user.email}")
        except HTTPException as e:
            if e.status_code == 400 and ("already" in (e.detail or "").lower() or "taken" in (e.detail or "").lower()):
                return  # User already exists in one DB
            raise
        except Exception as e:
            logger.warning(f"ensure_user_for_mfa: {e}")

    async def ensure_user_in_mongo_for_mfa(self, email: str, name: str, username: str) -> bool:
        """Ensure user exists in MongoDB so MFA can be stored (e.g. when user exists only in Supabase)."""
        try:
            return await self.mongo_service.ensure_user_exists_for_mfa(email, name, username)
        except Exception as e:
            logger.warning(f"ensure_user_in_mongo_for_mfa: {e}")
            return False

    async def store_temp_mfa_secret(self, email: str, secret: str, recovery_codes: list) -> bool:
        """Store temporary MFA secret. Tries MongoDB first (upsert so it always succeeds), then Supabase."""
        mongo_ok = False
        supabase_ok = False
        try:
            mongo_ok = await self.mongo_service.store_temp_mfa_secret(email, secret, recovery_codes)
        except Exception as e:
            logger.warning(f"MongoDB store_temp_mfa_secret: {e}")
        try:
            if self.supabase_service.is_available():
                supabase_ok = await self.supabase_service.store_temp_mfa_secret(email, secret, recovery_codes)
        except Exception as e:
            logger.warning(f"Supabase store_temp_mfa_secret: {e}")
        return mongo_ok or supabase_ok

    async def enable_mfa(self, email: str) -> bool:
        """Enable MFA in both DBs."""
        supabase_ok = False
        mongo_ok = False
        try:
            if self.supabase_service.is_available():
                supabase_ok = await self.supabase_service.enable_mfa(email)
        except Exception as e:
            logger.warning(f"Supabase enable_mfa: {e}")
        try:
            mongo_ok = await self.mongo_service.enable_mfa(email)
        except Exception as e:
            logger.warning(f"MongoDB enable_mfa: {e}")
        return supabase_ok or mongo_ok

    async def disable_mfa(self, email: str) -> bool:
        """Disable MFA in both DBs (Supabase + MongoDB)."""
        supabase_ok = False
        mongo_ok = False
        try:
            if self.supabase_service.is_available():
                supabase_ok = await self.supabase_service.disable_mfa(email)
        except Exception as e:
            logger.warning(f"Supabase disable_mfa: {e}")
        try:
            mongo_ok = await self.mongo_service.disable_mfa(email)
        except Exception as e:
            logger.warning(f"MongoDB disable_mfa: {e}")
        return supabase_ok or mongo_ok

    async def update_recovery_codes(self, email: str, new_recovery_codes: list) -> bool:
        """Update recovery codes in both DBs."""
        supabase_ok = False
        mongo_ok = False
        try:
            if self.supabase_service.is_available():
                supabase_ok = await self.supabase_service.update_recovery_codes(email, new_recovery_codes)
        except Exception as e:
            logger.warning(f"Supabase update_recovery_codes: {e}")
        try:
            mongo_ok = await self.mongo_service.update_recovery_codes(email, new_recovery_codes)
        except Exception as e:
            logger.warning(f"MongoDB update_recovery_codes: {e}")
        return supabase_ok or mongo_ok

# Global instance
unified_user_service = UnifiedUserService()
