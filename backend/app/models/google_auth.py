from pydantic import BaseModel, EmailStr
from typing import Optional

class GoogleSignInRequest(BaseModel):
    """Model for Google Sign-In request"""
    id_token: str
    # "signup" = create user if not exists (Continue with Google on sign-up form)
    # "signin" = only allow if user exists (Continue with Google on login form); otherwise return 403
    mode: Optional[str] = None  # "signup" | "signin"; default "signup" for backward compatibility
    
class GoogleUserInfo(BaseModel):
    """Model for Google user information"""
    email: EmailStr
    name: str
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    picture: Optional[str] = None
    sub: str  # Google user ID
    
class GoogleSignInResponse(BaseModel):
    """Model for Google Sign-In response"""
    message: str
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict
    is_new_user: bool = False