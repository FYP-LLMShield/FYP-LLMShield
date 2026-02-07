# LLMShield — Project Manual

Developer reference for implementation status, architecture, and code locations.

---

## Implementation Status

### Fully Implemented Features

| Feature                        | Status | Backend                                                                      | Frontend                                                            | Endpoints                                          |
| ------------------------------ | ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| Prompt Injection Testing       | 100%   | `app/routes/prompt_injection.py`                                           | `pages/dashboard/PromptInjectionPage.tsx`                         | `/api/v1/prompt-injection/*`                     |
| Model Poisoning Detection      | 100%   | `app/routes/data_poisoning.py`, `app/services/data_poisoning_service.py` | `pages/dashboard/ModelPoisoningPage.tsx`                          | `/api/v1/data-poisoning/*`                       |
| Vector Store Anomaly Detection | 100%   | `app/services/vector_store_analyzer.py`                                    | `pages/dashboard/VectorStoreAnalysisPage`                         | `/api/v1/prompt-injection/vector-store-analysis` |
| Code Security Scanning         | 100%   | `app/routes/scanner.py`                                                    | `pages/dashboard/CodeScannerPage.jsx`                             | `/api/v1/scan/*`                                 |
| Authentication & MFA           | 100%   | `app/routes/auth.py`, `app/routes/mfa.py`, `app/routes/profile.py`     | `components/auth/*`, `UserProfilePage.tsx`                      | `/api/v1/auth/*`                                 |
| Dashboard & Analytics          | 100%   | `app/routes/scan_history.py`                                               | `main-dashboard.tsx`, `history-page.tsx`, `settings-page.tsx` | —                                                 |
| Model Configuration            | 100%   | `app/routes/model_config.py`                                               | `ModelConfigModal.jsx`                                            | —                                                 |

| Document Embedding Inspection | 100%   | `app/routes/prompt_injection.py` (embedding-inspection, sanitize-preview, reanalyze) | `embedding-inspection-page.tsx` | `/api/v1/prompt-injection/embedding-inspection/*` |
| Vector Embedding Evaluation   | 100%   | `app/routes/vector_embedding_evaluation.py`, `app/services/vector_embedding_evaluator.py` | `vector-embedding-page.tsx` | `/api/v1/vector-embedding-evaluation/*`           |

### Feature Details

**Prompt Injection** — Multi-provider (OpenAI, Anthropic, Google, Ollama), probe categories, document upload, PDF reports, scan history.

**Model Poisoning** — Llama 3.2, TinyLlama, Qwen; GGUF via llama-cpp-python; safe vs poisoned comparison; model preload and caching.

**Vector Store Analysis** — JSON snapshot upload; distribution stats; dense clusters (DBSCAN); similarity collisions; extreme-norm outliers; trigger pattern detection; multi-tenant support.

**Code Scanner** — 200+ secret patterns; 200+ C/C++ dangerous functions; file upload and GitHub; CWE mapping; severity; PDF reports.

**Auth** — JWT, MFA (TOTP), recovery codes, Google OAuth, trusted devices, email verification, password reset.

**Document Embedding Inspection** — Upload PDF/DOCX/TXT/MD; chunking; pattern detection (instruction payloads, trigger phrases, obfuscation, repetition); sanitization preview; re-analysis after exclusions; structured remediation.

---

## Architecture

### Backend (FastAPI)

- **Database**: MongoDB with Motor
- **Auth**: JWT + bcrypt, optional Supabase for email
- **Security**: Rate limiting, CORS, input validation

### Frontend (React + TypeScript)

- **UI**: Tailwind CSS, Radix UI, Framer Motion
- **State**: React Context API
- **Routing**: React Router DOM
- **Forms**: React Hook Form + Zod

---

## Code Locations

| Component              | Path                                                       |
| ---------------------- | ---------------------------------------------------------- |
| Prompt injection logic | `backend/app/routes/prompt_injection.py`                 |
| Embedding inspection   | `EmbeddingInspector` in prompt_injection module          |
| Vector store analyzer  | `backend/app/services/vector_store_analyzer.py`          |
| Data poisoning service | `backend/app/services/data_poisoning_service.py`         |
| Code scanner           | `backend/app/routes/scanner.py`                          |
| Auth routes            | `backend/app/routes/auth.py`, `mfa.py`, `profile.py` |
| Accuracy evaluation    | `backend/accuracy_evaluation/`                           |
| Vector security tests  | `backend/scripts/test_vector_security_complete.py`       |

---

## Supabase Setup (Optional)

For email verification and password reset via Supabase:

1. Add to `.env`:

   ```
   SUPABASE_DB_URL=postgresql://...
   SUPABASE_PROJECT_URL=https://...
   SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_KEY=...
   ```
2. Create tables:

   **emails**

   ```sql
   CREATE TABLE emails (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     to_email VARCHAR(255) NOT NULL,
     subject TEXT NOT NULL,
     message TEXT NOT NULL,
     html_content TEXT,
     status VARCHAR(50) DEFAULT 'pending',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     sent_at TIMESTAMPTZ,
     error_message TEXT
   );
   ```

   **email_verifications**

   ```sql
   CREATE TABLE email_verifications (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     email VARCHAR(255) NOT NULL,
     token VARCHAR(255) NOT NULL UNIQUE,
     expires_at TIMESTAMPTZ NOT NULL,
     used BOOLEAN DEFAULT FALSE,
     verified_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

If Supabase is not configured, the app falls back to SMTP or skips email features.

---

## Model Poisoning Setup

1. Place GGUF models under `CompleteModels/`:

   - `CompleteModels/Llama3/Llama3.2_safe_model/` and `Llama3.2_poison_model/`
   - `CompleteModels/Qwen_Models/Qwen_safe_model/` and `Qwen_poison_model/`
   - `CompleteModels/TinyLlama_Models/TinyLlama_safe_model/` and `TinyLlama_poison_model/`
2. Ensure `llama-cpp-python` is installed:

   ```bash
   pip install llama-cpp-python
   ```

---

## Remaining Work

1. **Embedding Inspection** — Optional: surface structured remediation (remediation object) in UI; core remediation exists in backend.

---

## Testing

- **Backend health**: `curl http://localhost:8000/health`
- **Vector security**: `python backend/scripts/test_vector_security_complete.py`
- **Backend tests**: `cd backend && pytest`
- **Frontend tests**: `cd frontend && npm test`
