import os
from pathlib import Path
from typing import Any, List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env: repo root first, then backend dir (backend overrides root)
# This file is at: backend/app/core/config.py
_backend_dir = Path(__file__).resolve().parent.parent.parent  # backend/
_repo_root = _backend_dir.parent  # FYP-LLMShield/
if (_repo_root / ".env").exists():
    load_dotenv(_repo_root / ".env", override=False)
if (_backend_dir / ".env").exists():
    load_dotenv(_backend_dir / ".env", override=True)
if Path.cwd() / ".env" != _backend_dir / ".env" and (Path.cwd() / ".env").exists():
    load_dotenv(Path.cwd() / ".env", override=True)
if not (_repo_root / ".env").exists() and not (_backend_dir / ".env").exists():
    load_dotenv()

class Settings(BaseSettings):
    # Environment (development | staging | production)
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", "8000"))

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
    
    # CORS (Internal validator handles both JSON lists and comma-separated strings)
    BACKEND_CORS_ORIGINS: Any = []
    
    # Optional: System API Keys for Model Validation (NOT REQUIRED)
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    HUGGINGFACE_API_KEY: Optional[str] = os.getenv("HUGGINGFACE_API_KEY")
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")
    GROQ_MODEL: Optional[str] = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    # Qdrant Vector Database Configuration
    QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
    QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
    QDRANT_API_KEY: Optional[str] = os.getenv("QDRANT_API_KEY")
    QDRANT_USE_HTTPS: bool = os.getenv("QDRANT_USE_HTTPS", "false").lower() in ("true", "1", "yes")

    # xAI Grok - for LLM-based prompt injection evaluation
    XAI_API_KEY: Optional[str] = os.getenv("XAI_API_KEY")
    
    # Google OAuth Configuration
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID")
    
    # Supabase Configuration
    SUPABASE_DB_URL: Optional[str] = os.getenv("SUPABASE_DB_URL")
    SUPABASE_PROJECT_URL: Optional[str] = os.getenv("SUPABASE_PROJECT_URL")
    SUPABASE_ANON_KEY: Optional[str] = os.getenv("SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_KEY")
    # JWT secret to verify Supabase-issued tokens (Project Settings > API > JWT Secret)
    SUPABASE_JWT_SECRET: Optional[str] = os.getenv("SUPABASE_JWT_SECRET")
    
    # Frontend URL (for verification/reset links in emails)
    FRONTEND_URL: Optional[str] = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Require email verification before login (set to false for dev/demo to allow login without verifying)
    REQUIRE_EMAIL_VERIFICATION: bool = os.getenv("REQUIRE_EMAIL_VERIFICATION", "true").lower() in ("true", "1", "yes")
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        # 1. Check direct environment variable first (highest priority)
        env_val = os.getenv("BACKEND_CORS_ORIGINS")
        
        # 2. If it's already a list (from default or internal Pydantic set), use it
        if not env_val and isinstance(v, list):
            return v if v else ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"]
            
        # 3. If we have an environment value (could be "", "url1,url2", or '["url1","url2"]')
        raw_val = env_val if env_val is not None else v
        
        if isinstance(raw_val, str):
            raw_val = raw_val.strip()
            if not raw_val:
                return ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"]
            
            # Try parsing as JSON first (if it looks like a list)
            if raw_val.startswith("[") and raw_val.endswith("]"):
                try:
                    import json
                    return json.loads(raw_val)
                except ValueError:
                    pass
            
            # Fallback to comma-separated
            return [i.strip() for i in raw_val.split(",") if i.strip()]
            
        return ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"]
    
    @field_validator("MODEL_ENCRYPTION_KEY", mode="before")
    @classmethod
    def validate_encryption_key(cls, v):
        if not v:
            from cryptography.fernet import Fernet
            key = Fernet.generate_key().decode()
            print("🔐 Generated encryption key (add to .env): MODEL_ENCRYPTION_KEY=...")
            return key
        return v

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.ENVIRONMENT == "production" and self.SECRET_KEY == "fallback_secret_key_change_in_production":
            import warnings
            warnings.warn(
                "SECRET_KEY is still the default. Set SECRET_KEY in production.",
                UserWarning,
                stacklevel=2,
            )

settings = Settings()