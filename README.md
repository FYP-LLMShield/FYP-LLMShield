# FYP-LLMShield

A Unified Threat Detection Framework for Mitigating Prompt Injection, Model Poisoning, and RAG Embedding Risks.

<div align="center">
  <img src="frontend/public/images/logo.svg" alt="LLMShield Logo" width="200"/>

  **A Comprehensive AI Security Testing Platform**

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-green.svg)](https://fastapi.tiangolo.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
  [![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)

</div>

## Overview

LLMShield is a security testing platform for Large Language Models (LLMs) and AI systems. It helps detect prompt injection attacks, model poisoning, vector embedding vulnerabilities, and code security issues.

### Key Features

- **Prompt Injection Testing** — Detection of prompt injection, jailbreaks, and system prompt leaks
- **Model Poisoning Detection** — Safe vs poisoned model comparison (Llama, Qwen, TinyLlama)
- **Vector Store Analysis** — Anomaly detection, similarity collisions, trigger patterns
- **Document Embedding Inspection** — Pre-embedding poisoning pattern detection
- **Code Security Scanning** — C/C++ vulnerabilities, secret detection, CWE mapping
- **Authentication** — JWT, MFA, Google OAuth, email verification
- **Dashboard** — Security metrics, scan history, threat timeline

## Prerequisites

- **Node.js** 16+
- **Python** 3.12 or 3.13 (3.14 has compatibility issues with some packages)
- **MongoDB** (local or Atlas)
- **Git**

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/FYP-LLMShield.git
cd FYP-LLMShield
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment (use Python 3.12 or 3.13)
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your MongoDB URL and API keys
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Set REACT_APP_API_BASE_URL=http://localhost:8000
```

### 4. Run the Application

**Terminal 1 – Backend:**

```bash
cd backend
python run.py
```

API: `http://localhost:8000`

**Terminal 2 – Frontend:**

```bash
cd frontend
npm start
```

App: `http://localhost:3000`

## Environment Configuration

### Backend (.env)

```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=llmshield_db
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Optional – for LLM providers
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GROQ_API_KEY=your-groq-key

# Optional – for Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
```

### Frontend (.env)

```env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_ENVIRONMENT=development
```

## Usage

### Dashboard

After login, the dashboard shows security metrics, quick actions, and recent scans.

### Security Scanners

| Scanner               | Path                                 | Description                                                                          |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| Prompt Injection      | `/dashboard/prompt-injection`      | Test prompts and documents for injection, jailbreak, system leak                     |
| Model Poisoning       | `/dashboard/data-poisoning`        | Compare safe vs poisoned model outputs (requires GGUF models in `CompleteModels/`) |
| Vector Store Analysis | `/dashboard/vector-store-analysis` | Upload vector snapshot JSON; detect anomalies and collisions                         |
| Embedding Inspection  | `/dashboard/embedding-inspection`  | Inspect documents before embedding for poisoning patterns                            |
| Code Scanner          | `/dashboard/code-scanning`         | Scan C/C++ code and detect secrets                                                   |

### API Documentation

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Project Structure

```
FYP-LLMShield/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── core/      # Config
│   │   ├── models/    # DB models
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   └── langgraph/ # Workflows
│   ├── accuracy_evaluation/
│   ├── scripts/       # Setup, tests
│   ├── requirements.txt
│   └── run.py
├── frontend/          # React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── contexts/
│   └── package.json
├── CompleteModels/    # GGUF models (Llama, Qwen, TinyLlama)
├── samples/           # Sample data for testing
├── scripts/           # Project scripts
├── README.md          # This file
└── PROJECT_MANUAL.md  # Implementation details for developers
```

## Testing

```bash
# Backend health
curl http://localhost:8000/health

# Run backend tests
cd backend && pytest

# Run frontend tests
cd frontend && npm test
```

## Optional: Supabase (Email)

For email verification and password reset, configure Supabase. Add to `.env`:

```env
SUPABASE_DB_URL=postgresql://...
SUPABASE_PROJECT_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
```

Create `emails` and `email_verifications` tables in Supabase. See `PROJECT_MANUAL.md` for schema details. If Supabase is not configured, the app falls back to SMTP or skips email features.

## Troubleshooting

- **Python 3.14 errors** — Use Python 3.12 or 3.13
- **MongoDB connection failed** — Ensure MongoDB is running and `MONGODB_URL` is correct
- **Port in use** — Change `PORT` in backend or use a different frontend port
- **Model poisoning not loading** — Ensure `CompleteModels/` contains the GGUF model files

## License

MIT License — see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/FYP-LLMShield/issues)
- **Project details**: See [PROJECT_MANUAL.md](PROJECT_MANUAL.md) for implementation status and developer reference

---

<div align="center">
  <strong>Built for AI Security</strong>
</div>
