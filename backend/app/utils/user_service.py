import secrets
from datetime import datetime, timedelta
from typing import Optional, List
from passlib.context import CryptContext
from app.models.user import UserInDB, UserRegistration
from app.core.database import get_database
from app.utils.mfa import mfa_utils

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserService:
    def __init__(self):
        self.collection_name = "users"

    async def get_collection(self):
        """Get users collection"""
        db = await get_database()
        return db[self.collection_name]

    def hash_password(self, password: str) -> str:
        """Hash a password (bcrypt has 72-byte limit, so truncate if needed)"""
        # Bcrypt has a 72-byte limit (not character limit!)
        # Encode to bytes to check actual byte length, then truncate
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            # Truncate to 72 bytes, then decode back to string
            password = password_bytes[:72].decode('utf-8', errors='ignore')
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)

    async def verify_password(self, email: str, password: str) -> bool:
        """Verify password for a specific user - FIXED"""
        user = await self.get_user_by_email(email)
        if not user:
            return False
        return self.verify_password_plain(password, user.hashed_password)

    def verify_password_plain(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)


    async def create_user(self, user_data: UserRegistration) -> UserInDB:
        """Create a new user"""
        collection = await self.get_collection()
        
        # Check if user already exists
        existing_user = await collection.find_one({"email": user_data.email})
        if existing_user:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Hash password (truncation happens inside hash_password method)
        hashed_password = self.hash_password(user_data.password)
        
        # Generate verification token
        verification_token = secrets.token_urlsafe(32)

        # Check if username already exists
        existing_username = await collection.find_one({"username": user_data.username})
        if existing_username:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )

        # Create user document
        user_dict = {
            "email": user_data.email,
            "hashed_password": hashed_password,
            "username": user_data.username,
            "name": user_data.name,
            "is_verified": False,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "verification_token": verification_token,
            "reset_token": None,
            "reset_token_expires": None,
            # MFA fields
            "mfa_enabled": False,
            "mfa_secret": None,
            "recovery_codes": [],
            "trusted_devices": [],
            "mfa_setup_complete": False
        }

        # Insert user
        result = await collection.insert_one(user_dict)
        user_dict["_id"] = result.inserted_id

        # Create UserInDB instance
        user = UserInDB(**user_dict)
        
        # TODO: Send verification email here
        print(f"Verification token for {user_data.email}: {verification_token}")
        
        return user

    async def get_user_by_email(self, email: str) -> Optional[UserInDB]:
        """Get user by email"""
        collection = await self.get_collection()
        user_data = await collection.find_one({"email": email})
        
        if user_data:
            return UserInDB(**user_data)
        return None
    
    async def get_user_by_username(self, username: str) -> Optional[UserInDB]:
        """Get user by username"""
        collection = await self.get_collection()
        user_data = await collection.find_one({"username": username.lower()})
        
        if user_data:
            return UserInDB(**user_data)
        return None

    async def authenticate_user(self, username_or_email: str, password: str) -> Optional[UserInDB]:
        """Authenticate user with username or email and password - UPDATED"""
        # Try to get user by email first
        user = await self.get_user_by_email(username_or_email)
        
        # If not found by email, try by username
        if not user:
            user = await self.get_user_by_username(username_or_email)
        
        if not user or not user.is_active:
            return None
        if not self.verify_password_plain(password, user.hashed_password):
            return None
        return user

    async def verify_user_email(self, token: str) -> bool:
        """Verify user email with token"""
        collection = await self.get_collection()
        
        result = await collection.update_one(
            {"verification_token": token},
            {
                "$set": {
                    "is_verified": True,
                    "verification_token": None,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0

    async def update_user_last_login(self, email: str) -> bool:
        """Update user's last login time"""
        collection = await self.get_collection()
        
        result = await collection.update_one(
            {"email": email},
            {"$set": {"updated_at": datetime.utcnow()}}
        )
        
        return result.modified_count > 0

    async def request_password_reset(self, email: str) -> bool:
        """Generate and store password reset token"""
        collection = await self.get_collection()
        
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)  # 1 hour expiry
        
        result = await collection.update_one(
            {"email": email},
            {
                "$set": {
                    "reset_token": reset_token,
                    "reset_token_expires": expires_at,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # TODO: Send reset email here
        if result.modified_count > 0:
            print(f"Reset token for {email}: {reset_token}")
        
        return True  # Always return True for security (don't reveal if email exists)

    async def reset_password(self, token: str, new_password: str) -> bool:
        """Reset password using token"""
        collection = await self.get_collection()
        
        # Find user with valid token
        user_data = await collection.find_one({
            "reset_token": token,
            "reset_token_expires": {"$gt": datetime.utcnow()}
        })
        
        if not user_data:
            return False
        
        # Hash new password
        hashed_password = self.hash_password(new_password)
        
        # Update password and clear reset token
        result = await collection.update_one(
            {"_id": user_data["_id"]},
            {
                "$set": {
                    "hashed_password": hashed_password,
                    "reset_token": None,
                    "reset_token_expires": None,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0

    async def update_profile(self, email: str, update_data: dict) -> Optional[UserInDB]:
        """Update user profile"""
        collection = await self.get_collection()
        
        # Prepare update document
        update_doc = {"updated_at": datetime.utcnow()}
        
        # Handle username update
        if "username" in update_data and update_data["username"]:
            # Check if username is already taken by another user
            existing_username = await collection.find_one({
                "username": update_data["username"],
                "email": {"$ne": email}  # Exclude current user
            })
            if existing_username:
                from fastapi import HTTPException, status
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )
            update_doc["username"] = update_data["username"].strip().lower()
        
        # Handle name update
        if "name" in update_data and update_data["name"]:
            update_doc["name"] = update_data["name"].strip()
        
        # Handle password change
        if update_data.get("current_password") and update_data.get("new_password"):
            # Verify current password
            user = await self.get_user_by_email(email)
            # FIX: Use the synchronous method for direct password checking
            if not user or not self.verify_password_plain(update_data["current_password"], user.hashed_password):
                from fastapi import HTTPException, status
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is incorrect"
                )
            
            # Hash and set new password
            update_doc["hashed_password"] = self.hash_password(update_data["new_password"])
        
        # Update user
        result = await collection.update_one(
            {"email": email},
            {"$set": update_doc}
        )
        
        if result.modified_count > 0:
            return await self.get_user_by_email(email)
        
        return None
    # MFA Methods
    async def store_temp_mfa_secret(self, email: str, secret: str, recovery_codes: List[str]) -> bool:
        """Store temporary MFA secret during setup"""
        collection = await self.get_collection()
        
        # Hash recovery codes
        hashed_recovery_codes = [mfa_utils.hash_recovery_code(code) for code in recovery_codes]
        
        result = await collection.update_one(
            {"email": email},
            {
                "$set": {
                    "mfa_secret": secret,
                    "recovery_codes": hashed_recovery_codes,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0

    async def enable_mfa(self, email: str) -> bool:
        """Enable MFA for user"""
        collection = await self.get_collection()
        
        result = await collection.update_one(
            {"email": email, "mfa_secret": {"$ne": None}},
            {
                "$set": {
                    "mfa_enabled": True,
                    "mfa_setup_complete": True,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0

    async def disable_mfa(self, email: str) -> bool:
        """Disable MFA for user"""
        collection = await self.get_collection()
        
        result = await collection.update_one(
            {"email": email},
            {
                "$set": {
                    "mfa_enabled": False,
                    "mfa_secret": None,
                    "recovery_codes": [],
                    "trusted_devices": [],
                    "mfa_setup_complete": False,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0

    async def verify_and_consume_recovery_code(self, email: str, recovery_code: str) -> bool:
        """Verify and consume a recovery code"""
        collection = await self.get_collection()
        
        user = await self.get_user_by_email(email)
        if not user or not user.recovery_codes:
            return False
        
        # Check each recovery code
        for i, hashed_code in enumerate(user.recovery_codes):
            if mfa_utils.verify_recovery_code(recovery_code.upper(), hashed_code):
                # Remove used recovery code
                new_codes = user.recovery_codes.copy()
                new_codes.pop(i)
                
                await collection.update_one(
                    {"email": email},
                    {
                        "$set": {
                            "recovery_codes": new_codes,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                
                return True
        
        return False

    async def update_recovery_codes(self, email: str, new_recovery_codes: List[str]) -> bool:
        """Update recovery codes for user"""
        collection = await self.get_collection()
        
        # Hash new recovery codes
        hashed_codes = [mfa_utils.hash_recovery_code(code) for code in new_recovery_codes]
        
        result = await collection.update_one(
            {"email": email},
            {
                "$set": {
                    "recovery_codes": hashed_codes,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0

    async def create_trusted_device(self, email: str) -> Optional[str]:
        """Create trusted device token"""
        collection = await self.get_collection()
        
        # Generate trusted device token
        device_token = mfa_utils.generate_trusted_device_token()
        hashed_token = mfa_utils.hash_trusted_device_token(device_token)
        
        # Create device record
        device_record = {
            "token_hash": hashed_token,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(days=30)
        }
        
        result = await collection.update_one(
            {"email": email},
            {
                "$push": {"trusted_devices": device_record},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.modified_count > 0:
            return device_token
        
        return None

    async def check_trusted_device(self, email: str, device_token: str) -> bool:
        """Check if device is trusted"""
        if not device_token:
            return False
        
        user = await self.get_user_by_email(email)
        if not user or not user.trusted_devices:
            return False
        
        current_time = datetime.utcnow()
        
        # Check each trusted device
        for device in user.trusted_devices:
            if (device.get("expires_at", datetime.min) > current_time and 
                mfa_utils.verify_trusted_device_token(device_token, device.get("token_hash", ""))):
                return True
        
        return False

# Global instance
user_service = UserService()