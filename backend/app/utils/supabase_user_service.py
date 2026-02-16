"""
Supabase User Service - Primary database for user authentication
"""
import logging
from typing import Optional
from datetime import datetime
from fastapi import HTTPException, status
from app.models.user import UserInDB, UserRegistration
from app.utils.supabase_client import supabase_service
from app.utils.password_hash import hash_password as _hash_password, verify_password as _verify_password
from app.core.config import settings

logger = logging.getLogger(__name__)


class SupabaseUserService:
    """Service for managing users in Supabase (Primary Database)"""
    
    def __init__(self):
        self.client = supabase_service.get_client()
    
    def is_available(self) -> bool:
        """Check if Supabase is available"""
        return supabase_service.is_available()
    
    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt (72-byte safe)."""
        return _hash_password(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return _verify_password(plain_password, hashed_password)
    
    async def create_user(self, user_data: UserRegistration) -> Optional[UserInDB]:
        """Create a new user in Supabase"""
        try:
            if not self.is_available():
                logger.warning("Supabase not available, cannot create user")
                return None
            
            # Check if user already exists (raise 400 for evaluation-friendly errors)
            existing = await self.get_user_by_email(user_data.email)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            
            # Check username
            existing_username = await self.get_user_by_username(user_data.username)
            if existing_username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )
            
            # Hash password
            hashed_password = self.hash_password(user_data.password)
            
            # Generate verification token
            import secrets
            verification_token = secrets.token_urlsafe(32)
            
            # Payload: only required and simple fields. Let DB set created_at/updated_at and array defaults
            # (avoids timestamp format issues and TEXT[] vs jsonb for recovery_codes/trusted_devices)
            user_dict = {
                "email": user_data.email,
                "hashed_password": hashed_password,
                "username": user_data.username,
                "name": user_data.name,
                "is_verified": False,
                "is_active": True,
                "verification_token": verification_token,
                "mfa_enabled": False,
                "mfa_setup_complete": False,
                "display_name": "",
                "current_subscription_tier": "premium",
                "subscription_status": "active",
            }
            # Insert into Supabase (DB defaults: created_at, updated_at, recovery_codes, trusted_devices)
            result = self.client.table("users").insert(user_dict).execute()
            
            if result.data and len(result.data) > 0:
                user_data_dict = result.data[0]
                user = self._convert_supabase_to_userindb(user_data_dict)
                if user:
                    logger.info(f"User created in Supabase: {user_data.email}")
                    return user
            
            # Insert may have succeeded but returned no rows; try to fetch
            logger.warning("Supabase insert returned no data; checking if user exists.")
            fetched = await self.get_user_by_email(user_data.email)
            if fetched:
                return fetched
            return None
            
        except Exception as e:
            # Log full error so we can see PostgREST/Supabase message (e.g. column type, RLS)
            err_msg = str(e)
            err_detail = getattr(e, "details", None) or getattr(e, "message", None)
            if err_detail and err_detail != err_msg:
                logger.error(f"Error creating user in Supabase: {e} (details: {err_detail})", exc_info=True)
            else:
                logger.error(f"Error creating user in Supabase: {e}", exc_info=True)
            return None
    
    def _convert_supabase_to_userindb(self, user_data: dict) -> Optional[UserInDB]:
        """
        Convert Supabase user data to UserInDB format
        Handles UUID -> ObjectId conversion, date parsing, etc.
        """
        try:
            from bson import ObjectId
            import hashlib
            
            # Parse datetime strings to datetime objects
            def parse_datetime(value):
                if value is None:
                    return None
                if isinstance(value, str):
                    try:
                        if 'T' in value:
                            if value.endswith('Z'):
                                value = value[:-1] + '+00:00'
                            return datetime.fromisoformat(value.replace('Z', '+00:00'))
                        return datetime.fromisoformat(value)
                    except (ValueError, AttributeError):
                        return None
                return value
            
            # Convert dates
            converted_data = {
                "created_at": parse_datetime(user_data.get("created_at")),
                "updated_at": parse_datetime(user_data.get("updated_at")),
                "last_login": parse_datetime(user_data.get("last_login")),
                "reset_token_expires": parse_datetime(user_data.get("reset_token_expires")),
            }
            
            # Copy all other fields
            for key, value in user_data.items():
                if key not in ["id", "created_at", "updated_at", "last_login", "reset_token_expires"]:
                    converted_data[key] = value
            
            # Handle ID conversion - create deterministic ObjectId from UUID
            supabase_id = user_data.get("id")
            if supabase_id:
                # Create a deterministic ObjectId from UUID hash
                uuid_hash = hashlib.md5(supabase_id.encode()).hexdigest()[:24]
                try:
                    converted_data["_id"] = ObjectId(uuid_hash)
                except:
                    converted_data["_id"] = ObjectId()
            else:
                converted_data["_id"] = ObjectId()
            
            # Ensure required fields have defaults
            if "recovery_codes" not in converted_data or converted_data["recovery_codes"] is None:
                converted_data["recovery_codes"] = []
            if "trusted_devices" not in converted_data or converted_data["trusted_devices"] is None:
                converted_data["trusted_devices"] = []
            
            # Convert arrays if they're strings
            if isinstance(converted_data.get("recovery_codes"), str):
                converted_data["recovery_codes"] = []
            if isinstance(converted_data.get("trusted_devices"), str):
                converted_data["trusted_devices"] = []
            
            return UserInDB(**converted_data)
            
        except Exception as e:
            logger.error(f"Error converting Supabase user to UserInDB: {e}")
            logger.error(f"User data keys: {list(user_data.keys()) if user_data else 'None'}")
            return None
    
    async def get_user_by_email(self, email: str) -> Optional[UserInDB]:
        """Get user by email from Supabase"""
        try:
            if not self.is_available():
                return None
            
            result = self.client.table("users").select("*").eq("email", email).execute()
            
            if result.data and len(result.data) > 0:
                user_data = result.data[0]
                return self._convert_supabase_to_userindb(user_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by email from Supabase: {e}")
            return None
    
    async def get_user_by_username(self, username: str) -> Optional[UserInDB]:
        """Get user by username from Supabase"""
        try:
            if not self.is_available():
                return None
            
            result = self.client.table("users").select("*").eq("username", username.lower()).execute()
            
            if result.data and len(result.data) > 0:
                user_data = result.data[0]
                return self._convert_supabase_to_userindb(user_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by username from Supabase: {e}")
            return None
    
    async def authenticate_user(self, username_or_email: str, password: str) -> Optional[UserInDB]:
        """Authenticate user with username/email and password"""
        try:
            # Try email first
            user = await self.get_user_by_email(username_or_email)
            
            # If not found, try username
            if not user:
                user = await self.get_user_by_username(username_or_email)
            
            if not user or not user.is_active:
                return None
            
            if not self.verify_password(password, user.hashed_password):
                return None
            
            # Update last login
            await self.update_user_last_login(user.email)
            
            return user
            
        except Exception as e:
            logger.error(f"Error authenticating user in Supabase: {e}")
            return None
    
    async def update_user_last_login(self, email: str) -> bool:
        """Update user's last login time"""
        try:
            if not self.is_available():
                return False
            
            self.client.table("users").update({
                "last_login": datetime.utcnow().isoformat()
            }).eq("email", email).execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating last login in Supabase: {e}")
            return False
    
    async def verify_user_email(self, token: str) -> bool:
        """Verify user email with token"""
        try:
            if not self.is_available():
                return False
            
            result = self.client.table("users").update({
                "is_verified": True,
                "verification_token": None,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("verification_token", token).execute()
            
            return result.data is not None and len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Error verifying email in Supabase: {e}")
            return False
    
    async def update_profile(self, email: str, update_data: dict) -> Optional[UserInDB]:
        """Update user profile and return updated user"""
        try:
            if not self.is_available():
                return None
            
            # Remove None values and convert datetime to ISO strings
            clean_update = {}
            for key, value in update_data.items():
                if value is not None:
                    if isinstance(value, datetime):
                        clean_update[key] = value.isoformat()
                    else:
                        clean_update[key] = value
            
            clean_update["updated_at"] = datetime.utcnow().isoformat()
            
            result = self.client.table("users").update(clean_update).eq("email", email).execute()
            
            if result.data and len(result.data) > 0:
                return self._convert_supabase_to_userindb(result.data[0])
            return None
            
        except Exception as e:
            logger.error(f"Error updating profile in Supabase: {e}")
            return None
    
    async def create_google_user(self, user_data: dict) -> Optional[UserInDB]:
        """Create a new Google OAuth user in Supabase"""
        try:
            if not self.is_available():
                logger.warning("Supabase not available, skipping Google user create")
                return None
            
            # Check if user exists
            existing = await self.get_user_by_email(user_data["email"])
            if existing:
                return existing
            
            # Build insert payload: only non-None values so Postgres/Supabase accept the insert
            payload = {
                "email": user_data["email"],
                "username": user_data["username"],
                "name": user_data.get("name") or "User",
                "display_name": user_data.get("display_name") or "",
                "is_verified": user_data.get("is_verified", True),
                "is_active": user_data.get("is_active", True),
                "mfa_enabled": user_data.get("mfa_enabled", False),
                "mfa_setup_complete": user_data.get("mfa_setup_complete", False),
                "recovery_codes": user_data.get("recovery_codes") if isinstance(user_data.get("recovery_codes"), list) else [],
                "trusted_devices": user_data.get("trusted_devices") if isinstance(user_data.get("trusted_devices"), list) else [],
                "current_subscription_tier": user_data.get("current_subscription_tier") or "premium",
                "subscription_status": user_data.get("subscription_status") or "active",
                "created_at": user_data.get("created_at") or datetime.utcnow().isoformat(),
                "updated_at": user_data.get("updated_at") or datetime.utcnow().isoformat(),
            }
            # Optional fields - only add if present (avoid sending None if DB rejects it)
            if user_data.get("google_id") is not None:
                payload["google_id"] = user_data["google_id"]
            if user_data.get("profile_picture") is not None:
                payload["profile_picture"] = user_data["profile_picture"]
            if user_data.get("last_login") is not None:
                payload["last_login"] = user_data["last_login"]
            # Omit hashed_password for Google users so column stays NULL (some clients reject explicit null)

            result = self.client.table("users").insert(payload).execute()
            
            if result.data and len(result.data) > 0:
                user_data_dict = result.data[0]
                user_data_dict["_id"] = user_data_dict.get("id")
                logger.info(f"Google user created in Supabase: {user_data['email']}")
                return UserInDB(**user_data_dict)
            fetched = await self.get_user_by_email(user_data["email"])
            if fetched:
                return fetched
            return None
            
        except Exception as e:
            logger.error(f"Error creating Google user in Supabase: {e}", exc_info=True)
            return None
    
    async def update_google_user(self, email: str, update_data: dict) -> bool:
        """Update Google user information"""
        try:
            if not self.is_available():
                return False
            
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            result = self.client.table("users").update(update_data).eq("email", email).execute()
            
            return result.data is not None and len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Error updating Google user in Supabase: {e}")
            return False

    async def store_temp_mfa_secret(self, email: str, secret: str, recovery_codes: list) -> bool:
        """Store temporary MFA secret during setup (so complete step can find it)."""
        try:
            if not self.is_available():
                return False
            from app.utils.mfa import mfa_utils
            hashed_recovery_codes = [mfa_utils.hash_recovery_code(code) for code in recovery_codes]
            result = self.client.table("users").update({
                "mfa_secret": secret,
                "recovery_codes": hashed_recovery_codes,
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("email", email).execute()
            return result.data is not None and len(result.data) > 0
        except Exception as e:
            logger.error(f"Error storing temp MFA secret in Supabase: {e}")
            return False

    async def enable_mfa(self, email: str) -> bool:
        """Enable MFA for user after TOTP verification."""
        try:
            if not self.is_available():
                return False
            result = self.client.table("users").update({
                "mfa_enabled": True,
                "mfa_setup_complete": True,
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("email", email).execute()
            return result.data is not None and len(result.data) > 0
        except Exception as e:
            logger.error(f"Error enabling MFA in Supabase: {e}")
            return False

    async def disable_mfa(self, email: str) -> bool:
        """Disable MFA for user (clear secret and recovery codes)."""
        try:
            if not self.is_available():
                return False
            result = self.client.table("users").update({
                "mfa_enabled": False,
                "mfa_setup_complete": False,
                "mfa_secret": None,
                "recovery_codes": [],
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("email", email).execute()
            return result.data is not None and len(result.data) > 0
        except Exception as e:
            logger.error(f"Error disabling MFA in Supabase: {e}")
            return False

    async def update_recovery_codes(self, email: str, new_recovery_codes: list) -> bool:
        """Update recovery codes for user (hashed)."""
        try:
            if not self.is_available():
                return False
            from app.utils.mfa import mfa_utils
            hashed_codes = [mfa_utils.hash_recovery_code(code) for code in new_recovery_codes]
            result = self.client.table("users").update({
                "recovery_codes": hashed_codes,
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("email", email).execute()
            return result.data is not None and len(result.data) > 0
        except Exception as e:
            logger.error(f"Error updating recovery codes in Supabase: {e}")
            return False
