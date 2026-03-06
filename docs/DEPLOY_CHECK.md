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
