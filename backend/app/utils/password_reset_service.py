"""
Password reset service for handling forgot password functionality
"""

import logging
from typing import Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.models.password_reset import PasswordResetToken, ForgotPasswordRequest, ResetPasswordRequest
from app.utils.email_service import EmailService
from app.core.database import get_database
from app.core.config import settings

logger = logging.getLogger(__name__)


class PasswordResetService:
    """Service for handling password reset operations"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.reset_collection = self.db.password_reset_tokens
        self.users_collection = self.db.users

    async def create_reset_token(self, user_id: str, email: str, source: str = "mongodb") -> Optional[str]:
        """Create a password reset token for user. source: 'mongodb' | 'supabase'."""
        try:
            # Clean up any existing reset tokens for this email (one active reset per email)
            await self.reset_collection.delete_many({"email": email})

            # Create new reset token
            token_obj, raw_token = PasswordResetToken.create_for_user(user_id, email, source=source)

            # Store in database
            result = await self.reset_collection.insert_one(token_obj.to_dict())

            if result.inserted_id:
                logger.info(f"Created password reset token for {email} (source={source})")
                return raw_token

            return None

        except Exception as e:
            logger.error(f"Failed to create reset token for {email}: {e}")
            return None

    async def verify_reset_token(self, raw_token: str) -> Optional[PasswordResetToken]:
        """Verify a password reset token"""
        try:
            # Find all non-used, non-expired tokens
            cursor = self.reset_collection.find({
                "used": False,
                "expires_at": {"$gt": datetime.utcnow()}
            })

            async for token_doc in cursor:
                # Convert to model (include source for Supabase vs MongoDB)
                token_doc["id"] = str(token_doc["_id"])
                del token_doc["_id"]
                if "source" not in token_doc:
                    token_doc["source"] = "mongodb"  # legacy tokens
                token = PasswordResetToken(**token_doc)

                # Check if this token matches
                if token.verify_token(raw_token):
                    logger.info(f"Valid reset token found for user {token.user_id}")
                    return token

            logger.warning(f"No valid reset token found for provided token")
            return None

        except Exception as e:
            logger.error(f"Failed to verify reset token: {e}")
            return None

    async def use_reset_token(self, token_id: str) -> bool:
        """Mark a reset token as used"""
        try:
            result = await self.reset_collection.update_one(
                {"_id": ObjectId(token_id)},
                {"$set": {"used": True}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to mark token as used: {e}")
            return False

    async def cleanup_expired_tokens(self) -> int:
        """Clean up expired reset tokens"""
        try:
            result = await self.reset_collection.delete_many({
                "expires_at": {"$lt": datetime.utcnow()}
            })
            logger.info(f"Cleaned up {result.deleted_count} expired reset tokens")
            return result.deleted_count
        except Exception as e:
            logger.error(f"Failed to cleanup expired tokens: {e}")
            return 0

    async def send_reset_email(self, email: str, reset_token: str) -> bool:
        """Send password reset email"""
        try:
            # Create reset URL for frontend
            frontend_url = (settings.FRONTEND_URL or "http://localhost:3000").rstrip("/")
            reset_url = f"{frontend_url}/reset-password?token={reset_token}"

            subject = "Reset Your Password - LLMShield"
            message = f"""
            Hello,

            You requested a password reset for your LLMShield account.

            Click the link below to reset your password:
            {reset_url}

            This link will expire in 1 hour.

            If you didn't request this password reset, please ignore this email.

            Best regards,
            LLMShield Team
            """

            # Use existing email service with proper async wrapper
            return await self._send_email_async(email, subject, message)

        except Exception as e:
            logger.error(f"Failed to send reset email to {email}: {e}")
            return False

    async def request_password_reset(self, email: str) -> bool:
        """Request password reset for a user by email. Checks MongoDB first, then Supabase."""
        try:
            logger.info(f"Password reset requested for email: {email}")
            # 1. Check MongoDB
            user_mongo = await self.users_collection.find_one({"email": email})
            if user_mongo:
                user_id = str(user_mongo["_id"])
                reset_token = await self.create_reset_token(user_id, email, source="mongodb")
                if not reset_token:
                    logger.error(f"Failed to create reset token for MongoDB user {email}")
                    return True
                email_sent = await self.send_reset_email(email, reset_token)
                if email_sent:
                    logger.info(f"Password reset email sent to {email} (MongoDB user)")
                else:
                    logger.error(f"Password reset requested but email send failed for {email} (check EMAIL_USERNAME/EMAIL_PASSWORD and SMTP)")
                return True

            # 2. Check Supabase (user may exist only there)
            try:
                from app.utils.supabase_client import supabase_service
                if supabase_service.is_available():
                    user_supabase = await supabase_service.get_user_by_email(email)
                    if user_supabase and user_supabase.id:
                        reset_token = await self.create_reset_token(
                            user_supabase.id, email, source="supabase"
                        )
                        if not reset_token:
                            logger.error(f"Failed to create reset token for Supabase user {email}")
                            return True
                        email_sent = await self.send_reset_email(email, reset_token)
                        if email_sent:
                            logger.info(f"Password reset email sent to {email} (Supabase user)")
                        else:
                            logger.error(f"Password reset requested but email send failed for {email} (check EMAIL_USERNAME/EMAIL_PASSWORD and SMTP)")
                        return True
            except Exception as e:
                logger.warning(f"Supabase lookup for password reset failed: {e}")

            # No user in MongoDB or Supabase
            logger.info(f"Password reset requested for non-existent email: {email}")
            return True  # Don't reveal whether email exists

        except Exception as e:
            logger.error(f"Failed to process password reset request for {email}: {e}")
            return True  # Return True for security

    async def reset_password(self, token: str, new_password: str) -> bool:
        """Reset password using a valid reset token. Updates MongoDB or Supabase by token source."""
        try:
            # Verify the token
            token_obj = await self.verify_reset_token(token)
            if not token_obj:
                logger.warning("Invalid or expired reset token used")
                return False

            from app.utils.password_hash import hash_password as _hash_password
            hashed_password = _hash_password(new_password)
            source = getattr(token_obj, "source", "mongodb")

            if source == "supabase":
                # Update Supabase user by email
                try:
                    from app.utils.supabase_client import supabase_service
                    if not supabase_service.is_available():
                        logger.error("Supabase not available for password reset")
                        return False
                    updated = await supabase_service.update_profile(
                        token_obj.email, {"hashed_password": hashed_password}
                    )
                    if not updated:
                        logger.error(f"Failed to update Supabase password for {token_obj.email}")
                        return False
                    logger.info(f"Password reset successfully for Supabase user {token_obj.email}")
                except Exception as e:
                    logger.error(f"Supabase password reset failed: {e}")
                    return False
            else:
                # Update MongoDB user by user_id
                result = await self.users_collection.update_one(
                    {"_id": ObjectId(token_obj.user_id)},
                    {"$set": {"hashed_password": hashed_password, "updated_at": datetime.utcnow()}}
                )
                if result.modified_count == 0:
                    logger.error(f"Failed to update password for MongoDB user {token_obj.user_id}")
                    return False
                logger.info(f"Password reset successfully for MongoDB user {token_obj.user_id}")

            # Mark token as used
            await self.use_reset_token(token_obj.id)
            return True

        except Exception as e:
            logger.error(f"Failed to reset password: {e}")
            return False

    async def _send_email_async(self, to_email: str, subject: str, message: str) -> bool:
        """Call EmailService._send_email (async) so the email is actually sent."""
        try:
            from app.utils.email_service import EmailService
            email_service = EmailService(self.db)
            return await email_service._send_email(to_email, subject, message)
        except Exception as e:
            logger.error(f"Failed to send email async: {e}")
            return False