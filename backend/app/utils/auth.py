# app/utils/auth.py - FIXED VERSION
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Optional, Tuple
from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.database import get_database
from app.utils.user_service import user_service  # Use the global instance
from app.utils.password_hash import hash_password as get_password_hash, verify_password as _verify_password
from app.models.user import UserInDB
from bson import ObjectId
import hashlib
import secrets
import string

# Security scheme - auto_error=False to handle missing tokens gracefully
security = HTTPBearer(auto_error=False)


def _supabase_public_origin() -> str:
    """
    Normalize SUPABASE_PROJECT_URL to the project origin only.
    Strips accidental /auth/v1 or /rest/v1 suffixes so we do not build .../auth/v1/auth/v1/user.
    """
    raw = (settings.SUPABASE_PROJECT_URL or "").strip().rstrip("/")
    if not raw:
        return ""
    for suffix in ("/auth/v1", "/rest/v1"):
        if raw.endswith(suffix):
            raw = raw[: -len(suffix)].rstrip("/")
    return raw

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash (72-byte safe)."""
    return _verify_password(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    """Create JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(token: str, token_type: str = "access"):
    """Verify and decode JWT token"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        if not token:
            logger.warning("Token is empty")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing or empty",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        token_type_from_token: str = payload.get("type")
        
        if email is None:
            logger.warning(f"Token missing 'sub' field. Payload: {payload}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user identifier",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if token_type_from_token != token_type:
            logger.warning(f"Token type mismatch. Expected: {token_type}, Got: {token_type_from_token}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {token_type} token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.debug(f"Token verified successfully for user: {email}")
        return email
    except JWTError as e:
        logger.warning(f"JWT validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


@lru_cache(maxsize=8)
def _supabase_jwks_client(jwks_url: str):
    """Cached PyJWKClient for Supabase asymmetric JWTs (ES256/RS256)."""
    from jwt import PyJWKClient

    return PyJWKClient(jwks_url)


def _verify_supabase_jwt(token: str) -> Optional[dict]:
    """
    Verify Supabase-issued JWT. Returns payload if valid, None otherwise.

    Supports:
    - HS256 with SUPABASE_JWT_SECRET (legacy / shared-secret projects)
    - ES256 / RS256 via JWKS at {SUPABASE_PROJECT_URL}/auth/v1/.well-known/jwks.json
      (default for newer Supabase CLI and projects using asymmetric signing keys)
    """
    if not token:
        return None

    import jwt as pyjwt

    try:
        header = pyjwt.get_unverified_header(token)
    except pyjwt.PyJWTError:
        return None

    alg = header.get("alg")

    if alg == "HS256" and settings.SUPABASE_JWT_SECRET:
        try:
            return pyjwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except pyjwt.InvalidAudienceError:
            try:
                return pyjwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    options={"verify_aud": False},
                )
            except pyjwt.PyJWTError:
                return None
        except pyjwt.PyJWTError:
            return None

    origin = _supabase_public_origin()
    if alg in ("ES256", "RS256", "ES384", "RS384") and origin:
        jwks_url = f"{origin}/auth/v1/.well-known/jwks.json"
        try:
            jwks = _supabase_jwks_client(jwks_url)
            signing_key = jwks.get_signing_key_from_jwt(token)
            decoded = pyjwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience="authenticated",
            )
            return decoded
        except pyjwt.InvalidAudienceError:
            try:
                return pyjwt.decode(
                    token,
                    signing_key.key,
                    algorithms=[alg],
                    options={"verify_aud": False},
                )
            except pyjwt.PyJWTError:
                return None
        except pyjwt.PyJWTError:
            return None
        except Exception:
            return None

    return None


def _looks_like_supabase_token(token: str) -> bool:
    """
    Best-effort check to decide whether we should ask Supabase Auth to validate a token.

    Why: backend-issued JWTs will fail Supabase `/auth/v1/user` with `bad_jwt` and create noisy logs.
    We only call Supabase when the token plausibly originates from Supabase (issuer/audience/claims).
    """
    if not token:
        return False
    try:
        import jwt as pyjwt

        header = pyjwt.get_unverified_header(token) or {}
        alg = (header.get("alg") or "").upper()

        # Asymmetric tokens (ES*/RS*) are strongly indicative of Supabase Auth.
        if alg.startswith("ES") or alg.startswith("RS"):
            return True

        # For HS256, inspect claims (iss/aud) to avoid calling Supabase for backend JWTs.
        payload = pyjwt.decode(token, options={"verify_signature": False}) or {}
        iss = str(payload.get("iss") or "")
        aud = payload.get("aud")

        origin = _supabase_public_origin()
        if origin and origin in iss:
            return True

        if aud == "authenticated":
            return True
        if isinstance(aud, (list, tuple)) and "authenticated" in aud:
            return True

        # Supabase often includes these claims; treat them as a weak signal.
        if "role" in payload and ("sub" in payload or "email" in payload):
            return True

        return False
    except Exception:
        return False


async def _verify_supabase_via_auth_user_endpoint(token: str) -> Optional[dict]:
    """
    Validate the access token by calling GoTrue GET /auth/v1/user.
    Works for any JWT signing algorithm (ES256, HS256, future algs) because Auth verifies the token.
    Used when local JWT verification fails (e.g. JWKS unreachable, unsupported alg, audience quirks).
    """
    import logging

    _log = logging.getLogger(__name__)
    origin = _supabase_public_origin()
    apikey = settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_KEY
    if not origin or not apikey or not token:
        return None
    url = f"{origin}/auth/v1/user"
    try:
        import httpx

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": apikey,
                },
            )
        if resp.status_code != 200:
            # Non-supabase tokens (e.g., backend JWT) commonly return 403 bad_jwt.
            # This should not be noisy in logs because we fall back to backend auth.
            _log.debug(
                "Supabase Auth GET /auth/v1/user failed: status=%s body=%s",
                resp.status_code,
                (resp.text or "")[:400],
            )
            return None
        body = resp.json() or {}
        u = body.get("user") if isinstance(body.get("user"), dict) else body
        if not isinstance(u, dict) or not u.get("id"):
            return None
        return {
            "sub": str(u["id"]),
            "email": u.get("email"),
            "phone": u.get("phone"),
            "user_metadata": u.get("user_metadata") or {},
            "email_confirmed_at": u.get("email_confirmed_at"),
            "identities": u.get("identities") or [],
        }
    except Exception:
        return None


def _user_from_supabase_payload(payload: dict) -> UserInDB:
    """Build a minimal UserInDB from Supabase JWT payload (sub, email, user_metadata)."""
    sub = payload.get("sub") or ""
    email = payload.get("email") or (payload.get("phone") and f"{payload['phone']}@phone") or "unknown"
    if isinstance(email, list):
        email = email[0] if email else "unknown"
    if isinstance(email, str):
        email = email.strip().lower()
    metadata = payload.get("user_metadata") or {}
    name = metadata.get("full_name") or metadata.get("name") or email.split("@")[0]
    username = metadata.get("username") or email.split("@")[0]
    # JWT may omit email_confirmed_at; treat unknown as verified so existing sessions keep working.
    raw_conf = payload.get("email_confirmed_at")
    is_verified_supabase = True if raw_conf is None else bool(raw_conf)
    # Deterministic ObjectId from sub so we have a consistent id
    oid = ObjectId(hashlib.md5(sub.encode()).hexdigest()[:24])
    return UserInDB(
        id=oid,
        email=email,
        username=username,
        name=name,
        hashed_password=None,
        is_verified=is_verified_supabase,
        is_active=True,
        mfa_enabled=False,
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> UserInDB:
    """
    Dependency to get current authenticated user
    FIXED: Use global user_service instance instead of creating new one
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Check if credentials are provided
        if credentials is None:
            logger.warning("No Authorization header provided")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required. Please provide a valid token in the Authorization header.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Extract token from credentials
        token = credentials.credentials
        
        if not token:
            logger.warning("Authorization header present but token is empty")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing. Please provide a valid authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.debug(f"Verifying token: {token[:20]}...")
        
        # 1) Try Supabase Auth JWT locally (HS256 secret or ES256/RS256 via JWKS)
        supabase_payload = _verify_supabase_jwt(token)
        if supabase_payload:
            logger.debug("Token validated as Supabase Auth JWT")
            return _user_from_supabase_payload(supabase_payload)

        # 2) Ask Supabase Auth to validate the session (any alg; avoids JWKS/env mismatches)
        if _looks_like_supabase_token(token):
            supabase_payload = await _verify_supabase_via_auth_user_endpoint(token)
            if supabase_payload:
                logger.debug("Token validated via Supabase Auth /user endpoint")
                return _user_from_supabase_payload(supabase_payload)
        
        # 3) Fallback: backend-issued JWT (when Supabase is down or user used fallback auth)
        email = verify_token(token, "access")
        from app.utils.unified_user_service import unified_user_service
        user = await unified_user_service.get_user_by_email(email)
        
        if user is None:
            logger.warning(f"User not found for email: {email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.debug(f"User authenticated successfully (backend token): {email}")
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[UserInDB]:
    """
    Dependency to get current user if token is provided.
    Returns None when unauthenticated instead of raising.
    """
    if credentials is None:
        return None

    token = credentials.credentials
    if not token:
        return None

    try:
        supabase_payload = _verify_supabase_jwt(token)
        if supabase_payload:
            return _user_from_supabase_payload(supabase_payload)
        if _looks_like_supabase_token(token):
            supabase_payload = await _verify_supabase_via_auth_user_endpoint(token)
            if supabase_payload:
                return _user_from_supabase_payload(supabase_payload)
        email = verify_token(token, "access")
        from app.utils.unified_user_service import unified_user_service
        return await unified_user_service.get_user_by_email(email)
    except HTTPException:
        return None
    except Exception:
        # Bad or non-JWT tokens must not fail the whole request for optional auth
        return None

def generate_verification_token() -> str:
    """Generate a random verification token"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))

def generate_reset_token() -> str:
    """Generate a random password reset token"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))