# FYP-LLMShield

A unified threat detection platform for mitigating prompt injection, model poisoning, and RAG embedding risks in LLM and AI systems.

<div align="center">
  <img src="frontend/public/images/logo.svg" alt="LLMShield Logo" width="200"/>

  **AI Security Testing Platform — Production Ready**

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-green.svg)](https://fastapi.tiangolo.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
  [![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://www.python.org/)

</div>

## Overview

LLMShield helps security teams and developers test and harden AI applications. It detects prompt injection and jailbreaks, analyzes vector stores and document embeddings for poisoning, scans code for secrets and C/C++ vulnerabilities, and supports dataset/model poisoning evaluation—all from a single dashboard with optional MFA and email verification.

### Key Features

- **Prompt Injection Testing** — Multi-provider (OpenAI, Anthropic, Google, Ollama); probe categories, document upload, PDF reports
- **Model Poisoning** — Safe vs poisoned model comparison (GGUF: Llama, Qwen, TinyLlama)
- **Vector Security** — Document embedding inspection, vector store anomaly detection, retrieval attack simulation (single dashboard with three tabs)
- **Code Security Scanning** — 200+ secret patterns, C/C++ vulnerability checks, file upload and GitHub repo scanning, CWE mapping
- **Dataset Poisoning** — Analyze text/file datasets and Hugging Face JSONL for poisoning indicators
- **Authentication** — JWT, MFA (TOTP), recovery codes, Google OAuth, email verification, password reset
- **Dashboard** — Security metrics, scan history, RAG chatbot, profile and settings

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

| Scanner            | Path                                 | Description                                                                 |
| ------------------ | ------------------------------------ | --------------------------------------------------------------------------- |
| Prompt Injection   | `/dashboard/prompt-injection`       | Test prompts and documents for injection, jailbreak, system leak            |
| Model Poisoning    | `/dashboard/model-poisoning`        | Compare safe vs poisoned GGUF models (place models in `CompleteModels/`)    |
| Vector Security    | `/dashboard/vector-security`        | Three tabs: Document Inspection, Anomaly Detection, Attack Simulation       |
| Code Scanning      | `/dashboard/code-scanning`         | Scan C/C++ and other code for secrets and vulnerabilities                  |
| Data Poisoning     | `/dashboard/data-poisoning`        | Dataset and Hugging Face model poisoning analysis                           |
| Chatbot            | `/dashboard/chatbot`                | RAG chatbot with optional vector store (e.g. Qdrant)                        |
| History & Settings | `/dashboard/history`, `/dashboard/settings` | Scan history, MFA, profile                                                |

### API Documentation

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Project Structure

```
FYP-LLMShield/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── core/      # Config, database
│   │   ├── models/    # Pydantic/DB models
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   └── utils/     # Auth, email, MFA, etc.
│   ├── scripts/       # Setup and utilities (Supabase, vector DB, etc.)
│   ├── requirements.txt
│   └── run.py
├── frontend/          # React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── contexts/
│   └── package.json
├── CompleteModels/    # Optional: GGUF models for model poisoning
├── samples/           # Optional: sample files for demos
├── README.md          # This file (user-facing)
└── docs/PROJECT_MANUAL.md  # Developer reference (implementation details)
```

## Verifying the Setup

```bash
# Backend health (includes database check)
curl http://localhost:8000/health

# Optional: run backend test suite if present
cd backend && pytest

# Optional: run frontend tests
cd frontend && npm test
```

## Run with Docker (local pre-deploy check)

To verify the app runs without "Application error" before deploying, run the full stack in Docker:

**Full stack (backend + frontend + MongoDB):**

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

- **Frontend:** http://localhost  
- **Backend API:** http://localhost:8000  
- **Health:** `curl http://localhost:8000/health` and `curl http://localhost:8000/health/ready`

**Backend + frontend only** (MongoDB on host): ensure `backend/.env` has `MONGODB_URL` (e.g. `mongodb://host.docker.internal:27017` on Docker Desktop), then:

```bash
docker compose up --build
```

For a **pre-deploy checklist** and troubleshooting, see **[docs/DEPLOY_CHECK.md](docs/DEPLOY_CHECK.md)**.

## Optional: Supabase (Email & Auth)

For email verification and password reset, set Supabase env vars in `.env` (`SUPABASE_PROJECT_URL`, `SUPABASE_SERVICE_KEY`, etc.) and create the required tables. Full schema and setup steps are in **docs/PROJECT_MANUAL.md**. Without Supabase, the app can use SMTP or skip email-dependent features.

## Troubleshooting

- **Python 3.14 errors** — Use Python 3.12 or 3.13
- **MongoDB connection failed** — Ensure MongoDB is running and `MONGODB_URL` is correct
- **Port in use** — Change `PORT` in backend or use a different frontend port
- **Model poisoning not loading** — Place GGUF safe/poison model pairs in `CompleteModels/` (see docs/PROJECT_MANUAL.md)
- **Vector / embedding features** — Use the **Vector Security** dashboard at `/dashboard/vector-security` (Document Inspection, Anomaly Detection, Attack Simulation)

## License

MIT License — see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/FYP-LLMShield/issues)
- **Developers**: See [docs/PROJECT_MANUAL.md](docs/PROJECT_MANUAL.md) for architecture, module implementation details, code references, and configuration.

---

<div align="center">
  <strong>Built for AI Security</strong>
</div>
