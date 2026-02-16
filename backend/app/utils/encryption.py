import base64
import json
from typing import Dict, Any
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.core.config import settings


class CredentialsEncryption:
    """Handles encryption and decryption of model credentials"""
    
    def __init__(self):
        self._fernet = None
    
    def _get_fernet(self) -> Fernet:
        """Get or create Fernet instance for encryption/decryption"""
        if self._fernet is None:
            # Use the model encryption key from settings
            key = settings.MODEL_ENCRYPTION_KEY.encode()
            
            # Derive a proper encryption key using PBKDF2
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'llmshield_salt',  # In production, use a random salt per user
                iterations=100000,
            )
            derived_key = base64.urlsafe_b64encode(kdf.derive(key))
            self._fernet = Fernet(derived_key)
        
        return self._fernet
    
    def encrypt_credentials(self, credentials: Dict[str, Any]) -> str:
        """Encrypt credentials dictionary to a base64 string"""
        if not credentials:
            return ""
        
        try:
            # Convert to JSON string
            credentials_json = json.dumps(credentials, sort_keys=True)
            
            # Encrypt the JSON string
            fernet = self._get_fernet()
            encrypted_bytes = fernet.encrypt(credentials_json.encode())
            
            # Return as base64 string
            return base64.b64encode(encrypted_bytes).decode()
        
        except Exception as e:
            raise ValueError(f"Failed to encrypt credentials: {str(e)}")
    
    def decrypt_credentials(self, encrypted_credentials: str) -> Dict[str, Any]:
        """Decrypt base64 string back to credentials dictionary"""
        if not encrypted_credentials:
            return {}
        
        try:
            # Decode from base64
            encrypted_bytes = base64.b64decode(encrypted_credentials.encode())
            
            # Decrypt the bytes
            fernet = self._get_fernet()
            decrypted_bytes = fernet.decrypt(encrypted_bytes)
            
            # Parse JSON back to dictionary
            credentials_json = decrypted_bytes.decode()
            return json.loads(credentials_json)
        
        except Exception as e:
            raise ValueError(f"Failed to decrypt credentials: {str(e)}")


# Global encryption instance
_encryption = CredentialsEncryption()


def encrypt_credentials(credentials: Dict[str, Any]) -> str:
    """Encrypt credentials dictionary"""
    return _encryption.encrypt_credentials(credentials)


def decrypt_credentials(encrypted_credentials: str) -> Dict[str, Any]:
    """Decrypt credentials dictionary"""
    return _encryption.decrypt_credentials(encrypted_credentials)