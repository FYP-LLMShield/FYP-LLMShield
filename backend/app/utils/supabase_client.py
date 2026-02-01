"""
Supabase client for database and email operations
"""
import logging
from typing import Optional, Dict, Any
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger(__name__)

class SupabaseService:
    """Service for interacting with Supabase"""
    
    def __init__(self):
        self.client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Supabase client"""
        try:
            if not settings.SUPABASE_PROJECT_URL or not settings.SUPABASE_SERVICE_KEY:
                logger.warning("Supabase credentials not configured. Supabase features will be disabled.")
                return
            
            self.client = create_client(
                settings.SUPABASE_PROJECT_URL,
                settings.SUPABASE_SERVICE_KEY
            )
            logger.info("Supabase client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            self.client = None
    
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
        """Verify email verification token stored in Supabase"""
        try:
            if not self.is_available():
                return False
            
            # Query email_verifications table
            result = self.client.table("email_verifications").select("*").eq(
                "email", email
            ).eq("token", token).eq("used", False).execute()
            
            if result.data and len(result.data) > 0:
                verification = result.data[0]
                
                # Check if token is expired
                from datetime import datetime
                expires_at = datetime.fromisoformat(verification["expires_at"].replace("Z", "+00:00"))
                if datetime.now(expires_at.tzinfo) > expires_at:
                    logger.warning(f"Email verification token expired for {email}")
                    return False
                
                # Mark token as used
                self.client.table("email_verifications").update({
                    "used": True,
                    "verified_at": "now()"
                }).eq("id", verification["id"]).execute()
                
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
        """Create email verification token in Supabase"""
        try:
            if not self.is_available():
                return False
            
            from datetime import datetime, timedelta
            
            expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
            
            verification_data = {
                "email": email,
                "token": token,
                "expires_at": expires_at.isoformat(),
                "used": False,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Delete any existing tokens for this email
            self.client.table("email_verifications").delete().eq("email", email).execute()
            
            # Insert new token
            result = self.client.table("email_verifications").insert(verification_data).execute()
            
            return result.data is not None and len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Error creating verification token in Supabase: {e}")
            return False
    
    def get_client(self) -> Optional[Client]:
        """Get Supabase client instance"""
        return self.client

# Global instance
supabase_service = SupabaseService()
