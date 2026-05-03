"""
Supabase client for database and email operations
"""
from __future__ import annotations
import logging
import os
from typing import Optional, Dict, Any, TYPE_CHECKING
from app.core.config import settings

logger = logging.getLogger(__name__)


def _supabase_gotrue_origin() -> str:
    """Project origin only (no /auth/v1 suffix) for GoTrue REST calls."""
    raw = (settings.SUPABASE_PROJECT_URL or "").strip().rstrip("/")
    if not raw:
        return ""
    for suffix in ("/auth/v1", "/rest/v1"):
        if raw.endswith(suffix):
            raw = raw[: -len(suffix)].rstrip("/")
    return raw

if TYPE_CHECKING:
    from supabase import Client


class SupabaseService:
    """Service for interacting with Supabase"""
    
    def __init__(self):
        self.client: Optional[Client] = None
        self._init_error: Optional[str] = None  # Last error when init failed (for health/debug)
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Supabase client - clear proxy environment first."""
        saved = {}
        try:
            if not settings.SUPABASE_PROJECT_URL or not settings.SUPABASE_SERVICE_KEY:
                logger.info("Supabase not configured (optional); app will use MongoDB and other backends.")
                return

            # IMPORTANT: Clear proxy env BEFORE any imports to prevent supabase-py from using them
            proxy_keys = ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy")
            saved = {k: os.environ.pop(k, None) for k in proxy_keys}

            try:
                from supabase import create_client

                self.client = create_client(
                    settings.SUPABASE_PROJECT_URL,
                    settings.SUPABASE_SERVICE_KEY,
                )

                if self.client is not None:
                    logger.info("Supabase client initialized successfully")

            except Exception as e:
                self.client = None
                self._init_error = str(e)
                logger.error("Failed to initialize Supabase client: %s", e)

        except Exception as e:
            if self._init_error is None:
                self._init_error = str(e)
                logger.error("Failed to initialize Supabase client: %s", e)
            self.client = None
        finally:
            for k, v in saved.items():
                if v is not None:
                    os.environ[k] = v
    
    def get_init_error(self) -> Optional[str]:
        """Return the last initialization error message, if any."""
        return self._init_error
    
    def is_available(self) -> bool:
        """Check if Supabase is available"""
        return self.client is not None
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        message: str,
        html_content: Optional[str] = None
    ) -> bool:
        """
        Send email using Supabase Edge Functions or Database
        
        Note: Supabase doesn't have a direct email API, but we can:
        1. Use Supabase Edge Functions to trigger email sending
        2. Store email in database and use a webhook/trigger
        3. Use Supabase's built-in auth email templates
        
        For now, we'll use the database to log emails and optionally
        trigger an edge function if configured.
        """
        try:
            if not self.is_available():
                logger.warning("Supabase not available, cannot send email")
                return False
            
            from datetime import datetime
            
            # Store email in Supabase database (emails table)
            # This allows tracking and can trigger edge functions
            email_data = {
                "to_email": to_email,
                "subject": subject,
                "message": message,
                "html_content": html_content,
                "status": "pending",
                "created_at": datetime.utcnow().isoformat()
            }
            
            try:
                # Insert into emails table (you'll need to create this table in Supabase)
                result = self.client.table("emails").insert(email_data).execute()
                
                if result.data:
                    logger.info(f"Email queued in Supabase for {to_email}")
                    
                    # Optionally trigger an edge function for actual email sending
                    # This requires setting up an edge function in Supabase
                    try:
                        self.client.functions.invoke(
                            "send-email",
                            body={
                                "to": to_email,
                                "subject": subject,
                                "text": message,
                                "html": html_content or message
                            }
                        )
                        logger.info(f"Email sending triggered via Supabase Edge Function for {to_email}")
                    except Exception as edge_error:
                        # Edge function might not be set up, that's okay
                        logger.debug(f"Edge function not available: {edge_error}")
                    
                    return True
                else:
                    logger.error(f"Failed to queue email in Supabase for {to_email}")
                    return False
                    
            except Exception as db_error:
                # Table might not exist, log and continue
                logger.warning(f"Could not store email in Supabase (table may not exist): {db_error}")
                # Still return False so it falls back to SMTP
                return False
                
        except Exception as e:
            logger.error(f"Error sending email via Supabase: {e}")
            return False
    
    async def verify_email_token(self, email: str, token: str) -> bool:
        """Verify email verification token in users table"""
        try:
            if not self.is_available():
                return False

            # Query users table for matching email and verification token
            result = self.client.table("users").select("*").eq(
                "email", email
            ).eq("verification_token", token).execute()

            if result.data and len(result.data) > 0:
                user = result.data[0]

                # Mark user as verified
                self.client.table("users").update({
                    "is_verified": True,
                    "verification_token": None
                }).eq("id", user["id"]).execute()

                logger.info(f"Email verified for {email}")
                return True

            return False

        except Exception as e:
            logger.error(f"Error verifying email token in Supabase: {e}")
            return False
    
    async def create_verification_token(
        self,
        email: str,
        token: str,
        expires_in_minutes: int = 10
    ) -> bool:
        """Create email verification token in users table"""
        try:
            if not self.is_available():
                return False

            # Update users table with verification token
            result = self.client.table("users").update({
                "verification_token": token
            }).eq("email", email).execute()

            return result.data is not None and len(result.data) > 0

        except Exception as e:
            logger.error(f"Error creating verification token in Supabase: {e}")
            return False
    
    def get_client(self) -> Optional["Client"]:
        """Get Supabase client instance"""
        return self.client

    async def send_password_recovery_email(self, email: str, redirect_to: str) -> bool:
        """
        Trigger Supabase GoTrue to send the official password recovery email.
        Uses the project's Auth email settings (no app-level SMTP required).
        """
        origin = _supabase_gotrue_origin()
        apikey = settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_KEY
        if not origin or not apikey:
            logger.warning(
                "Supabase recovery email skipped: set SUPABASE_PROJECT_URL and SUPABASE_ANON_KEY (or SERVICE_KEY)"
            )
            return False
        url = f"{origin}/auth/v1/recover"
        payload: Dict[str, Any] = {"email": (email or "").strip().lower()}
        rt = (redirect_to or "").strip()
        if rt:
            payload["redirect_to"] = rt
        try:
            import httpx

            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    url,
                    headers={
                        "apikey": apikey,
                        "Authorization": f"Bearer {apikey}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            if resp.status_code >= 400:
                logger.warning(
                    "GoTrue /recover returned %s for %s: %s",
                    resp.status_code,
                    payload["email"],
                    (resp.text or "")[:400],
                )
                return False
            logger.info("GoTrue recovery email requested for %s", payload["email"])
            return True
        except Exception as e:
            logger.error("GoTrue /recover request failed: %s", e)
            return False


# Global instance
supabase_service = SupabaseService()
