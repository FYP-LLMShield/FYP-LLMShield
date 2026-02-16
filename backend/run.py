import os
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
