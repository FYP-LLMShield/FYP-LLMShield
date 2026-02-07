import secrets
import base64
import qrcode
import io
import pyotp
from typing import List
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class MFAUtils:
    
    @staticmethod
    def generate_secret() -> str:
        """Generate a random base32 secret for TOTP - FIXED"""
        # Use pyotp's built-in random base32 generator (more reliable)
        return pyotp.random_base32()
    
    @staticmethod
    def generate_totp_code(secret: str, timestamp: int = None) -> str:
        """Generate TOTP code for given secret and timestamp - FIXED"""
        # Use pyotp instead of manual implementation
        totp = pyotp.TOTP(secret)
        if timestamp:
            return totp.at(timestamp)
        return totp.now()
    
    @staticmethod
    def verify_totp_code(secret: str, user_code: str, tolerance: int = 1) -> bool:
        """Verify TOTP code with time tolerance - FIXED"""
        # Use pyotp's built-in verification with window
        totp = pyotp.TOTP(secret)
        return totp.verify(user_code, valid_window=tolerance)
    
    @staticmethod
    def generate_qr_code(email: str, secret: str, issuer: str = "LLMShield") -> str:
        """Generate QR code for TOTP setup - FIXED"""
        # Use pyotp to generate the proper URI
        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(
            name=email,
            issuer_name=issuer
        )
        
        # Generate QR code with better settings
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(uri)
        qr.make(fit=True)
        
        # Create image with explicit mode
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64 with proper buffer handling
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        qr_code_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{qr_code_base64}"
    
    @staticmethod
    def generate_backup_url(email: str, secret: str, issuer: str = "LLMShield") -> str:
        """Generate backup URL for manual TOTP setup - FIXED"""
        # Use pyotp to generate the proper URI
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(
            name=email,
            issuer_name=issuer
        )
    
    @staticmethod
    def generate_recovery_codes(count: int = 8) -> List[str]:
        """Generate recovery codes - IMPROVED"""
        codes = []
        for _ in range(count):
            # Generate 8-character code with better entropy
            code = ''.join(secrets.choice('ABCDEFGHIJKLMNPQRSTUVWXYZ23456789') for _ in range(8))
            # Format as XXXX-XXXX for better UX
            formatted_code = f"{code[:4]}-{code[4:]}"
            codes.append(formatted_code)
        return codes
    
    @staticmethod
    def hash_recovery_code(code: str) -> str:
        """Hash recovery code for storage"""
        # Remove formatting before hashing
        clean_code = code.replace('-', '').upper()
        return pwd_context.hash(clean_code)
    
    @staticmethod
    def verify_recovery_code(code: str, hashed_code: str) -> bool:
        """Verify recovery code against hash"""
        # Remove formatting and normalize before verification
        clean_code = code.replace('-', '').upper()
        return pwd_context.verify(clean_code, hashed_code)
    
    @staticmethod
    def generate_trusted_device_token() -> str:
        """Generate token for trusted device"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def hash_trusted_device_token(token: str) -> str:
        """Hash trusted device token for storage"""
        return pwd_context.hash(token)
    
    @staticmethod
    def verify_trusted_device_token(token: str, hashed_token: str) -> bool:
        """Verify trusted device token"""
        return pwd_context.verify(token, hashed_token)

# Global instance
mfa_utils = MFAUtils()