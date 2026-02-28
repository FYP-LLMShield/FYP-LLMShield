#!/bin/bash
# Azure App Service startup for LLMShield backend (Python)
cd /home/site/wwwroot/backend 2>/dev/null || cd /home/site/wwwroot
pip install -r requirements.txt --quiet
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
