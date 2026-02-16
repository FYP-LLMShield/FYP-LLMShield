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


import logging
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    import traceback
    app.state.db_connected = False
    app.state.mcp_initialized = False

    logger.info(f"🚀 Starting LLMShield Backend (Port: {settings.PORT}, Env: {settings.ENVIRONMENT})")

    # MongoDB
    try:
        await connect_to_mongo()
        app.state.db_connected = True
        logger.info("🚀 Database connected successfully")
    except Exception as e:
        logger.error(f"STARTUP ERROR (MongoDB): {e}")
        traceback.print_exc()

    # Supabase diagnostics
    try:
        from app.utils.supabase_client import supabase_service
        if supabase_service.is_available():
            logger.info("✅ Supabase: enabled (users synced to Supabase + MongoDB)")
        else:
            logger.warning("⚠️ Supabase: disabled (set SUPABASE_PROJECT_URL and SUPABASE_SERVICE_KEY in .env)")
    except Exception as e:
        logger.error(f"⚠️ Supabase: check failed: {e}")

    # Email diagnostics
    try:
        from app.utils.email_service import EmailConfig
        if EmailConfig.is_configured():
            logger.info("✅ Email: configured (verification and password-reset enabled)")
        else:
            logger.warning("⚠️ Email: not configured (set EMAIL_USERNAME and EMAIL_PASSWORD in .env)")
    except Exception as e:
        logger.error(f"⚠️ Email: check failed: {e}")

    # MCP servers
    try:
        await initialize_mcp_servers()
        await mcp_registry.start_all()
        mcp_instances = mcp_registry.get_all_mcp_instances()
        for name, instance in mcp_instances.items():
            app.mount(f"/mcp/{name}", instance.get_app())
        app.state.mcp_initialized = True
        logger.info("🛡️ Security scanner modules loaded")
    except Exception as e:
        logger.error(f"STARTUP ERROR (MCP): {e}")
        traceback.print_exc()

    yield

    # Shutdown
    if getattr(app.state, "mcp_initialized", False):
        await mcp_registry.stop_all()
    if getattr(app.state, "db_connected", False):
        await close_mongo_connection()
    logger.info("📴 Shutdown complete")


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


@app.get("/health/supabase")
async def health_supabase():
    """
    Check Supabase connectivity and users table access.
    supabase_auth_primary: when True, frontend can try Supabase Auth first and use backend as fallback.
    """
    from app.core.config import settings
    db_configured = bool(settings.SUPABASE_PROJECT_URL and settings.SUPABASE_SERVICE_KEY)
    auth_configured = bool(settings.SUPABASE_PROJECT_URL and settings.SUPABASE_ANON_KEY and settings.SUPABASE_JWT_SECRET)
    out = {
        "supabase_configured": db_configured,
        "supabase_auth_primary": auth_configured,
        "supabase_reachable": False,
        "message": "",
    }
    if not db_configured:
        out["message"] = "Set SUPABASE_PROJECT_URL and SUPABASE_SERVICE_KEY in .env (use service_role key, not anon)."
        return out
    try:
        from app.utils.supabase_client import supabase_service
        if not supabase_service.is_available():
            out["message"] = "Supabase client failed to initialize (check URL and key)."
            return out
        result = supabase_service.get_client().table("users").select("id").limit(1).execute()
        out["supabase_reachable"] = True
        out["message"] = "Supabase users table is reachable."
        if auth_configured:
            out["message"] += " Supabase Auth is primary; backend auth is used when Supabase is unavailable."
    except Exception as e:
        out["message"] = str(e)
        out["error_detail"] = getattr(e, "details", None) or getattr(e, "message", None)
    return out


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(settings.PORT),
        reload=settings.ENVIRONMENT == "development",
        log_level="info",
    )