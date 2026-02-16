# Deploying the Frontend on Vercel (Option B)

Use this setup for a reliable build.

## 1. Vercel project settings

1. Go to [vercel.com](https://vercel.com) → your project **fyp-llmshield**.
2. **Settings → General**
3. Set **Root Directory** to **`frontend`** (not empty).
   - Click **Edit** next to Root Directory, enter `frontend`, save.
4. Do **not** override Build Command or Install Command in the UI (use `frontend/vercel.json`).

So Vercel will:
- Use **`frontend/`** as the project root.
- Run **Install:** `npm install --legacy-peer-deps`
- Run **Build:** `npm run build` (runs `ensure-lib-utils.js` then `build.js`, which sets `DISABLE_ESLINT_PLUGIN=true` and runs the build so ESLint doesn’t fail the deploy)
- Use **Output:** `build`

## 2. Environment variables (Vercel)

In **Project → Settings → Environment Variables**, add:

| Variable | Description | Example |
|----------|-------------|---------|
| **`NPM_CONFIG_LEGACY_PEER_DEPS`** | Set to `true` so install succeeds. | `true` |
| **`DISABLE_ESLINT_PLUGIN`** | (Optional) Set to `true` if build still fails on ESLint; the build script already sets this. | `true` |
| `REACT_APP_API_URL` | Backend API URL including `/api/v1` | `https://your-backend.vercel.app/api/v1` |
| `REACT_APP_API_BASE_URL` | Backend base URL | `https://your-backend.vercel.app` |
| `REACT_APP_GOOGLE_CLIENT_ID` | (Optional) Google OAuth client ID | Your client ID |

## 3. Why Root Directory = `frontend` fixes the build

- When Root is **empty**, Vercel uses the repo root and often runs `cd frontend && npx react-app-rewired build`, which **skips** `npm run build` and thus **skips** `ensure-lib-utils.js`. So `src/lib/utils.ts` is never created if it’s missing, and you get **"Can't resolve '../../lib/utils'"**.
- When Root is **`frontend`**, Vercel’s build runs **`npm run build`** from the `frontend` folder. That runs `node scripts/ensure-lib-utils.js` first (creating `src/lib/utils.ts` if missing), then `react-app-rewired build`. So the `../../lib/utils` import always resolves.

## 4. After deployment

- Site: `https://<project-name>.vercel.app`
- To use your backend, set `REACT_APP_API_URL` and `REACT_APP_API_BASE_URL` to your backend URL and redeploy.

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| **"Can't resolve '../../lib/utils'"** | Set **Root Directory** to **`frontend`** in Vercel, then redeploy (with **Clear cache and redeploy** if needed). |
| **`npm install` fails (peer deps)** | Add **`NPM_CONFIG_LEGACY_PEER_DEPS`** = **`true`** in Vercel env vars; redeploy with cache clear. |
| **404 on routes** | `frontend/vercel.json` has SPA rewrites; with Root = `frontend` they apply automatically. |
