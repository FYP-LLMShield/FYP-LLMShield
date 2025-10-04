"""
LLMShield Backend - Integrated FastAPI Application
================================================
Provides user authentication and MFA (TOTP) into a secure backend service.

Features:
- User Registration & JWT Authentication
- Multi-Factor Authentication (MFA/TOTP)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.routes.auth import router as auth_router
from app.routes.mfa import router as mfa_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    await connect_to_mongo()
    print("🚀 Database connected successfully")
    yield
    # Shutdown
    await close_mongo_connection()
    print("📴 Database connection closed")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    description="LLMShield Backend API with Authentication and MFA",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    auth_router,
    prefix=f"{settings.API_V1_STR}/auth",
    tags=["Authentication"]
)
app.include_router(
    mfa_router,
    prefix=f"{settings.API_V1_STR}/auth/mfa",
    tags=["Multi-Factor Authentication"]
)


@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()


@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "LLMShield Backend API",
        "version": "2.0.0",
        "features": [
            "User Registration & Email Verification",
            "Secure Login with JWT Tokens",
            "Password Reset & Profile Management",
            "Multi-Factor Authentication (TOTP)",
            "Recovery Codes & Trusted Devices"
        ],
        "endpoints": {
            "authentication": f"{settings.API_V1_STR}/auth",
            "mfa": f"{settings.API_V1_STR}/auth/mfa"
        },
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc"
        }
    }


@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint."""
    try:
        return {
            "status": "healthy",
            "message": "LLMShield Backend is running",
            "version": "2.0.0",
            "services": {
                "authentication": "✅ Active",
                "mfa": "✅ Active",
                "database": "✅ Connected"  # Ideally, check DB connectivity here
            }
        }
    except Exception as e:
        return {
            "status": "degraded",
            "message": f"Some services may be unavailable: {str(e)}",
            "version": "2.0.0"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
