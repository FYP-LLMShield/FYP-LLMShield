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

logger = logging.getLogger(__name__)


class PasswordResetService:
    """Service for handling password reset operations"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.reset_collection = self.db.password_reset_tokens
        self.users_collection = self.db.users

    async def create_reset_token(self, user_id: str, email: str) -> Optional[str]:
        """Create a password reset token for user"""
        try:
            # Clean up any existing reset tokens for this user
            await self.reset_collection.delete_many({"user_id": user_id})

            # Create new reset token
            token_obj, raw_token = PasswordResetToken.create_for_user(user_id, email)

            # Store in database
            result = await self.reset_collection.insert_one(token_obj.to_dict())

            if result.inserted_id:
                logger.info(f"Created password reset token for user {user_id}")
                return raw_token

            return None

        except Exception as e:
            logger.error(f"Failed to create reset token for user {user_id}: {e}")
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
                # Convert to model
                token_doc["id"] = str(token_doc["_id"])
                del token_doc["_id"]
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
            FRONTEND_URL = "http://localhost:3000"  # Updated to match frontend port
            reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"

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
        """Request password reset for a user by email"""
        try:
            # Check if user exists
            user = await self.users_collection.find_one({"email": email})
            if not user:
                # For security, don't reveal if email exists or not
                logger.info(f"Password reset requested for non-existent email: {email}")
                return True
            
            user_id = str(user["_id"])
            
            # Create reset token
            reset_token = await self.create_reset_token(user_id, email)
            if not reset_token:
                logger.error(f"Failed to create reset token for user {user_id}")
                return False
            
            # Send reset email
            email_sent = await self.send_reset_email(email, reset_token)
            if not email_sent:
                logger.error(f"Failed to send reset email to {email}")
                # Still return True for security (don't reveal if email exists)
            
            logger.info(f"Password reset requested for email: {email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to process password reset request for {email}: {e}")
            return True  # Return True for security

    async def reset_password(self, token: str, new_password: str) -> bool:
        """Reset password using a valid reset token"""
        try:
            # Verify the token
            token_obj = await self.verify_reset_token(token)
            if not token_obj:
                logger.warning("Invalid or expired reset token used")
                return False
            
            # Hash the new password
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            hashed_password = pwd_context.hash(new_password)
            
            # Update user's password
            result = await self.users_collection.update_one(
                {"_id": ObjectId(token_obj.user_id)},
                {"$set": {"hashed_password": hashed_password, "updated_at": datetime.utcnow()}}
            )
            
            if result.modified_count == 0:
                logger.error(f"Failed to update password for user {token_obj.user_id}")
                return False
            
            # Mark token as used
            await self.use_reset_token(token_obj.id)
            
            logger.info(f"Password reset successfully for user {token_obj.user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to reset password: {e}")
            return False

    async def _send_email_async(self, to_email: str, subject: str, message: str) -> bool:
        """Async wrapper for email sending"""
        try:
            import asyncio
            from app.utils.email_service import EmailService

            email_service = EmailService(self.db)
            # Run the sync email method in executor
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                email_service._send_email,
                to_email,
                subject,
                message
            )
        except Exception as e:
            logger.error(f"Failed to send email async: {e}")
            return False