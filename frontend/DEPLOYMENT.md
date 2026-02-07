# Deploying the Frontend on Vercel

This guide makes the frontend deployment-ready for Vercel.

## 1. Vercel project setup

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. **New Project** → Import your GitHub repo **FYP-LLMShield**.
3. **Root Directory:** set to **`frontend`** (required — the app lives in this folder).
4. Leave **Framework Preset** as auto (Create React App is detected).
5. **Build Command:** `npm run build` (default).
6. **Output Directory:** `build` (default for CRA).
7. Deploy.

## 2. Environment variables (Vercel)

In **Project → Settings → Environment Variables**, add:

| Variable | Description | Example (production) |
|---------|-------------|----------------------|
| `REACT_APP_API_URL` | Backend API URL including `/api/v1` | `https://your-backend.vercel.app/api/v1` or your API URL |
| `REACT_APP_API_BASE_URL` | Backend base URL (no path) | `https://your-backend.vercel.app` |
| `REACT_APP_GOOGLE_CLIENT_ID` | (Optional) Google OAuth client ID | Your Google OAuth client ID |

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
| 404 on deploy | Ensure **Root Directory** is `frontend`. |
| `npm install` fails (peer deps) | Ensure `frontend/.npmrc` has `legacy-peer-deps=true` and `vercel.json` has `installCommand: "npm install --legacy-peer-deps"`. |
| Build fails (missing .env) | No root `.env` needed on Vercel; set env vars in Vercel Project Settings. |
| API calls fail in production | Set `REACT_APP_API_URL` (and `REACT_APP_API_BASE_URL` if used) to your live backend URL. |
