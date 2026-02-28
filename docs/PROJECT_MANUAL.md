# LLMShield — Developer Project Manual

Comprehensive reference for developers: architecture, module implementation details, code locations, and configuration.

---

## 1. Project Overview

**LLMShield** is a unified threat detection framework for mitigating:
- Prompt injection and jailbreak attacks
- Model/data poisoning
- RAG embedding and retrieval risks
- Code security (secrets, C/C++ vulnerabilities)

**Stack:** FastAPI (backend), React + TypeScript (frontend), MongoDB, optional Supabase for email/auth.

---

## 2. Backend Architecture

### 2.1 Entry Point and Router Registration

**File:** `backend/app/main.py`

The FastAPI app wires all routers under `/api/v1` and runs lifespan (MongoDB connect, MCP init, shutdown).

```python
# Router registration (excerpt)
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(mfa_router, prefix=f"{settings.API_V1_STR}/auth/mfa", tags=["Multi-Factor Authentication"])
app.include_router(email_verification_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Email Verification"])
app.include_router(scanner_router, prefix=f"{settings.API_V1_STR}/scan", tags=["Security Scanner"])
app.include_router(hybrid_scanner_router, prefix=f"{settings.API_V1_STR}/hybrid-scan", tags=["Hybrid Scanner (Regex + LLM)"])
app.include_router(scan_history_router, prefix=f"{settings.API_V1_STR}", tags=["Scan History"])
app.include_router(model_config_router, prefix=f"{settings.API_V1_STR}/model-config", tags=["Model Configuration"])
app.include_router(profile_router, prefix=f"{settings.API_V1_STR}/profiles", tags=["Profile Management"])
app.include_router(prompt_injection_router, prefix=f"{settings.API_V1_STR}/prompt-injection", tags=["Prompt Injection Testing"])
app.include_router(data_poisoning_router, prefix=f"{settings.API_V1_STR}/dataset-poisoning", tags=["Data Poisoning Detection"])
app.include_router(poisoning_simulation_router, prefix=f"{settings.API_V1_STR}/poisoning-simulation", tags=["Poisoning Simulation"])
app.include_router(chatbot_router, prefix=f"{settings.API_V1_STR}/chatbot", tags=["RAG Chatbot"])
```

**Reference:** `backend/app/main.py` (lines 117–181)

### 2.2 Configuration

**File:** `backend/app/core/config.py`

Settings loaded from `.env` (repo root and `backend/`). Key fields:

```python
class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "llmshield_db"
    SECRET_KEY: str  # JWT
    API_V1_STR: str = "/api/v1"
    # Optional: OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, HUGGINGFACE_API_KEY
    # Qdrant: QDRANT_HOST, QDRANT_PORT, QDRANT_API_KEY
    # Supabase: SUPABASE_* for email/auth
    # FRONTEND_URL, REQUIRE_EMAIL_VERIFICATION
```

**Reference:** `backend/app/core/config.py`

### 2.3 Database

**File:** `backend/app/core/database.py`

MongoDB via Motor (async). Single client and database instance.

```python
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

class MongoDB:
    client: AsyncIOMotorClient = None
    database: AsyncIOMotorDatabase = None

mongodb = MongoDB()

async def connect_to_mongo():
    mongodb.client = AsyncIOMotorClient(settings.MONGODB_URL)
    mongodb.database = mongodb.client[settings.DATABASE_NAME]

async def get_database() -> AsyncIOMotorDatabase:
    return mongodb.database

async def ping_mongo() -> bool:
    # Used for /health/ready and /health
```

**Reference:** `backend/app/core/database.py`

---

## 3. Module Implementation Details

### 3.1 Authentication

**Routes:** `backend/app/routes/auth.py`  
**Utils:** `backend/app/utils/auth.py`, `backend/app/utils/user_service.py`, `backend/app/utils/unified_user_service.py`

- **Register:** `POST /api/v1/auth/register` — dual-write (MongoDB + optional Supabase), email verification token, optional verification email.
- **Login:** `POST /api/v1/auth/login` — authenticate via `unified_user_service`, optional MFA; returns access + refresh JWT.
- **Refresh:** `POST /api/v1/auth/refresh` — refresh token.
- **Google OAuth:** `POST /api/v1/auth/google` — Google sign-in; user created/fetched via `GoogleAuthService`.

```python
# auth.py - register (excerpt)
user, is_from_supabase = await unified_user_service.create_user(user_data)
# Send verification email if EmailConfig is configured
verification_link = f"{settings.FRONTEND_URL.rstrip('/')}/auth?verify=1&token={verification_token}"
await email_service.send_verification_link_email(...)
```

**Reference:** `backend/app/routes/auth.py` (lines 22–84)

### 3.2 MFA (TOTP)

**Routes:** `backend/app/routes/mfa.py`  
**Utils:** `backend/app/utils/mfa.py`

- Setup TOTP, verify code, recovery codes, trusted devices.
- Endpoints under `POST /api/v1/auth/mfa/*` (e.g. setup, verify, recovery-codes).

**Reference:** `backend/app/routes/mfa.py`, `backend/app/utils/mfa.py`

### 3.3 Prompt Injection Testing

**Routes:** `backend/app/routes/prompt_injection.py`  
**Service:** `backend/app/services/prompt_injection_detector.py`  
**Frontend:** `frontend/src/components/pages/prompt-injection-page.tsx` → route `/dashboard/prompt-injection`

Features:
- Multi-provider (OpenAI, Anthropic, Google, Ollama, custom).
- Probe categories: prompt_injection, jailbreak.
- Custom prompts, perturbations, document upload (PDF/DOCX/TXT/MD).
- Robust detection: `PromptInjectionDetector`, `TextNormalizer`, `detect_injection()` with Unicode normalization, leetspeak, pattern matching.

```python
# prompt_injection_detector.py - DetectionResult
@dataclass
class DetectionResult:
    is_malicious: bool
    confidence: float  # 0.0 to 1.0
    category: Optional[AttackCategory] = None
    matched_patterns: List[str] = field(default_factory=list)
    risk_level: str = "low"
    details: Dict = field(default_factory=dict)
```

Key endpoints (all under `/api/v1/prompt-injection`):
- `POST /detect` — robust text detection.
- `POST /scan-document` — document scan (extract text, then detect).
- `POST /test` — run test with model config.
- `POST /benchmark` — multi-model benchmark.
- `POST /vector-store-analysis` — vector store snapshot analysis.
- `POST /embedding-inspection` — document embedding inspection (pre-embedding poisoning patterns).
- `POST /embedding-inspection/sanitize-preview`, `POST /embedding-inspection/reanalyze`, export endpoints.
- `POST /retrieval-attack-simulation` — retrieval attack simulation; export under `/retrieval-attack-simulation/export`.

**Reference:** `backend/app/routes/prompt_injection.py`, `backend/app/services/prompt_injection_detector.py`

### 3.4 Document Embedding Inspection

**Routes:** Same as prompt injection: `backend/app/routes/prompt_injection.py`  
**Frontend:** `frontend/src/components/pages/embedding-inspection-page.tsx` (inside Vector Security tab “Document Inspection”)

Flow:
1. Upload PDF/DOCX/TXT/MD.
2. Chunking and pattern detection (instruction payloads, trigger phrases, obfuscation, repetition).
3. Sanitization preview and re-analysis after exclusions.
4. Export inspection report or sanitized document.

API:
- `POST /api/v1/prompt-injection/embedding-inspection`
- `POST /api/v1/prompt-injection/embedding-inspection/sanitize-preview`
- `POST /api/v1/prompt-injection/embedding-inspection/reanalyze`
- `POST /api/v1/prompt-injection/embedding-inspection/export` and `.../export-sanitized`

**Reference:** `backend/app/routes/prompt_injection.py` (embedding-inspection endpoints ~2942–3608)

### 3.5 Vector Store Analysis

**Service:** `backend/app/services/vector_store_analyzer.py`  
**Routes:** `backend/app/routes/prompt_injection.py` (vector-store-analysis endpoints)  
**Frontend:** `frontend/src/components/pages/vector-store-analysis-page.tsx` (Vector Security → “Anomaly Detection”)

`VectorStoreAnomalyDetector`:
- Distribution stats (norms, density, collision rates).
- Dense clusters (DBSCAN): unrelated sources/tenants.
- High-similarity collisions across labels/topics.
- Extreme-norm/outlier vectors (Z-score).
- Trigger/instruction patterns (regex lists aligned with EmbeddingInspector).

```python
# vector_store_analyzer.py - class init
def __init__(self, collision_threshold=0.95, outlier_z_threshold=3.0, cluster_eps=0.3, min_samples=3):
    self.collision_threshold = collision_threshold
    self.outlier_z_threshold = outlier_z_threshold
    self.cluster_eps = cluster_eps
    self.min_samples = min_samples
    # instruction_patterns, trigger_phrases, obfuscation_patterns
```

API:
- `POST /api/v1/prompt-injection/vector-store-analysis` — single snapshot upload.
- `POST /api/v1/prompt-injection/vector-store-analysis-multi-source` — multi-source.

**Reference:** `backend/app/services/vector_store_analyzer.py`, `backend/app/routes/prompt_injection.py` (~3817–4450)

### 3.6 Retrieval Attack Simulation

**Service:** `backend/app/services/retrieval_attack_service.py`  
**Routes:** `backend/app/routes/prompt_injection.py`  
**Frontend:** `frontend/src/components/pages/retrieval-attack-page.tsx` (Vector Security → “Attack Simulation”)

Features:
- Query perturbation: paraphrase, unicode, homoglyph, trigger, leetspeak.
- Baseline vs adversarial retrieval comparison.
- Ranking analysis and optional LLM inference for behavioral impact.

```python
# retrieval_attack_service.py - dataclasses
@dataclass
class RetrievalResult:
    query: str
    query_type: str  # "baseline" or perturbation type
    top_k_ids: List[str]
    top_k_scores: List[float]
    top_k_metadata: List[Dict[str, Any]]

@dataclass
class ManipulationFinding:
    query: str
    variant_type: str
    target_vector_id: str
    baseline_rank: Optional[int]
    adversarial_rank: int
    rank_shift: int
    ...
```

API:
- `POST /api/v1/prompt-injection/retrieval-attack-simulation` — JSON snapshot + queries + config.
- `POST /api/v1/prompt-injection/retrieval-attack-simulation/export`

**Reference:** `backend/app/services/retrieval_attack_service.py`, `backend/app/routes/prompt_injection.py` (~5017–5405)

### 3.7 Vector Security (Frontend Consolidation)

**Frontend:** `frontend/src/components/pages/vector-security-page.tsx`  
**Route:** `/dashboard/vector-security` (with redirect from `/dashboard/vector-embedding`)

Single page with three tabs:
1. **Document Inspection** — `EmbeddingInspectionPage` (embedding-inspection API).
2. **Anomaly Detection** — `VectorStoreAnalysisPage` (vector-store-analysis API).
3. **Attack Simulation** — `RetrievalAttackPage` (retrieval-attack-simulation API).

**Reference:** `frontend/src/components/pages/vector-security-page.tsx`, `frontend/src/App.tsx` (routes)

### 3.8 Model / Data Poisoning

**Routes (model poisoning):** `backend/app/routes/data_poisoning.py` (legacy/behavioral) — see also dataset poisoning below.  
**Services:** `backend/app/services/data_poisoning_service.py` (Hugging Face model scan: file-level + behavioral), `backend/app/utils/gguf_model_loader.py`, `backend/app/utils/local_model_loader.py` for GGUF.  
**Frontend:** `frontend/src/components/pages/model-poisoning-page.tsx`, `frontend/src/components/pages/data-poisoning-page.tsx`

**Dataset poisoning:**  
**Routes:** `backend/app/routes/data_poisoning.py` (dataset-poisoning)  
**Service:** `backend/app/services/dataset_poisoning_service.py`  
**Models:** `backend/app/models/dataset_poisoning.py`

```python
# data_poisoning_service.py - DataPoisoningScanner.scan_model
async def scan_model(self, model_url, max_download_size_gb=5.0, run_behavioral_tests=True, timeout_seconds=300) -> ScanResult:
    file_safety = await self._check_file_safety(model_url)
    behavioral_tests = await self._run_behavioral_tests(model_id) if run_behavioral_tests else []
    risk_assessment = self._assess_risk(file_safety, behavioral_tests)
    verdict, explanation, confidence = self._generate_verdict(...)
    return ScanResult(scan_id=..., verdict=verdict, ...)
```

API (dataset poisoning):
- `POST /api/v1/dataset-poisoning/analyze/text`, `POST /api/v1/dataset-poisoning/analyze/file`
- `POST /api/v1/dataset-poisoning/list/huggingface` (and related)

**Reference:** `backend/app/routes/data_poisoning.py`, `backend/app/services/data_poisoning_service.py`, `backend/app/services/dataset_poisoning_service.py`

### 3.9 Code Security Scanner

**Routes:** `backend/app/routes/scanner.py`  
**Frontend:** `frontend/src/components/pages/code-scanning-page.tsx`, `frontend/src/pages/dashboard/CodeScannerPage.jsx`  
**Route:** `/dashboard/code-scanning`

Features:
- 200+ secret patterns (AWS, API keys, SSH, etc.).
- 200+ C/C++ dangerous functions and patterns.
- Input: text paste, file upload, GitHub repo (with cache).
- CWE mapping, severity, PDF reports, scan history.

```python
# scanner.py - request models
class TextScanRequest(BaseModel):
    content: str
    filename: Optional[str] = "<paste>"
    scan_types: List[str] = ["secrets", "cpp_vulns"]

class RepoScanRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None
    subdir: Optional[str] = None
    token: Optional[str] = None
    scan_types: List[str] = ["secrets", "cpp_vulns"]
    max_file_size_mb: Optional[float] = 1.0
    max_files: Optional[int] = 500
    use_cache: Optional[bool] = True
```

API prefix: `/api/v1/scan` (e.g. text scan, file upload, GitHub repo).

**Reference:** `backend/app/routes/scanner.py` (lines 89–120, and scan handlers)

### 3.10 Hybrid Scanner (Regex + LLM)

**Routes:** `backend/app/routes/hybrid_scanner.py`  
**Prefix:** `/api/v1/hybrid-scan`

Combines regex-based and LLM-based checks for security scanning.

**Reference:** `backend/app/routes/hybrid_scanner.py`

### 3.11 Scan History

**Routes:** `backend/app/routes/scan_history.py`  
**Service:** `backend/app/services/scan_history_service.py`  
**Frontend:** `frontend/src/components/pages/history-page.tsx`  
**Route:** `/dashboard/history`

Save and list scans (e.g. prompt injection, code scanner) with optional filters.

**Reference:** `backend/app/routes/scan_history.py`, `backend/app/services/scan_history_service.py`

### 3.12 Model Configuration

**Routes:** `backend/app/routes/model_config.py`  
**Service:** `backend/app/services/model_config_service.py`  
**Frontend:** `frontend/src/components/dashboard/ModelConfigModal.jsx`

CRUD for model configs (provider, model_id, base_url, etc.); optional encryption via `MODEL_ENCRYPTION_KEY`.

**Reference:** `backend/app/routes/model_config.py`, `backend/app/config/model_config.py`

### 3.13 Profile Management

**Routes:** `backend/app/routes/profile.py`  
**Service:** `backend/app/services/profile_service.py`  
**Frontend:** `frontend/src/pages/dashboard/UserProfilePage.jsx`  
**Route:** `/dashboard/profile`

Update user profile (name, etc.). Uses `get_current_user` for auth.

**Reference:** `backend/app/routes/profile.py`

### 3.14 Poisoning Simulation

**Routes:** `backend/app/routes/poisoning_simulation.py`  
**Prefix:** `/api/v1/poisoning-simulation`

Simulation endpoints for poisoning scenarios (attack simulator, etc.).

**Reference:** `backend/app/routes/poisoning_simulation.py`, `backend/app/services/attack_simulator.py`, `backend/app/services/poisoning_simulator_service.py`

### 3.15 RAG Chatbot

**Routes:** `backend/app/routes/chatbot.py`  
**Service:** `backend/app/services/chatbot_service.py`, `backend/app/services/conversation_service.py`  
**Frontend:** `frontend/src/components/pages/chatbot-page.tsx`  
**Route:** `/dashboard/chatbot`

RAG-based conversation with optional vector store (e.g. Qdrant). Uses `backend/app/services/qdrant_service.py`, `backend/app/services/vector_db_connectors.py` if configured.

**Reference:** `backend/app/routes/chatbot.py`, `backend/app/services/chatbot_service.py`

---

## 4. Frontend Structure

### 4.1 Routing

**File:** `frontend/src/App.tsx`

- Public: `/`, `/auth`, `/login`, `/signup`, `/reset-password`, `/pricing`, `/use-cases`, `/services`, `/about`, `/contact`.
- Dashboard (protected): `/dashboard`, `/dashboard/profile`, `/dashboard/prompt-injection`, `/dashboard/model-poisoning`, `/dashboard/vector-security`, `/dashboard/vector-embedding` → redirect to `/dashboard/vector-security`, `/dashboard/code-scanning`, `/dashboard/data-poisoning`, `/dashboard/chatbot`, `/dashboard/history`, `/dashboard/settings`, `/dashboard/mfa`.

### 4.2 Key Pages and Components

| Feature | Route | Main component(s) |
|--------|--------|-------------------|
| Dashboard | `/dashboard` | `MainDashboard` |
| Prompt injection | `/dashboard/prompt-injection` | `PromptInjectionPage` |
| Model poisoning | `/dashboard/model-poisoning` | `ModelPoisoningPage` |
| Vector security | `/dashboard/vector-security` | `VectorSecurityPage` (tabs: EmbeddingInspectionPage, VectorStoreAnalysisPage, RetrievalAttackPage) |
| Code scanning | `/dashboard/code-scanning` | `CodeScannerPage` |
| Data poisoning | `/dashboard/data-poisoning` | `DataPoisoningPage` |
| Chatbot | `/dashboard/chatbot` | `ChatbotPage` |
| History | `/dashboard/history` | `HistoryPage` |
| Settings | `/dashboard/settings` | `SettingsPage` |
| MFA | `/dashboard/mfa` | `MFASettingsPage` |
| Profile | `/dashboard/profile` | `UserProfilePage` |

**Reference:** `frontend/src/App.tsx`, `frontend/src/components/pages/vector-security-page.tsx`

### 4.3 Auth and API

- **Auth:** `frontend/src/contexts/AuthContext.jsx`, `frontend/src/contexts/AuthStateContext.tsx`, `ProtectedRoute` in `frontend/src/components/auth/ProtectedRoute.jsx`.
- **API base:** `frontend/src/lib/api.ts` (or equivalent) — base URL from env (e.g. `REACT_APP_API_BASE_URL`, `REACT_APP_API_URL`).

---

## 5. Optional: Supabase (Email / Auth)

For email verification and password reset:

1. Set in `.env`: `SUPABASE_DB_URL`, `SUPABASE_PROJECT_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET` (for JWT verification).
2. Create tables in Supabase (e.g. `emails`, `email_verifications`, `users` as per project schema). See existing SQL in `backend/scripts/supabase_setup.sql`, `backend/scripts/supabase_users_table.sql` if present.

If Supabase is not configured, the app falls back to SMTP or skips email features. Health: `GET /health/supabase`.

---

## 6. Optional: Model Poisoning (GGUF)

For local model poisoning comparison:

1. Place GGUF models under `CompleteModels/` (e.g. Llama, Qwen, TinyLlama safe/poison pairs).
2. Install: `pip install llama-cpp-python`.
3. Backend uses `backend/app/utils/gguf_model_loader.py` and `backend/app/utils/local_model_loader.py` for loading.

---

## 7. File Reference Summary

| Component | Backend | Frontend |
|-----------|---------|----------|
| App entry / routers | `app/main.py` | `src/App.tsx` |
| Config | `app/core/config.py` | — |
| Database | `app/core/database.py` | — |
| Auth | `app/routes/auth.py`, `app/utils/auth.py`, `app/utils/unified_user_service.py` | `contexts/AuthContext.jsx`, `components/auth/` |
| MFA | `app/routes/mfa.py`, `app/utils/mfa.py` | `pages/dashboard/MFASettingsPage.jsx`, TOTP/RecoveryCodes |
| Prompt injection | `app/routes/prompt_injection.py`, `app/services/prompt_injection_detector.py` | `components/pages/prompt-injection-page.tsx` |
| Embedding inspection | `app/routes/prompt_injection.py` (embedding-inspection*) | `components/pages/embedding-inspection-page.tsx` |
| Vector store analysis | `app/services/vector_store_analyzer.py`, `app/routes/prompt_injection.py` | `components/pages/vector-store-analysis-page.tsx` |
| Retrieval attack | `app/services/retrieval_attack_service.py`, `app/routes/prompt_injection.py` | `components/pages/retrieval-attack-page.tsx` |
| Vector security UI | — | `components/pages/vector-security-page.tsx` |
| Data/dataset poisoning | `app/routes/data_poisoning.py`, `app/services/data_poisoning_service.py`, `app/services/dataset_poisoning_service.py` | `components/pages/data-poisoning-page.tsx`, `model-poisoning-page.tsx` |
| Code scanner | `app/routes/scanner.py` | `components/pages/code-scanning-page.tsx`, `pages/dashboard/CodeScannerPage.jsx` |
| Hybrid scanner | `app/routes/hybrid_scanner.py` | — |
| Scan history | `app/routes/scan_history.py`, `app/services/scan_history_service.py` | `components/pages/history-page.tsx` |
| Model config | `app/routes/model_config.py`, `app/services/model_config_service.py` | `components/dashboard/ModelConfigModal.jsx` |
| Profile | `app/routes/profile.py`, `app/services/profile_service.py` | `pages/dashboard/UserProfilePage.jsx` |
| Chatbot | `app/routes/chatbot.py`, `app/services/chatbot_service.py` | `components/pages/chatbot-page.tsx` |

---

## 8. Health and Deployment

- **Health:** `GET /health` (includes DB), `GET /health/live`, `GET /health/ready`, `GET /health/supabase`.
- **Run backend:** From `backend/`: `python run.py` (or `uvicorn app.main:app`).
- **Run frontend:** From `frontend/`: `npm start` (dev), `npm run build` (production).
- **API docs:** `http://localhost:8000/docs` (Swagger), `http://localhost:8000/redoc` (ReDoc).

---

*Last updated for production-ready codebase. Remove or adapt scripts in `backend/scripts/` and `scripts/` that are for demo or testing only.*
