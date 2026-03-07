# Pre-deploy checklist & running Docker locally

Use this to confirm the project is ready for deployment and to avoid "Application error" or runtime failures.

---

## 1. Pre-deploy checklist (no Docker)

Run these **before** deploying to catch config and build issues.

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

- **Environment**: Copy `backend\.env.example` to `backend\.env` and set at least:
  - `MONGODB_URL` (e.g. `mongodb://localhost:27017` or your Atlas URL)
  - `SECRET_KEY` (change from default in production)
  - `DATABASE_NAME=llmshield_db`
- **MongoDB**: Must be running and reachable, or the app will report "database_unavailable" on `/health/ready`.

```powershell
# Start backend (with MongoDB running)
python run.py
```

In another terminal:

```powershell
# Health check (should return status "healthy" and database "Connected")
curl http://localhost:8000/health
curl http://localhost:8000/health/ready
```

- If `/health` returns `"database": "❌ Disconnected"` or `/health/ready` returns 503, fix `MONGODB_URL` and MongoDB availability before deploying.

### Frontend

```powershell
cd frontend
npm install
cp .env.example .env
# Set REACT_APP_API_URL and REACT_APP_API_BASE_URL to your backend URL (e.g. http://localhost:8000)
npm run build
```

- If `npm run build` fails, fix TypeScript/ESLint errors before deploying.
- For production builds, set `REACT_APP_API_URL` and `REACT_APP_API_BASE_URL` to the **deployed** backend URL so the built app talks to the right API.

### Optional tests

```powershell
cd backend && pytest
cd frontend && npm test
```

---

## 2. Run Docker containers locally

Docker lets you run the full stack (and optionally MongoDB) to mimic deployment and avoid "Application error" from missing DB or wrong URLs.

### Option A: Full stack with MongoDB in Docker (recommended for local check)

Backend, frontend, and MongoDB all run in containers. No need for a local MongoDB install.

**One-time setup**

1. Ensure **Docker Desktop** (or Docker Engine + Compose) is installed and running.
2. Create a minimal `backend\.env` if you don’t have one (e.g. copy from `backend\.env.example`). For this setup you can leave `MONGODB_URL` unset in `.env`; the compose file will override it.

**Run**

From the **project root** (where `docker-compose.yml` and `docker-compose.local.yml` are):

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

- First run may take a few minutes (build + MongoDB start).
- Backend uses `MONGODB_URL=mongodb://mongodb:27017` and waits for MongoDB to be healthy.
- Frontend is built with default API URL `http://localhost:8000` (correct when you open the app at `http://localhost`).

**URLs**

- Frontend: **http://localhost** (port 80)
- Backend API: **http://localhost:8000**
- API docs: **http://localhost:8000/docs**
- Health: **http://localhost:8000/health** and **http://localhost:8000/health/ready**

**Verify**

```powershell
curl http://localhost:8000/health
curl http://localhost:8000/health/ready
```

Then open **http://localhost** in a browser and log in or use the dashboard. If both health checks pass and the UI loads without "Application error", the stack is ready for deployment-style testing.

**Stop**

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml down
```

To also remove the MongoDB data volume:

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml down -v
```

**Start again from terminal (after code or dependency changes)**

From the project root, use `--build` so dependency changes (e.g. new entries in `requirements.txt`) are picked up:

```powershell
# Full stack (backend + frontend + MongoDB)
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build

# Or backend + frontend only (MongoDB on host)
docker compose up --build
```

To start in the background (detached): add `-d`:

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

---

### Option B: Backend + frontend only (MongoDB on host)

Use this if you already run MongoDB on your machine (e.g. `mongodb://localhost:27017`).

1. In `backend\.env`, set:
   - `MONGODB_URL=mongodb://localhost:27017`  
   On Docker Desktop (Windows/Mac), from inside the container you may need `host.docker.internal` instead of `localhost`:
   - `MONGODB_URL=mongodb://host.docker.internal:27017`
2. Ensure MongoDB is running locally.
3. From project root:

```powershell
docker compose up --build
```

- Frontend: **http://localhost** (port 80)
- Backend: **http://localhost:8000**

Check health as above. If you see 503 or "database_unavailable", the backend cannot reach MongoDB (wrong host/port or MongoDB not running).

---

## 3. Typical causes of "Application error"

| Cause | What to check |
|-------|----------------|
| Backend not reachable | Backend container running; `curl http://localhost:8000/health` returns 200. |
| Database not connected | `/health` shows database disconnected; `/health/ready` returns 503. Fix `MONGODB_URL` and ensure MongoDB is running. |
| CORS | Backend must allow the frontend origin. For local Docker, `BACKEND_CORS_ORIGINS` should include `http://localhost` (and optionally `http://localhost:80`). The `docker-compose.local.yml` file sets this for the full-stack option. |
| Wrong API URL in frontend | For Docker, frontend is built with default `http://localhost:8000`. For production, set `REACT_APP_API_URL` and `REACT_APP_API_BASE_URL` to your deployed backend URL and rebuild. |
| Missing .env | Backend needs at least `MONGODB_URL`, `SECRET_KEY`, and `DATABASE_NAME`. Use `backend\.env.example` as a template. |

---

## 4. Quick reference

| Goal | Command |
|------|--------|
| Full local stack (backend + frontend + MongoDB) | `docker compose -f docker-compose.yml -f docker-compose.local.yml up --build` |
| Backend + frontend only (host MongoDB) | `docker compose up --build` |
| Backend health | `curl http://localhost:8000/health` |
| Readiness (incl. DB) | `curl http://localhost:8000/health/ready` |
| Stop containers | `docker compose -f docker-compose.yml -f docker-compose.local.yml down` |

Running the full Docker stack and passing the health checks above is a strong signal that the project is ready to deploy and should not show "Application error" due to backend or database misconfiguration.

---

## 5. Azure App Service: 504 / Container did not start within 230s

If the backend on Azure shows **504 Gateway Timeout** and platform logs say **Container did not start within expected time limit of 230s**:

- Azure gives the container **230 seconds** by default to respond to the startup (warmup) probe. The backend needs time to extract the Oryx build tarball (`output.tar.zst`), run `python3 run.py`, and load all imports (FastAPI, DB, sentence-transformers, etc.), which can exceed 230s—and extraction alone can take **several minutes** for a large stack.

**Fix:** Increase the container startup timeout in Azure:

1. **Azure Portal** → your App Service (**llmshield-backend-py**) → **Configuration** → **Application settings**.
2. **+ New application setting** (or edit if it exists):
   - **Name:** `WEBSITES_CONTAINER_START_TIME_LIMIT`
   - **Value:** `1800` (30 minutes; max allowed). Use `600` (10 min) if 30 is too long; if you still get 504, raise to `1800`.
3. **Save** and **Restart** the app.

Redeploy if needed; the new setting applies to the next container start. Also ensure all required dependencies (e.g. `groq`) are in `backend/requirements.txt` so the app does not crash on import before listening.

For **MODEL_ENCRYPTION_KEY** and **Supabase** (and other Azure env vars), see **[docs/AZURE_ENV_SETUP.md](AZURE_ENV_SETUP.md)**.

---

## 5b. Oryx "panic: extract tarball" / startup.sh not found

If logs show:

```text
panic: An error occurred when trying to extract tarball '/home/site/wwwroot/output.tar.zst'.
chmod: cannot access '/opt/startup/startup.sh': No such file or directory
```

then Oryx (Azure’s build) failed while extracting the built app, so the container never gets a valid startup script. The app may have been running earlier (e.g. you see `GET /health/supabase 200 OK`) before a restart hit this.

**Do this first:**

1. **Redeploy once or twice** – Often this is transient (disk/timeout). Push again or run the deploy workflow again.
2. **Give startup more time** – In **Configuration → Application settings** set **WEBSITES_CONTAINER_START_TIME_LIMIT** = **600**. Save and Restart. Then redeploy.
3. **Avoid redeploying during heavy load** – Deploy when traffic is low so the container isn’t under memory/disk pressure during extraction.

**If it keeps happening:** The build artifact (e.g. with `sentence-transformers`/PyTorch) can be very large and trigger extraction failures. Options: (a) Use a **Docker**-based deploy (build the image in CI and deploy the image to App Service) so Oryx isn’t used, or (b) In CI, run `pip install -t ./backend/packages -r backend/requirements.txt`, zip the backend (including `packages`), deploy that zip, and in Azure set **SCM_DO_BUILD_DURING_DEPLOYMENT** = **false** so Azure doesn’t run Oryx and uses your pre-built dependencies. That requires changing the workflow to produce and deploy the zip with `packages` included.

---

If pushing to GitHub (or the whole GitHub Actions pipeline) takes too long, you can deploy your **local** backend code directly to Azure and skip the push.

### Option A: Deploy from your machine with Azure CLI (no push)

1. **Install Azure CLI** (if needed): [https://learn.microsoft.com/en-us/cli/azure/install-azure-cli](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)  
   Then log in: `az login`

2. **Create a zip of the backend** (from project root, exclude venv and cache):
   ```powershell
   cd backend
   Compress-Archive -Path * -DestinationPath ..\backend.zip -Force
   cd ..
   ```
   Or with 7-Zip / any zip tool: zip the contents of `backend` (so `run.py`, `requirements.txt`, `app/`, etc. are at the **root** of the zip), and do **not** include `venv`, `__pycache__`, or `.env`.

3. **Deploy the zip** (replace resource group and app name if yours differ):
   ```powershell
   az webapp deploy --resource-group <YOUR_RESOURCE_GROUP> --name llmshield-backend-py --src-path backend.zip --type zip
   ```
   After the upload, Azure may still run a build (pip install) on the server; the first time can take a few minutes, but you didn’t wait for GitHub.

### Option B: Run the same workflow without new code (redeploy last commit)

To redeploy the **current** code on `main` (e.g. after changing only env vars in Azure):

1. Open **GitHub** → your repo → **Actions**.
2. Select **"Deploy Backend to Azure Web App"**.
3. Click **Run workflow** → **Run workflow**.

No push needed; the workflow uses the latest `main`. Build time is unchanged.

### Option C: Faster runs when you do push

The workflow now uses **pip cache** for `backend/requirements.txt`. After the first run, "Install dependencies" should be quicker on the next push.
