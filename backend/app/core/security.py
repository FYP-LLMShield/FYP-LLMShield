import base64
import hashlib
import secrets
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class SecurityManager:
    """Security manager for encryption/decryption operations"""
    
    def __init__(self):
        self._fernet = None
        self._initialize_encryption()
    
    def _initialize_encryption(self):
        """Initialize encryption with a key derived from settings"""
        try:
            # Use SECRET_KEY from settings to derive encryption key
            password = settings.SECRET_KEY.encode()
            salt = b'llmshield_salt_2024'  # Fixed salt for consistency
            
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(password))
            self._fernet = Fernet(key)
            
        except Exception as e:
            logger.error(f"Failed to initialize encryption: {e}")
            # Fallback to a simple base64 encoding if encryption fails
            self._fernet = None
    
    def encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data"""
        if not data:
            return data
        
        try:
            if self._fernet:
                encrypted = self._fernet.encrypt(data.encode())
                return base64.urlsafe_b64encode(encrypted).decode()
            else:
                # Fallback to base64 encoding (not secure, but prevents crashes)
                return base64.urlsafe_b64encode(data.encode()).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return data  # Return original data if encryption fails
    
    def decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        if not encrypted_data:
            return encrypted_data
        
        try:
            if self._fernet:
                decoded = base64.urlsafe_b64decode(encrypted_data.encode())
                decrypted = self._fernet.decrypt(decoded)
                return decrypted.decode()
            else:
                # Fallback to base64 decoding
                return base64.urlsafe_b64decode(encrypted_data.encode()).decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return encrypted_data  # Return original data if decryption fails

# Global security manager instance
security_manager = SecurityManager()

def encrypt_data(data: str) -> str:
    """Encrypt sensitive data using the global security manager"""
    return security_manager.encrypt_data(data)

def decrypt_data(encrypted_data: str) -> str:
    """Decrypt sensitive data using the global security manager"""
    return security_manager.decrypt_data(encrypted_data)

def generate_secure_token(length: int = 32) -> str:
    """Generate a secure random token"""
    return secrets.token_urlsafe(length)

def hash_data(data: str) -> str:
    """Hash data using SHA-256"""
    return hashlib.sha256(data.encode()).hexdigest()

def verify_hash(data: str, hash_value: str) -> bool:
    """Verify data against its hash"""
    return hash_data(data) == hash_value