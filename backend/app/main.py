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
from app.core.database import connect_to_mongo, close_mongo_connection, ping_mongo
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
    import traceback
    app.state.db_connected = False
    app.state.mcp_initialized = False

    # MongoDB: do not fail app startup so /health/live works and logs are visible
    try:
        await connect_to_mongo()
        app.state.db_connected = True
        print("🚀 Database connected successfully")
    except Exception as e:
        print("STARTUP WARNING (MongoDB):", str(e))
        traceback.print_exc()

    # MCP: do not fail app startup
    try:
        await initialize_mcp_servers()
        await mcp_registry.start_all()
        mcp_instances = mcp_registry.get_all_mcp_instances()
        for name, instance in mcp_instances.items():
            app.mount(f"/mcp/{name}", instance.get_app())
        app.state.mcp_initialized = True
        print("🛡️  Security scanner modules loaded")
    except Exception as e:
        print("STARTUP WARNING (MCP):", str(e))
        traceback.print_exc()

    yield

    # Shutdown
    if getattr(app.state, "mcp_initialized", False):
        await mcp_registry.stop_all()
    if getattr(app.state, "db_connected", False):
        await close_mongo_connection()
    print("📴 Shutdown complete")

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
    prefix=f"{settings.API_V1_STR}/dataset-poisoning",
    tags=["Data Poisoning Detection"]
)
app.include_router(
    poisoning_simulation_router,
    prefix=f"{settings.API_V1_STR}/poisoning-simulation",
    tags=["Poisoning Simulation"]
)


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
    """Comprehensive health check (backward compatible). Same as readiness."""
    db_ok = await ping_mongo()
    status = "healthy" if db_ok else "degraded"
    return {
        "status": status,
        "message": "LLMShield Backend is running",
        "version": "2.0.0",
        "services": {
            "authentication": "✅ Active",
            "mfa": "✅ Active",
            "security_scanner": "✅ Active",
            "database": "✅ Connected" if db_ok else "❌ Disconnected",
        },
        "scanner_capabilities": {
            "secrets": "200+ patterns including AWS, GitHub, SSH keys",
            "cpp_vulnerabilities": "200+ dangerous functions and patterns",
            "input_methods": ["text_paste", "file_upload", "github_clone"],
            "supported_formats": [".c", ".cpp", ".h", ".py", ".js", ".env", ".json"],
        },
    }


@app.get("/health/live")
async def liveness():
    """Liveness probe: process is running. No DB check (Azure/K8s liveness)."""
    return {"status": "alive"}


@app.get("/health/ready")
async def readiness():
    """Readiness probe: app and DB are ready to accept traffic (Azure/K8s readiness)."""
    db_ok = await ping_mongo()
    if not db_ok:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": "database_unavailable"},
        )
    return {"status": "ready"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(settings.PORT),
        reload=settings.ENVIRONMENT == "development",
        log_level="info",
    )