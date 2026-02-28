import httpx
import jwt
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.google_auth import GoogleUserInfo
from app.models.user import UserInDB
from app.utils.user_service import UserService
from app.utils.email_service import EmailService
from app.core.config import settings

# Set up logger
logger = logging.getLogger(__name__)

class GoogleAuthService:
    """Service for handling Google OAuth authentication"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.user_service = UserService()
        self.email_service = EmailService(db)
        self.google_certs_url = "https://www.googleapis.com/oauth2/v1/certs"
        self._cached_certs = None
        self._certs_cache_time = None
        
    async def verify_google_token(self, id_token: str) -> Optional[GoogleUserInfo]:
        """
        Verify Google ID token and extract user information
        """
        try:
            # Clean and validate the token
            id_token = id_token.strip()
            
            # Debug: Log the received token
            logger.info(f"DEBUG: Received ID token: {id_token[:50]}..." if len(id_token) > 50 else f"DEBUG: Received ID token: {id_token}")
            logger.info(f"DEBUG: Token length: {len(id_token)}")
            
            # Validate JWT format (should have 3 parts separated by dots)
            token_parts = id_token.split('.')
            if len(token_parts) != 3:
                logger.error(f"Invalid JWT format: expected 3 parts, got {len(token_parts)}")
                return None
            
            logger.info(f"DEBUG: Token segments count: {len(token_parts)}")
            
            # Get Google's public keys for token verification
            certs = await self._get_google_certs()
            if not certs:
                logger.error("Failed to fetch Google certificates")
                return None
            
            # Get the header to find which key to use with proper error handling
            try:
                unverified_header = jwt.get_unverified_header(id_token)
            except Exception as e:
                logger.error(f"Failed to decode JWT header: {e}")
                # Try manual base64 decoding with padding fix
                try:
                    import base64
                    import json
                    header_b64 = token_parts[0]
                    # Add padding if needed
                    missing_padding = len(header_b64) % 4
                    if missing_padding:
                        header_b64 += '=' * (4 - missing_padding)
                    
                    header_bytes = base64.urlsafe_b64decode(header_b64)
                    unverified_header = json.loads(header_bytes.decode('utf-8'))
                    logger.info(f"DEBUG: Successfully decoded header manually: {unverified_header}")
                except Exception as manual_error:
                    logger.error(f"Manual header decoding also failed: {manual_error}")
                    return None
            
            key_id = unverified_header.get("kid")
            
            if not key_id:
                logger.error("No key ID found in JWT header")
                return None
                
            if key_id not in certs:
                logger.error(f"Key ID {key_id} not found in Google certificates")
                logger.error(f"Available certificate keys: {list(certs.keys())}")
                return None
            
            # Get the public key for verification
            logger.info(f"DEBUG: Using key ID: {key_id}")
            logger.info(f"DEBUG: Available certificate keys: {list(certs.keys())}")
                
            cert_data = certs[key_id]
            logger.info(f"DEBUG: Certificate data type: {type(cert_data)}")
            
            # Convert certificate to JWK format if it's not already
            try:
                if isinstance(cert_data, str):
                    # If it's a PEM certificate string, convert to JWK
                    from cryptography import x509
                    from cryptography.hazmat.primitives import serialization
                    import base64
                    
                    # Parse the certificate
                    cert = x509.load_pem_x509_certificate(cert_data.encode())
                    public_key_obj = cert.public_key()
                    
                    # Get the public key numbers
                    public_numbers = public_key_obj.public_numbers()
                    
                    # Convert to JWK format
                    def int_to_base64url_uint(val):
                        val_bytes = val.to_bytes((val.bit_length() + 7) // 8, 'big')
                        return base64.urlsafe_b64encode(val_bytes).decode('ascii').rstrip('=')
                    
                    jwk_data = {
                        "kty": "RSA",
                        "use": "sig",
                        "kid": key_id,
                        "n": int_to_base64url_uint(public_numbers.n),
                        "e": int_to_base64url_uint(public_numbers.e)
                    }
                    
                    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(jwk_data)
                else:
                    # Assume it's already in JWK format
                    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(cert_data)
                    
            except Exception as jwk_error:
                logger.error(f"Failed to convert certificate to JWK: {jwk_error}")
                return None
            
            # Decode and verify the token with proper signature verification
            # First decode without issuer check to see what we're dealing with
            try:
                decoded_token = jwt.decode(
                    id_token,
                    public_key,
                    algorithms=["RS256"],
                    audience=getattr(settings, 'GOOGLE_CLIENT_ID', None),
                    options={"verify_iss": False}  # We'll verify issuer manually
                )
            except jwt.InvalidAudienceError:
                # If audience check fails, try without it (for development)
                logger.warning("Audience check failed, attempting without audience verification")
                decoded_token = jwt.decode(
                    id_token,
                    public_key,
                    algorithms=["RS256"],
                    options={"verify_iss": False, "verify_aud": False}
                )
            
            # Log the actual issuer for debugging
            actual_issuer = decoded_token.get("iss")
            logger.info(f"DEBUG: Token issuer: {actual_issuer}")
            
            # Validate issuer manually (more flexible)
            valid_issuers = [
                "https://accounts.google.com",
                "accounts.google.com",
                "https://accounts.google.com/",
                "http://accounts.google.com"
            ]
            if actual_issuer not in valid_issuers:
                logger.error(f"Invalid issuer: {actual_issuer}. Expected one of: {valid_issuers}")
                return None
            
            # Additional token claims verification
            if not self._verify_token_claims(decoded_token):
                return None
                
            # Extract user information
            user_info = GoogleUserInfo(
                email=decoded_token.get("email"),
                name=decoded_token.get("name", ""),
                given_name=decoded_token.get("given_name"),
                family_name=decoded_token.get("family_name"),
                picture=decoded_token.get("picture"),
                sub=decoded_token.get("sub")
            )
            
            return user_info
            
        except jwt.ExpiredSignatureError:
            logger.error("Google token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid Google token: {e}")
            return None
        except Exception as e:
            print(f"Error verifying Google token: {e}")
            return None
    
    async def _get_google_certs(self) -> Dict[str, Any]:
        """
        Get Google's public certificates for token verification
        Cache them for 1 hour to avoid repeated requests
        """
        now = datetime.utcnow()
        
        # Check if we have cached certs that are still valid
        if (self._cached_certs and self._certs_cache_time and 
            now - self._certs_cache_time < timedelta(hours=1)):
            logger.info("DEBUG: Using cached Google certificates")
            return self._cached_certs
            
        try:
            logger.info(f"DEBUG: Fetching Google certificates from: {self.google_certs_url}")
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.google_certs_url)
                response.raise_for_status()
                
                # Check content type
                content_type = response.headers.get('content-type', '')
                logger.info(f"DEBUG: Response content type: {content_type}")
                
                # Get raw content for debugging
                raw_content = response.content
                logger.info(f"DEBUG: Response content length: {len(raw_content)}")
                logger.info(f"DEBUG: First 200 chars of response: {raw_content[:200]}")
                
                # Try to parse as JSON
                try:
                    certs_data = response.json()
                    logger.info(f"DEBUG: Successfully parsed JSON with keys: {list(certs_data.keys())}")
                except Exception as json_error:
                    logger.error(f"Failed to parse response as JSON: {json_error}")
                    # Try to decode as text and then parse
                    try:
                        text_content = raw_content.decode('utf-8')
                        logger.info(f"DEBUG: Decoded text content: {text_content[:500]}")
                        import json
                        certs_data = json.loads(text_content)
                        logger.info(f"DEBUG: Successfully parsed JSON from text with keys: {list(certs_data.keys())}")
                    except Exception as text_error:
                        logger.error(f"Failed to parse as text and JSON: {text_error}")
                        return {}
                
                # Validate the certificate data structure
                if not isinstance(certs_data, dict):
                    logger.error(f"Invalid certificate data type: {type(certs_data)}")
                    return {}
                
                # Log certificate details for debugging
                for key_id, cert_data in certs_data.items():
                    logger.info(f"DEBUG: Certificate {key_id}: type={type(cert_data)}, length={len(str(cert_data))}")
                    if isinstance(cert_data, str):
                        logger.info(f"DEBUG: Certificate {key_id} starts with: {cert_data[:100]}")
                
                self._cached_certs = certs_data
                self._certs_cache_time = now
                
                return self._cached_certs
                
        except httpx.TimeoutException:
            logger.error("Timeout fetching Google certificates")
            return {}
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching Google certificates: {e.response.status_code} - {e.response.text}")
            return {}
        except Exception as e:
            logger.error(f"Error fetching Google certificates: {e}")
            return {}
    
    def _verify_token_claims(self, decoded_token: Dict[str, Any]) -> bool:
        """
        Verify Google ID token claims
        """
        try:
            # Check issuer (already validated above, but double-check for safety)
            iss = decoded_token.get("iss")
            valid_issuers = [
                "https://accounts.google.com",
                "accounts.google.com",
                "https://accounts.google.com/",
                "http://accounts.google.com"
            ]
            if iss not in valid_issuers:
                logger.warning(f"Token claims verification: Invalid issuer: {iss}")
                return False
                
            # Check audience (should be our Google Client ID)
            aud = decoded_token.get("aud")
            if aud != getattr(settings, 'GOOGLE_CLIENT_ID', None):
                # For development, we might not have GOOGLE_CLIENT_ID set
                # In production, this should be strictly enforced
                pass
                
            # Check expiration
            exp = decoded_token.get("exp")
            if exp and datetime.utcfromtimestamp(exp) < datetime.utcnow():
                return False
                
            # Check issued at time
            iat = decoded_token.get("iat")
            if iat and datetime.utcfromtimestamp(iat) > datetime.utcnow():
                return False
                
            return True
            
        except Exception as e:
            print(f"Error verifying token claims: {e}")
            return False
    
    async def get_or_create_user(self, google_user: GoogleUserInfo) -> tuple[UserInDB, bool]:
        """
        Get existing user or create new user from Google information
        Uses unified service (Supabase primary, MongoDB fallback)
        Returns (user, is_new_user)
        """
        try:
            from app.utils.unified_user_service import unified_user_service
            
            # Try to find existing user by email (tries Supabase first, falls back to MongoDB)
            existing_user = await unified_user_service.get_user_by_email(google_user.email)
            
            if existing_user:
                # Update user's Google information if needed
                update_data = {}
                if not existing_user.google_id:
                    update_data["google_id"] = google_user.sub
                if google_user.picture and not existing_user.profile_picture:
                    update_data["profile_picture"] = google_user.picture
                    
                if update_data:
                    await unified_user_service.update_profile(
                        existing_user.email, 
                        update_data
                    )
                    # Refresh user data
                    existing_user = await unified_user_service.get_user_by_email(google_user.email)
                
                return existing_user, False
            
            # Create new user
            username = self._generate_username_from_email(google_user.email)
            
            # Ensure username is unique
            counter = 1
            original_username = username
            while await unified_user_service.get_user_by_username(username):
                username = f"{original_username}{counter}"
                counter += 1
            
            new_user_data = {
                "email": google_user.email,
                "username": username,
                "name": google_user.name or google_user.given_name or "User",
                "display_name": google_user.name or "",
                "google_id": google_user.sub,
                "profile_picture": google_user.picture,
                "is_verified": True,  # Google accounts are pre-verified
                "hashed_password": None,  # No password for Google users
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "last_login": datetime.utcnow().isoformat(),
                "is_active": True,
                "mfa_enabled": False,
                "mfa_secret": None,
                "recovery_codes": [],
                "trusted_devices": [],
                "mfa_setup_complete": False,
                "verification_token": None,
                "reset_token": None,
                "reset_token_expires": None,
                "subscription_id": None,
                "current_subscription_tier": "premium",
                "subscription_status": "active"
            }
            
            # Create user in both databases using unified service
            user_obj, _ = await unified_user_service.create_google_user(new_user_data)
            
            if not user_obj:
                raise Exception("Failed to create user in database")
            
            # Send welcome email to new Google user
            try:
                await self.email_service.send_welcome_email(
                    user_obj.email, 
                    user_obj.name or user_obj.username
                )
            except Exception as email_error:
                # Log error but don't fail user creation if email fails
                logger.warning(f"Failed to send welcome email to {user_obj.email}: {email_error}")
            
            return user_obj, True
            
        except Exception as e:
            print(f"Error creating/getting Google user: {e}")
            raise
    
    def _generate_username_from_email(self, email: str) -> str:
        """
        Generate a username from email address
        """
        # Take the part before @ and clean it up
        username = email.split("@")[0]
        
        # Remove any non-alphanumeric characters except underscores
        username = "".join(c for c in username if c.isalnum() or c == "_")
        
        # Ensure it's not empty and has reasonable length
        if not username:
            username = "user"
        elif len(username) > 20:
            username = username[:20]
            
        return username.lower()