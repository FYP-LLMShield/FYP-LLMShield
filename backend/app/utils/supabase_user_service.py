"""
Supabase User Service - Primary database for user authentication
"""
import logging
import secrets
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

    def ensure_supabase_auth_user_for_google(
        self,
        email: str,
        name: str,
        google_sub: Optional[str] = None,
    ) -> None:
        """
        Create a matching row in auth.users (Supabase Auth) for Google GIS sign-in.

        Google flow only inserts into public.users via the service client; it does not
        call supabase.auth.signUp, so users otherwise never appear under Authentication
        in the dashboard. This mirrors native OAuth behavior: email is treated as
        confirmed (Google verified it), so no Supabase confirmation email is sent.
        """
        if not self.is_available() or not email:
            return
        try:
            from gotrue.errors import AuthApiError
        except ImportError:
            AuthApiError = Exception  # type: ignore[misc,assignment]

        attrs = {
            "email": email.strip(),
            "password": secrets.token_urlsafe(32),
            "email_confirm": True,
            "user_metadata": {
                "full_name": name or "",
                "signup_provider": "google_gis",
                "google_sub": google_sub or "",
            },
        }
        try:
            self.client.auth.admin.create_user(attrs)  # type: ignore[arg-type]
            logger.info("Supabase Auth (auth.users) row created for Google sign-in: %s", email)
        except AuthApiError as e:
            code = getattr(e, "code", None) or ""
            msg = (getattr(e, "message", None) or str(e)).lower()
            if code in ("email_exists", "user_already_exists", "phone_exists") or any(
                s in msg for s in ("already been registered", "already registered", "duplicate", "exists")
            ):
                logger.debug("Supabase Auth user already present for %s; skipping create", email)
                return
            logger.warning("Supabase Auth create_user failed for %s: %s", email, e)
        except Exception as e:
            logger.warning("Supabase Auth create_user failed for %s: %s", email, e)

    def get_public_user_id_string_by_email(self, email: str) -> Optional[str]:
        """Return public.users.id (UUID string) for an email, if any."""
        if not self.is_available() or not email:
            return None
        try:
            result = self.client.table("users").select("id").eq("email", email.strip().lower()).limit(1).execute()
            if result.data and len(result.data) > 0 and result.data[0].get("id"):
                return str(result.data[0]["id"])
        except Exception as e:
            logger.warning("get_public_user_id_string_by_email failed: %s", e)
        return None

    def ensure_supabase_auth_user_backend_register(
        self,
        public_user_uuid: str,
        email: str,
        password: str,
        name: str,
        username: str,
    ) -> None:
        """
        Create auth.users with the same UUID as public.users after backend (email) registration.
        email_confirm=False aligns with public.is_verified until the app verification link is used.
        """
        if not self.is_available() or not email or not public_user_uuid:
            return
        try:
            from gotrue.errors import AuthApiError
        except ImportError:
            AuthApiError = Exception  # type: ignore[misc,assignment]

        attrs = {
            "id": public_user_uuid,
            "email": email.strip().lower(),
            "password": password,
            "email_confirm": False,
            "user_metadata": {
                "full_name": name or "",
                "username": username,
                "signup_provider": "backend_register",
            },
        }
        try:
            self.client.auth.admin.create_user(attrs)  # type: ignore[arg-type]
            logger.info("Supabase Auth user created for backend register: %s", email)
        except AuthApiError as e:
            code = getattr(e, "code", None) or ""
            msg = (getattr(e, "message", None) or str(e)).lower()
            if code in ("email_exists", "user_already_exists", "phone_exists") or any(
                s in msg for s in ("already been registered", "already registered", "duplicate", "exists")
            ):
                logger.info("Supabase Auth user already exists for %s; skipping create", email)
                return
            logger.warning("Supabase Auth create_user (backend register) failed for %s: %s", email, e)
        except Exception as e:
            logger.warning("Supabase Auth create_user (backend register) failed for %s: %s", email, e)

    def confirm_auth_user_email_for_uuid(self, auth_user_id: str) -> None:
        """Set email_confirm on auth.users after public.users email verification."""
        if not self.is_available() or not auth_user_id:
            return
        try:
            self.client.auth.admin.update_user_by_id(
                auth_user_id,
                {"email_confirm": True},
            )
            logger.info("Supabase Auth email confirmed for user id %s", auth_user_id)
        except Exception as e:
            logger.warning("Could not confirm Supabase Auth user %s: %s", auth_user_id, e)

    async def sync_public_user_from_supabase_auth(
        self,
        auth_user_id: str,
        email: str,
        name: str,
        username: str,
        email_confirmed: bool,
    ) -> Optional[UserInDB]:
        """
        Upsert public.users from a Supabase Auth session (email/password or OAuth via Auth).
        Does not overwrite an existing password hash (backend-registered users).
        """
        if not self.is_available() or not email:
            return None
        email = email.strip().lower()
        name = (name or email.split("@")[0]).strip() or email.split("@")[0]
        username = (username or email.split("@")[0]).strip().lower() or email.split("@")[0]

        try:
            existing = self.client.table("users").select("*").eq("email", email).limit(1).execute()
            row = existing.data[0] if existing.data else None
            now_iso = datetime.utcnow().isoformat()

            if row:
                new_verified = bool(row.get("is_verified")) or bool(email_confirmed)
                upd = {
                    "name": name or row.get("name"),
                    "username": username or row.get("username"),
                    "display_name": name or row.get("display_name") or "",
                    "is_verified": new_verified,
                    "updated_at": now_iso,
                }
                self.client.table("users").update(upd).eq("email", email).execute()
            else:
                insert_payload = {
                    "id": auth_user_id,
                    "email": email,
                    "username": username,
                    "name": name,
                    "display_name": name,
                    "hashed_password": "",
                    "is_verified": bool(email_confirmed),
                    "is_active": True,
                    "mfa_enabled": False,
                    "mfa_setup_complete": False,
                    "recovery_codes": [],
                    "trusted_devices": [],
                    "current_subscription_tier": "premium",
                    "subscription_status": "active",
                }
                try:
                    self.client.table("users").insert(insert_payload).execute()
                except Exception as ins_err:
                    err_l = str(ins_err).lower()
                    if "unique" in err_l or "duplicate" in err_l:
                        logger.info("sync_public_user: username conflict, retrying with suffix (%s)", email)
                        insert_payload["username"] = f"{username}_{secrets.token_hex(3)}"
                        self.client.table("users").insert(insert_payload).execute()
                    else:
                        raise
            return await self.get_user_by_email(email)
        except Exception as e:
            logger.error("sync_public_user_from_supabase_auth failed for %s: %s", email, e, exc_info=True)
            return None
    
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

            # Step 1: Insert user with basic fields
            user_dict = {
                "email": user_data.email,
                "hashed_password": hashed_password,
                "username": user_data.username,
                "name": user_data.name,
                "is_verified": False,
                "is_active": True,
                "mfa_enabled": False,
                "mfa_setup_complete": False,
                "display_name": "",
                "current_subscription_tier": "premium",
                "subscription_status": "active",
            }

            result = self.client.table("users").insert(user_dict).execute()

            # Step 2: ALWAYS update verification_token (regardless of INSERT result)
            logger.info(f"Saving verification token for {user_data.email}")
            try:
                update_result = self.client.table("users").update({
                    "verification_token": verification_token
                }).eq("email", user_data.email).execute()

                if update_result.data and len(update_result.data) > 0:
                    logger.info(f"Verification token saved successfully for {user_data.email}")
                    logger.info(f"Token in database: {update_result.data[0].get('verification_token', 'NOT_FOUND')[:20]}...")
                else:
                    logger.warning(f"Token update returned no data for {user_data.email}")
            except Exception as token_error:
                logger.error(f"Error saving verification token: {token_error}", exc_info=True)

            # Step 3: Always fetch fresh user from database to ensure token is present
            logger.info(f"Fetching user from database to verify token: {user_data.email}")
            fetched = await self.get_user_by_email(user_data.email)
            if fetched:
                logger.info(f"User fetched from database: {user_data.email}")
                if fetched.verification_token:
                    logger.info(f"Token confirmed in database: {fetched.verification_token[:20]}...")
                else:
                    logger.warning(f"Token NOT found in database for {user_data.email} - this is a problem!")
                return fetched

            # Final fallback: try to use INSERT result if fetch failed
            if result.data and len(result.data) > 0:
                user_data_dict = result.data[0]
                # Manually set token since it wasn't in INSERT result
                user_data_dict["verification_token"] = verification_token
                user = self._convert_supabase_to_userindb(user_data_dict)
                if user:
                    logger.info(f"User created from INSERT data: {user_data.email}")
                    return user

            logger.error(f"Failed to create or fetch user: {user_data.email}")
            return None

        except HTTPException:
            # HTTP errors should be re-raised without logging as they're validation errors
            raise
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

    @staticmethod
    def _email_lookup_variants(email: Optional[str]) -> list:
        """JWT may use different casing than the users row; try exact then lowercase."""
        raw = (email or "").strip()
        if not raw:
            return []
        lo = raw.lower()
        return [raw, lo] if lo != raw else [raw]
    
    async def get_user_by_email(self, email: str) -> Optional[UserInDB]:
        """Get user by email from Supabase"""
        try:
            if not self.is_available():
                return None
            
            for em in self._email_lookup_variants(email):
                result = self.client.table("users").select("*").eq("email", em).execute()
                if result.data and len(result.data) > 0:
                    return self._convert_supabase_to_userindb(result.data[0])
            
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
        """Authenticate user with username/email and password

        Returns user if authenticated, None otherwise.
        Does not raise exceptions - caller should check separately for better error messages.
        """
        try:
            # Try email first
            user = await self.get_user_by_email(username_or_email)

            # If not found, try username
            if not user:
                user = await self.get_user_by_username(username_or_email)

            # User doesn't exist - return None (caller will provide error message)
            if not user:
                logger.warning(f"Authentication attempt with non-existent account: {username_or_email}")
                return None

            # User exists but not active
            if not user.is_active:
                logger.warning(f"Authentication attempt on inactive account: {username_or_email}")
                return None

            # Password mismatch
            if not self.verify_password(password, user.hashed_password):
                logger.warning(f"Authentication attempt with wrong password: {username_or_email}")
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
                logger.error("Supabase not available for email verification")
                return False

            # First, try to find the user with this token
            logger.info(f"Attempting to verify token (length={len(token)}): {token[:30]}...")
            search_result = self.client.table("users").select("email,verification_token").eq("verification_token", token).execute()
            logger.info(f"Search result: found {len(search_result.data) if search_result.data else 0} users with this token")

            if search_result.data:
                logger.info(f"Found user for verification: {search_result.data[0].get('email')}")
            else:
                logger.warning(f"No user found with token: {token[:30]}... (checking database...)")
                # Check if any tokens exist in the database at all
                all_tokens = self.client.table("users").select("email,verification_token").limit(5).execute()
                logger.warning(f"Sample tokens in database: {[{'email': u.get('email'), 'token_present': bool(u.get('verification_token'))} for u in (all_tokens.data or [])]}")

            result = (
                self.client.table("users")
                .update(
                    {
                        "is_verified": True,
                        "verification_token": None,
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                )
                .eq("verification_token", token)
                .select("id,email")
                .execute()
            )

            success = result.data is not None and len(result.data) > 0
            if success:
                row0 = result.data[0]
                logger.info(f"Email verification successful for: {row0.get('email')}")
                uid = row0.get("id")
                if uid:
                    self.confirm_auth_user_email_for_uuid(str(uid))
            else:
                logger.error(f"Email verification failed: UPDATE returned no data for token {token[:30]}...")

            return success

        except Exception as e:
            logger.error(f"Error verifying email in Supabase: {e}", exc_info=True)
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

            # Set hashed_password to empty string for Google users (can't be NULL)
            payload["hashed_password"] = user_data.get("hashed_password") or ""

            result = self.client.table("users").insert(payload).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"Google user created in Supabase: {user_data['email']}")
                # Convert Supabase UUID `id` into a deterministic Mongo-style ObjectId
                # so downstream code relying on `UserInDB` continues to work.
                return self._convert_supabase_to_userindb(result.data[0])
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
            update_payload = {
                "mfa_secret": secret,
                "recovery_codes": hashed_recovery_codes,
                "updated_at": datetime.utcnow().isoformat(),
            }
            # PostgREST often returns empty `data` on UPDATE even when rows match — verify by re-fetch.
            for em in self._email_lookup_variants(email):
                try:
                    self.client.table("users").update(update_payload).eq("email", em).execute()
                except Exception as upd_err:
                    logger.error(f"store_temp_mfa_secret update failed for {em!r}: {upd_err}")
                    continue
                check = await self.get_user_by_email(email)
                if check and check.mfa_secret == secret:
                    return True
            return False
        except Exception as e:
            logger.error(f"Error storing temp MFA secret in Supabase: {e}")
            return False

    async def enable_mfa(self, email: str) -> bool:
        """Enable MFA for user after TOTP verification."""
        try:
            if not self.is_available():
                return False
            update_payload = {
                "mfa_enabled": True,
                "mfa_setup_complete": True,
                "updated_at": datetime.utcnow().isoformat(),
            }
            for em in self._email_lookup_variants(email):
                try:
                    self.client.table("users").update(update_payload).eq("email", em).execute()
                except Exception as upd_err:
                    logger.error(f"enable_mfa update failed for {em!r}: {upd_err}")
                    continue
                check = await self.get_user_by_email(email)
                if check and check.mfa_enabled and check.mfa_setup_complete:
                    return True
            return False
        except Exception as e:
            logger.error(f"Error enabling MFA in Supabase: {e}")
            return False

    async def finalize_mfa_setup(self, email: str, secret: str, recovery_codes: list) -> bool:
        """Persist MFA secret, hashed recovery codes, and enabled flags in one update."""
        try:
            if not self.is_available():
                return False
            from app.utils.mfa import mfa_utils

            hashed_recovery_codes = [mfa_utils.hash_recovery_code(code) for code in recovery_codes]
            update_payload = {
                "mfa_secret": secret,
                "recovery_codes": hashed_recovery_codes,
                "mfa_enabled": True,
                "mfa_setup_complete": True,
                "updated_at": datetime.utcnow().isoformat(),
            }
            for em in self._email_lookup_variants(email):
                try:
                    self.client.table("users").update(update_payload).eq("email", em).execute()
                except Exception as upd_err:
                    logger.error(f"finalize_mfa_setup update failed for {em!r}: {upd_err}")
                    continue
                check = await self.get_user_by_email(email)
                if (
                    check
                    and check.mfa_enabled
                    and check.mfa_setup_complete
                    and (check.mfa_secret or "").strip() == (secret or "").strip()
                ):
                    return True
            return False
        except Exception as e:
            logger.error(f"Error finalize_mfa_setup in Supabase: {e}")
            return False

    async def disable_mfa(self, email: str) -> bool:
        """Disable MFA for user (clear secret and recovery codes)."""
        try:
            if not self.is_available():
                return False
            clear_payload = {
                "mfa_enabled": False,
                "mfa_setup_complete": False,
                "mfa_secret": None,
                "recovery_codes": [],
                "updated_at": datetime.utcnow().isoformat(),
            }
            for em in self._email_lookup_variants(email):
                try:
                    self.client.table("users").update(clear_payload).eq("email", em).execute()
                except Exception as upd_err:
                    logger.error(f"disable_mfa update failed for {em!r}: {upd_err}")
                    continue
                check = await self.get_user_by_email(email)
                if check and not check.mfa_enabled and not check.mfa_secret:
                    return True
            return False
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
