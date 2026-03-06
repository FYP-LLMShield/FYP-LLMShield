import os

# Clear proxy env vars before any app imports (Azure sets these and Supabase/httpx break with "proxy" argument)
for _k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
    os.environ.pop(_k, None)

import uvicorn
from app.main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    is_dev = os.environ.get("ENVIRONMENT", "development").lower() == "development"
    
    print(f"Starting LLMShield Backend on port {port} (is_dev={is_dev})")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=is_dev,
        log_level="info",
        proxy_headers=True,
        forwarded_allow_ips="*"
    )
