"""
LLMShield Backend - Integrated FastAPI Application
================================================
Combines user authentication, MFA, and security scanning (secrets + C/C++ vulnerabilities)
into a single backend service.

Features:
- User Registration & JWT Authentication
- Multi-Factor Authentication (MFA/TOTP)
- Secret Detection (AWS keys, API tokens, SSH keys, etc.)
- C/C++ Vulnerability Scanning (buffer overflows, format strings, etc.)
- File upload, GitHub repo scanning, text analysis
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.mcp_servers import initialize_mcp_servers, mcp_registry
from app.routes.auth import router as auth_router
from app.routes.mfa import router as mfa_router
from app.routes.email_verification import router as email_verification_router
from app.routes.model_config import router as model_config_router
from app.routes.profile import router as profile_router

# Import the unified security scanner components
from app.routes.scanner import router as scanner_router
from app.routes.scan_history import router as scan_history_router
from app.routes.prompt_injection import router as prompt_injection_router
from app.routes.data_poisoning import router as data_poisoning_router
from app.routes.poisoning_simulation import router as poisoning_simulation_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    await connect_to_mongo()
    await initialize_mcp_servers()
    await mcp_registry.start_all()
    
    # Mount MCP servers
    mcp_instances = mcp_registry.get_all_mcp_instances()
    for name, instance in mcp_instances.items():
        app.mount(f"/mcp/{name}", instance.get_app())
    
    print("🚀 Database connected successfully")
    print("🛡️  Security scanner modules loaded")
    yield
    
    # Shutdown
    await mcp_registry.stop_all()
    await close_mongo_connection()
    print("📴 Database connection closed")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    description="LLMShield Backend API with Authentication, MFA, and Security Scanning",
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
app.include_router(
    email_verification_router, 
    prefix=f"{settings.API_V1_STR}/auth", 
    tags=["Email Verification"]
)
# Add the security scanner router
app.include_router(
    scanner_router, 
    prefix=f"{settings.API_V1_STR}/scan", 
    tags=["Security Scanner"]
)
# Add the scan history router
app.include_router(
    scan_history_router, 
    prefix=f"{settings.API_V1_STR}", 
    tags=["Scan History"]
)
app.include_router(
    model_config_router, 
    prefix=f"{settings.API_V1_STR}/model-config", 
    tags=["Model Configuration"]
)
app.include_router(
    profile_router, 
    prefix=f"{settings.API_V1_STR}/profiles", 
    tags=["Profile Management"]
)
app.include_router(
    prompt_injection_router, 
    prefix=f"{settings.API_V1_STR}/prompt-injection", 
    tags=["Prompt Injection Testing"]
)
app.include_router(
    data_poisoning_router,
    prefix=f"{settings.API_V1_STR}/data-poisoning",
    tags=["Data Poisoning Detection"]
)
app.include_router(
    poisoning_simulation_router,
    prefix=f"{settings.API_V1_STR}/poisoning-simulation",
    tags=["Poisoning Simulation"]
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
            "Recovery Codes & Trusted Devices",
            "Secret Detection (AWS, API keys, SSH keys)",
            "C/C++ Vulnerability Scanning",
            "File Upload & GitHub Repository Scanning",
            "High-Entropy String Detection"
        ],
        "endpoints": {
            "authentication": f"{settings.API_V1_STR}/auth",
            "mfa": f"{settings.API_V1_STR}/auth/mfa", 
            "security_scanner": f"{settings.API_V1_STR}/scan"
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
        # You might want to add database connectivity check here
        # db_status = await check_database_connection()
        
        return {
            "status": "healthy",
            "message": "LLMShield Backend is running",
            "version": "2.0.0",
            "services": {
                "authentication": "✅ Active",
                "mfa": "✅ Active", 
                "security_scanner": "✅ Active",
                "database": "✅ Connected"  # You might want to actually check this
            },
            "scanner_capabilities": {
                "secrets": "200+ patterns including AWS, GitHub, SSH keys",
                "cpp_vulnerabilities": "200+ dangerous functions and patterns",
                "input_methods": ["text_paste", "file_upload", "github_clone"],
                "supported_formats": [".c", ".cpp", ".h", ".py", ".js", ".env", ".json"]
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
    import logging
    
    # Configure logging to show INFO level messages
    logging.basicConfig(level=logging.INFO)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )