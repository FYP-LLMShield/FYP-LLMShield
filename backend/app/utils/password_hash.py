"""
Bcrypt password hashing with 72-byte truncation.
Use this for user passwords to avoid passlib/bcrypt version issues and enforce bcrypt's 72-byte limit.
"""
import bcrypt


def truncate_to_72_bytes(s: str) -> bytes:
    """Return UTF-8 bytes of s, truncated to at most 72 bytes (bcrypt limit)."""
    b = s.encode("utf-8")
    if len(b) > 72:
        b = b[:72]
    return b


def hash_password(password: str) -> str:
    """Hash a password with bcrypt. Passwords longer than 72 bytes are truncated."""
    b = truncate_to_72_bytes(password)
    hashed = bcrypt.hashpw(b, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a bcrypt hash. Plain password is truncated to 72 bytes."""
    if not hashed_password:
        return False
    try:
        b = truncate_to_72_bytes(plain_password)
        return bcrypt.checkpw(b, hashed_password.encode("utf-8"))
    except Exception:
        return False
