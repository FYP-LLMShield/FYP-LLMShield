"""
Supabase User Service - Primary database for user authentication
"""
import logging
from typing import Optional
from datetime import datetime
from passlib.context import CryptContext
from app.models.user import UserInDB, UserRegistration
from app.utils.supabase_client import supabase_service
from app.core.config import settings

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class SupabaseUserService:
    """Service for managing users in Supabase (Primary Database)"""
    
    def __init__(self):
        self.client = supabase_service.get_client()
    
    def is_available(self) -> bool:
        """Check if Supabase is available"""
        return supabase_service.is_available()
    
    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt"""
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            password = password_bytes[:72].decode('utf-8', errors='ignore')
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        if not hashed_password:
            return False
        return pwd_context.verify(plain_password, hashed_password)
    
    async def create_user(self, user_data: UserRegistration) -> Optional[UserInDB]:
        """Create a new user in Supabase"""
        try:
            if not self.is_available():
                logger.warning("Supabase not available, cannot create user")
                return None
            
            # Check if user already exists
            existing = await self.get_user_by_email(user_data.email)
            if existing:
                logger.warning(f"User with email {user_data.email} already exists in Supabase")
                return None
            
            # Check username
            existing_username = await self.get_user_by_username(user_data.username)
            if existing_username:
                logger.warning(f"Username {user_data.username} already taken in Supabase")
                return None
            
            # Hash password
            hashed_password = self.hash_password(user_data.password)
            
            # Generate verification token
            import secrets
            verification_token = secrets.token_urlsafe(32)
            
            # Create user document
            user_dict = {
                "email": user_data.email,
                "hashed_password": hashed_password,
                "username": user_data.username,
                "name": user_data.name,
                "is_verified": False,
                "is_active": True,
                "verification_token": verification_token,
                "reset_token": None,
                "reset_token_expires": None,
                "mfa_enabled": False,
                "mfa_secret": None,
                "recovery_codes": [],
                "trusted_devices": [],
                "mfa_setup_complete": False,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "last_login": None,
                "google_id": None,
                "profile_picture": None,
                "display_name": "",
                "subscription_id": None,
                "current_subscription_tier": "premium",
                "subscription_status": "active"
            }
            
            # Insert into Supabase
            result = self.client.table("users").insert(user_dict).execute()
            
            if result.data and len(result.data) > 0:
                user_data_dict = result.data[0]
                # Convert to UserInDB format (handles UUID->ObjectId, date parsing, etc.)
                user = self._convert_supabase_to_userindb(user_data_dict)
                if user:
                    logger.info(f"User created in Supabase: {user_data.email}")
                    return user
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating user in Supabase: {e}")
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
    
    async def update_profile(self, email: str, update_data: dict) -> bool:
        """Update user profile"""
        try:
            if not self.is_available():
                return False
            
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
            
            return result.data is not None and len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Error updating profile in Supabase: {e}")
            return False
    
    async def create_google_user(self, user_data: dict) -> Optional[UserInDB]:
        """Create a new Google OAuth user in Supabase"""
        try:
            if not self.is_available():
                return None
            
            # Check if user exists
            existing = await self.get_user_by_email(user_data["email"])
            if existing:
                return existing
            
            # Insert new user
            result = self.client.table("users").insert(user_data).execute()
            
            if result.data and len(result.data) > 0:
                user_data_dict = result.data[0]
                user_data_dict["_id"] = user_data_dict.get("id")
                return UserInDB(**user_data_dict)
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating Google user in Supabase: {e}")
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
