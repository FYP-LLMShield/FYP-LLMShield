import os
from pathlib import Path
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env from root directory (two levels up from this file)
# This file is at: backend/app/core/config.py
# Root is at: FYP-LLMShield/
root_dir = Path(__file__).parent.parent.parent.parent
env_file = root_dir / ".env"

# Load root .env if it exists, otherwise fall back to local .env
if env_file.exists():
    load_dotenv(env_file)
else:
    # Fallback to local .env in backend directory
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
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")
    GROQ_MODEL: Optional[str] = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    
    # xAI Grok - for LLM-based prompt injection evaluation
    XAI_API_KEY: Optional[str] = os.getenv("XAI_API_KEY")
    
    # Google OAuth Configuration
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID")
    
    # Supabase Configuration
    SUPABASE_DB_URL: Optional[str] = os.getenv("SUPABASE_DB_URL")
    SUPABASE_PROJECT_URL: Optional[str] = os.getenv("SUPABASE_PROJECT_URL")
    SUPABASE_ANON_KEY: Optional[str] = os.getenv("SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_KEY")
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v
    
    @field_validator("MODEL_ENCRYPTION_KEY", mode="before")
    @classmethod
    def validate_encryption_key(cls, v):
        if not v:
            from cryptography.fernet import Fernet
            key = Fernet.generate_key().decode()
            print(f"🔐 Generated encryption key: {key}")
            print("📝 Add this to your .env: MODEL_ENCRYPTION_KEY=" + key)
            return key
        return v
    
    model_config = {"case_sensitive": True}

settings = Settings()