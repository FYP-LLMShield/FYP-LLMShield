# Deploying the Frontend on Vercel

This guide makes the frontend deployment-ready for Vercel.

## 1. Vercel project setup

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. **New Project** → Import your GitHub repo **FYP-LLMShield**.
3. **Root Directory:** leave **empty** (or `.`) so the **repo-root** `vercel.json` is used. Do **not** set Root Directory to `frontend`.
4. The repo-root **`vercel.json`** defines:
   - **Install:** `cd frontend && npm install --legacy-peer-deps`
   - **Build:** `cd frontend && npx react-app-rewired build` (runs the build directly, so `sync-env` / prebuild never run).
   - **Output:** `frontend/build`
5. Deploy.

## 2. Environment variables (Vercel)

In **Project → Settings → Environment Variables**, add:

| Variable | Description | Example (production) |
|---------|-------------|----------------------|
| **`NPM_CONFIG_LEGACY_PEER_DEPS`** | **Required for install.** Set to **`true`** so `npm install` does not fail on peer dependency conflicts. | `true` |
| `REACT_APP_API_URL` | Backend API URL including `/api/v1` | `https://your-backend.vercel.app/api/v1` or your API URL |
| `REACT_APP_API_BASE_URL` | Backend base URL (no path) | `https://your-backend.vercel.app` |
| `REACT_APP_GOOGLE_CLIENT_ID` | (Optional) Google OAuth client ID | Your Google OAuth client ID |

**Important:** Add **`NPM_CONFIG_LEGACY_PEER_DEPS` = `true`** first, then redeploy. This makes npm use `--legacy-peer-deps` during install even if config is cached.

For **local dev only**, copy `frontend/.env.example` to `frontend/.env` and fill in values.

## 3. What’s already configured

- **`frontend/vercel.json`**  
  - `installCommand`: `npm install --legacy-peer-deps` (avoids peer dependency errors).  
  - `rewrites`: all routes → `index.html` (SPA routing).

- **`frontend/.npmrc`**  
  - `legacy-peer-deps=true` so installs succeed on Vercel.

- **`frontend/scripts/sync-env.js`**  
  - If root `.env` is missing (e.g. on Vercel), it no longer fails; the build uses Vercel env vars.

- **Build**  
  - `prebuild` runs `sync-env`; then `npm run build` runs. No root `.env` is required on Vercel.

## 4. After deployment

- Your site will be at `https://<project-name>.vercel.app`.
- To use your **backend** from the frontend, set `REACT_APP_API_URL` and `REACT_APP_API_BASE_URL` to your deployed backend URL and redeploy the frontend.

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| 404 on deploy | Root Directory should be **empty** so root `vercel.json` is used; output is `frontend/build`. |
| **"Root .env file not found" / prebuild fails** | Root Directory must be **empty** (not `frontend`) so the repo-root **`vercel.json`** is used. That file runs `cd frontend && npx react-app-rewired build` so `npm run build` (and prebuild/sync-env) never run. Then commit, push, and redeploy. |
| **`npm install` fails (tailwindcss-animate / peer deps)** | 1) In Vercel → **Settings → Environment Variables**, add **`NPM_CONFIG_LEGACY_PEER_DEPS`** = **`true`**. 2) Commit and push **all** frontend changes (especially `package.json`, `package-lock.json`). 3) In Vercel → **Deployments** → **⋯** on latest → **Redeploy** → check **Clear cache and redeploy**. |
| Build fails (missing .env) | No root `.env` needed on Vercel; set env vars in Vercel Project Settings. |
| API calls fail in production | Set `REACT_APP_API_URL` (and `REACT_APP_API_BASE_URL` if used) to your live backend URL. |
