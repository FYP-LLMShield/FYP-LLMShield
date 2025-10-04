import os
from typing import List, Optional
from pydantic import validator
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "llmshield_db")
    
    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "fallback_secret_key_change_in_production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    
    # Model Configuration Encryption
    MODEL_ENCRYPTION_KEY: str = os.getenv("MODEL_ENCRYPTION_KEY", "")
    
    # API
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "LLMShield Backend")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001","http://localhost:5173"]
    
    # Optional: System API Keys for Model Validation (NOT REQUIRED)
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    HUGGINGFACE_API_KEY: Optional[str] = os.getenv("HUGGINGFACE_API_KEY")
    
    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v
    
    @validator("MODEL_ENCRYPTION_KEY", pre=True)
    def validate_encryption_key(cls, v):
        if not v:
            from cryptography.fernet import Fernet
            key = Fernet.generate_key().decode()
            print(f"🔐 Generated encryption key: {key}")
            print("📝 Add this to your .env: MODEL_ENCRYPTION_KEY=" + key)
            return key
        return v
    
    class Config:
        case_sensitive = True

settings = Settings()