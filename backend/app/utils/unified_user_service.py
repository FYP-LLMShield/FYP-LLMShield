"""
Unified User Service - Supabase only (no MongoDB fallback)
"""
import asyncio
import logging
import secrets
from typing import Optional, Tuple
from fastapi import HTTPException, status
from app.models.user import UserInDB, UserRegistration
from app.utils.supabase_user_service import SupabaseUserService

logger = logging.getLogger(__name__)


class UnifiedUserService:
    """
    User service using only Supabase for user storage.
    No MongoDB fallback.
    """

    def __init__(self):
        self.supabase_service = SupabaseUserService()

    async def create_user(self, user_data: UserRegistration) -> Tuple[Optional[UserInDB], bool]:
        """Create user in Supabase only."""
        if not self.supabase_service.is_available():
            logger.error("Supabase not available; cannot create user")
            return None, False
        try:
            user = await self.supabase_service.create_user(user_data)
            if user:
                logger.info(f"User created in Supabase: {user_data.email}")
                return user, True
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create user in Supabase: {e}")
        return None, False

    async def get_user_by_email(self, email: str) -> Optional[UserInDB]:
        """Get user by email from Supabase only."""
        if not self.supabase_service.is_available():
            return None
        try:
            return await self.supabase_service.get_user_by_email(email)
        except Exception as e:
            logger.error(f"Error getting user from Supabase: {e}")
            return None

    async def get_user_by_username(self, username: str) -> Optional[UserInDB]:
        """Get user by username from Supabase only."""
        if not self.supabase_service.is_available():
            return None
        try:
            return await self.supabase_service.get_user_by_username(username)
        except Exception as e:
            logger.error(f"Error getting user from Supabase: {e}")
            return None

    async def authenticate_user(self, username_or_email: str, password: str) -> Optional[UserInDB]:
        """Authenticate user via Supabase only."""
        if not self.supabase_service.is_available():
            return None
        try:
            return await self.supabase_service.authenticate_user(username_or_email, password)
        except Exception as e:
            logger.error(f"Error authenticating in Supabase: {e}")
            return None

    async def verify_user_email(self, token: str) -> bool:
        """Verify user email in Supabase only."""
        if not self.supabase_service.is_available():
            return False
        try:
            return await self.supabase_service.verify_user_email(token)
        except Exception as e:
            logger.error(f"Supabase email verification failed: {e}")
            return False

    async def update_user_last_login(self, email: str) -> bool:
        """Update last login in Supabase only."""
        if not self.supabase_service.is_available():
            return False
        try:
            return await self.supabase_service.update_user_last_login(email)
        except Exception as e:
            logger.error(f"Failed to update last login in Supabase: {e}")
            return False

    async def update_profile(self, email: str, update_data: dict) -> Optional[UserInDB]:
        """Update profile in Supabase only."""
        if not self.supabase_service.is_available():
            return None
        try:
            return await self.supabase_service.update_profile(email, update_data)
        except Exception as e:
            logger.error(f"Failed to update profile in Supabase: {e}")
            return None

    async def create_google_user(self, user_data: dict) -> Tuple[Optional[UserInDB], bool]:
        """Create Google user in Supabase only."""
        if not self.supabase_service.is_available():
            return None, False
        try:
            user = await self.supabase_service.create_google_user(user_data)
            if user:
                logger.info(f"Google user created in Supabase: {user_data.get('email')}")
                return user, True
        except Exception as e:
            logger.error(f"Failed to create Google user in Supabase: {e}", exc_info=True)
        return None, False

    async def create_github_user(self, user_data: dict) -> Tuple[Optional[UserInDB], bool]:
        """Create GitHub OAuth user in Supabase public.users only."""
        if not self.supabase_service.is_available():
            return None, False
        try:
            user = await self.supabase_service.create_github_user(user_data)
            if user:
                logger.info("GitHub user created in Supabase: %s", user_data.get("email"))
                return user, True
        except Exception as e:
            logger.error("Failed to create GitHub user in Supabase: %s", e, exc_info=True)
        return None, False

    async def ensure_supabase_auth_for_google(
        self,
        email: str,
        name: str,
        google_sub: Optional[str] = None,
    ) -> None:
        """Mirror Google sign-in into auth.users (non-fatal if it fails)."""
        if not self.supabase_service.is_available():
            return
        try:
            await asyncio.to_thread(
                self.supabase_service.ensure_supabase_auth_user_for_google,
                email,
                name,
                google_sub,
            )
        except Exception as e:
            logger.warning("ensure_supabase_auth_for_google: %s", e)

    async def ensure_supabase_auth_for_backend_register(
        self,
        email: str,
        password: str,
        name: str,
        username: str,
    ) -> None:
        """Create auth.users with same id as public.users after /auth/register."""
        if not self.supabase_service.is_available():
            return
        try:
            uuid_str = await asyncio.to_thread(
                self.supabase_service.get_public_user_id_string_by_email,
                email,
            )
            if not uuid_str:
                return
            await asyncio.to_thread(
                self.supabase_service.ensure_supabase_auth_user_backend_register,
                uuid_str,
                email,
                password,
                name,
                username,
            )
        except Exception as e:
            logger.warning("ensure_supabase_auth_for_backend_register: %s", e)

    async def sync_public_user_from_supabase_auth(
        self,
        auth_user_id: str,
        email: str,
        name: str,
        username: str,
        email_confirmed: bool,
    ) -> Optional[UserInDB]:
        """Upsert public.users from Supabase Auth session."""
        if not self.supabase_service.is_available():
            return None
        try:
            return await self.supabase_service.sync_public_user_from_supabase_auth(
                auth_user_id,
                email,
                name,
                username,
                email_confirmed,
            )
        except Exception as e:
            logger.error("sync_public_user_from_supabase_auth: %s", e, exc_info=True)
            return None

    async def update_google_user(self, email: str, update_data: dict) -> bool:
        """Update Google user in Supabase only."""
        if not self.supabase_service.is_available():
            return False
        try:
            return await self.supabase_service.update_google_user(email, update_data)
        except Exception as e:
            logger.error(f"Failed to update Google user in Supabase: {e}")
            return False

    async def ensure_user_for_mfa(self, user: UserInDB) -> None:
        """Ensure a user row exists in Supabase for MFA."""
        existing = await self.get_user_by_email(user.email)
        if existing:
            return
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
                return
            raise
        except Exception as e:
            logger.warning(f"ensure_user_for_mfa: {e}")

    async def ensure_user_in_mongo_for_mfa(self, email: str, name: str, username: str) -> bool:
        """No-op when using Supabase only."""
        return False

    async def store_temp_mfa_secret(self, email: str, secret: str, recovery_codes: list) -> bool:
        if not self.supabase_service.is_available():
            return False
        try:
            return await self.supabase_service.store_temp_mfa_secret(email, secret, recovery_codes)
        except Exception as e:
            logger.error(f"Supabase store_temp_mfa_secret: {e}")
            return False

    async def enable_mfa(self, email: str) -> bool:
        if not self.supabase_service.is_available():
            return False
        try:
            return await self.supabase_service.enable_mfa(email)
        except Exception as e:
            logger.error(f"Supabase enable_mfa: {e}")
            return False

    async def finalize_mfa_setup(self, email: str, secret: str, recovery_codes: list) -> bool:
        if not self.supabase_service.is_available():
            return False
        try:
            return await self.supabase_service.finalize_mfa_setup(email, secret, recovery_codes)
        except Exception as e:
            logger.error(f"Supabase finalize_mfa_setup: {e}")
            return False

    async def disable_mfa(self, email: str) -> bool:
        if not self.supabase_service.is_available():
            return False
        try:
            return await self.supabase_service.disable_mfa(email)
        except Exception as e:
            logger.error(f"Supabase disable_mfa: {e}")
            return False

    async def update_recovery_codes(self, email: str, new_recovery_codes: list) -> bool:
        if not self.supabase_service.is_available():
            return False
        try:
            return await self.supabase_service.update_recovery_codes(email, new_recovery_codes)
        except Exception as e:
            logger.error(f"Supabase update_recovery_codes: {e}")
            return False


# Global instance
unified_user_service = UnifiedUserService()
