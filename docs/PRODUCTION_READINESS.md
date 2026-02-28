# Production Readiness Checklist

**Short answer:** The app is **not production-ready by default**. It can be made production-ready by setting the right config and addressing the items below.

---

## ✅ What’s already in good shape

| Area | Status |
|------|--------|
| **Secrets not in repo** | `.env` is in `.gitignore`; no hardcoded credentials in code. |
| **Health probes** | `/health/live` and `/health/ready` (DB check) for orchestrators. |
| **Docker** | Dockerfile runs as non-root, has HEALTHCHECK, no reload in CMD. |
| **CORS** | Configurable via `BACKEND_CORS_ORIGINS` (env or default). |
| **Auth** | JWT, optional Supabase Auth, MFA, email verification (configurable). |
| **Password handling** | Bcrypt with 72-byte truncation; no passlib long-password crash. |
| **Startup resilience** | App starts even if MongoDB or Supabase fail; health reflects state. |

---

## ⚠️ Must fix before production

### 1. **SECRET_KEY**

- **Risk:** Default `fallback_secret_key_change_in_production` is insecure; JWTs can be forged.
- **Action:** Set a strong random value in production:
  ```bash
  # Generate (example)
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
  Set `SECRET_KEY=<that-value>` in your production env (e.g. Azure App Settings, Kubernetes secret). The app already warns at startup if `ENVIRONMENT=production` and SECRET_KEY is still the default.

### 2. **REQUIRE_EMAIL_VERIFICATION**

- **Risk:** If you left it `false` for dev/demo, unverified users can log in in production.
- **Action:** In production set `REQUIRE_EMAIL_VERIFICATION=true` (or omit; default is true). Use `false` only for dev/demo.

### 3. **CORS for production frontend**

- **Risk:** Default list is localhost-only; production frontend will be blocked.
- **Action:** Set `BACKEND_CORS_ORIGINS` to your real frontend origin(s), e.g.:
  ```env
  BACKEND_CORS_ORIGINS=https://your-app.vercel.app,https://www.yourdomain.com
  ```

### 4. **MongoDB and Supabase**

- **Risk:** Default `MONGODB_URL=mongodb://localhost:27017` is not suitable for production.
- **Action:** Use a managed MongoDB (e.g. Atlas) and set `MONGODB_URL` and `DATABASE_NAME`. If you use Supabase, set `SUPABASE_*` and (for Auth) `SUPABASE_JWT_SECRET`.

### 5. **FRONTEND_URL**

- **Risk:** Password reset and verification emails will point to `http://localhost:3000` if not set.
- **Action:** Set `FRONTEND_URL=https://your-app.vercel.app` (or your real frontend URL) in the backend env.

---

## 🔶 Recommended for production

| Item | Why |
|------|-----|
| **Rate limiting** | No global or auth-specific rate limiting yet. Add middleware or use a reverse proxy (e.g. Azure Front Door) to limit abuse and brute force. |
| **HTTPS only** | Run behind a reverse proxy (Azure App Gateway, nginx, etc.) that terminates TLS. Don’t expose the app on plain HTTP to the internet. |
| **Structured logging** | Replace `print()` with a logger and use JSON/structured logs so you can query and alert in production. |
| **ENVIRONMENT=production** | Set `ENVIRONMENT=production` so the app doesn’t use dev defaults (e.g. reload off is already in Docker CMD; this keeps config consistent). |
| **Model encryption key** | If you use encrypted model configs, set `MODEL_ENCRYPTION_KEY` to a persistent secret; otherwise a new key may be generated on restart. |

---

## Quick production env checklist

Before going live, ensure production backend has at least:

```env
ENVIRONMENT=production
SECRET_KEY=<strong-random-value>
REQUIRE_EMAIL_VERIFICATION=true
BACKEND_CORS_ORIGINS=https://your-frontend-origin
FRONTEND_URL=https://your-frontend-origin
MONGODB_URL=mongodb+srv://...
# If using Supabase Auth:
# SUPABASE_PROJECT_URL=...
# SUPABASE_SERVICE_KEY=...
# SUPABASE_ANON_KEY=...
# SUPABASE_JWT_SECRET=...
# If sending email:
# EMAIL_USERNAME=...
# EMAIL_PASSWORD=...
```

---

## Summary

- **Production-ready?** Only after you set production secrets (especially `SECRET_KEY`), CORS, `FRONTEND_URL`, DB URLs, and keep `REQUIRE_EMAIL_VERIFICATION=true`.
- **Next steps:** Add rate limiting and structured logging, run behind HTTPS, then treat as production-ready for a typical FYP/demo deployment.
