# Deploying the LLMShield Backend

Your backend is **FastAPI** + **uvicorn**, with **MongoDB**, optional **Supabase**, and vector DBs (Pinecone, ChromaDB, etc.). Below are deployment options, with **Azure (student)** as the recommended choice.

---

## Backend ready for deployment (checklist)

The backend is **container-ready** and production-hardened:

| Item | Status |
|------|--------|
| **Dockerfile** | `backend/Dockerfile` — multi-stage-friendly, non-root user, HEALTHCHECK |
| **Health probes** | `/health/live` (liveness), `/health/ready` (readiness + MongoDB), `/health` (full) |
| **Config** | `ENVIRONMENT`, `PORT`; .env loaded from repo root, backend dir, or cwd |
| **Startup** | Single lifespan (no duplicate connect); uvicorn via `app.main:app` |
| **Production** | Warning if `SECRET_KEY` is default when `ENVIRONMENT=production` |

**Required env vars for production:** `MONGODB_URL`, `SECRET_KEY`, `BACKEND_CORS_ORIGINS` (e.g. your Vercel URL). Optional: `ENVIRONMENT=production`, `PORT=8000`, Pinecone/OpenAI/Supabase keys.

**Build and run locally (Docker):**

```bash
cd backend
docker build -t llmshield-backend .
docker run -p 8000:8000 -e MONGODB_URL=... -e SECRET_KEY=... llmshield-backend
```

**Azure Container Apps / App Service:** Use **Liveness** URL `https://<your-app>/health/live` and **Readiness** URL `https://<your-app>/health/ready` in the health probe settings.

---

## Step-by-step: Push image to Azure Container Registry (ACR)

Use this section **after** your Docker build finishes (`docker build -t llmshield-backend .`). It explains **where** to run commands and **how** to push your image to Azure.

### Where to run the commands

- **Option A (recommended):** On your PC in **PowerShell** or **Command Prompt** (same place you ran `docker build`). You need **Azure CLI** and **Docker Desktop** installed.
- **Option B:** In the **Azure Portal** → **Cloud Shell** (bash in the browser). You can run `az` and `docker` there; image must be built in Cloud Shell or you push from your PC (Option A).

All commands below are for **PowerShell or Command Prompt** on your machine unless noted.

---

### 1. Install Azure CLI (if you don’t have it)

1. Download: [Install Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows) (Windows: MSI installer).
2. Install, then **close and reopen** PowerShell/CMD.
3. Check:
   ```powershell
   az --version
   ```
   You should see a version number.

---

### 2. Log in to Azure

1. Open **PowerShell** or **Command Prompt** (any folder is fine).
2. Run:
   ```powershell
   az login
   ```
3. A browser window opens → sign in with your **Azure student account** (university email).
4. When it says “You have logged in,” you can close the browser tab. Back in the terminal you’ll see a JSON block with your subscriptions — that means you’re logged in.

---

### 3. Create a resource group (if you don’t have one)

A **resource group** is a container in Azure where you put resources (ACR, Container App, etc.).

1. Choose a **short name** for your group, e.g. `llmshield-rg` (no spaces; use lowercase and hyphens).
2. Choose a **region**, e.g. `eastus` or `westeurope`. List regions:
   ```powershell
   az account list-locations -o table
   ```
3. Create the resource group (replace names if you prefer):
   ```powershell
   az group create --name llmshield-rg --location eastus
   ```
   You’ll see JSON with `"provisioningState": "Succeeded"`.

---

### 4. Create Azure Container Registry (ACR)

1. Choose an **ACR name**: only letters and numbers, 5–50 characters, globally unique. Example: `llmshieldacr` (if taken, try `llmshieldacr123` or add your initials).
2. Create the registry (use **your** resource group and ACR name):
   ```powershell
   az acr create --resource-group llmshield-rg --name llmshieldacr --sku Basic
   ```
   - `llmshield-rg` = resource group from step 3  
   - `llmshieldacr` = your chosen ACR name  
   - `Basic` = cheapest SKU (enough for FYP)
3. Wait until it finishes. You’ll see JSON with `"provisioningState": "Succeeded"`.

---

### 5. Enable admin user on ACR (so Docker can log in)

Docker needs a username/password to push. Azure can create an “admin” user for your ACR:

```powershell
az acr update --name llmshieldacr --admin-enabled true
```

Replace `llmshieldacr` with your ACR name. This only needs to be done once.

---

### 6. Log in Docker into ACR

So your local Docker can push to **your** registry:

```powershell
az acr login --name llmshieldacr
```

Replace `llmshieldacr` with your ACR name. You should see: `Login Succeeded`.

---

### 7. Tag your image for ACR

Your image is currently named `llmshield-backend` locally. ACR expects a name like:

`<your-acr-name>.azurecr.io/<image-name>:<tag>`

Run (replace `llmshieldacr` with your ACR name):

```powershell
docker tag llmshield-backend llmshieldacr.azurecr.io/llmshield-backend:latest
```

So:
- **Local image:** `llmshield-backend`
- **ACR image:** `llmshieldacr.azurecr.io/llmshield-backend:latest`

---

### 8. Push the image to ACR

```powershell
docker push llmshieldacr.azurecr.io/llmshield-backend:latest
```

Replace `llmshieldacr` with your ACR name. The first push can take a few minutes. When it finishes, your backend image is in Azure.

---

### 9. Verify in Azure Portal

1. Go to [portal.azure.com](https://portal.azure.com).
2. Open your **Container registry** (e.g. `llmshieldacr`).
3. Go to **Services** → **Repositories**. You should see **llmshield-backend** with tag **latest**.

---

### Quick reference (replace and run)

| Step | Command |
|------|--------|
| Login Azure | `az login` |
| Create resource group | `az group create --name llmshield-rg --location eastus` |
| Create ACR | `az acr create --resource-group llmshield-rg --name llmshieldacr --sku Basic` |
| Enable admin | `az acr update --name llmshieldacr --admin-enabled true` |
| Docker login to ACR | `az acr login --name llmshieldacr` |
| Tag image | `docker tag llmshield-backend llmshieldacr.azurecr.io/llmshield-backend:latest` |
| Push image | `docker push llmshieldacr.azurecr.io/llmshield-backend:latest` |

Use the **same** ACR name everywhere you see `llmshieldacr`. After this, you can create an **Azure Container App** (or App Service) and select this image from ACR.

---

## Deploy using Docker Hub (when ACR is blocked)

If Azure for Students blocks ACR in all regions, use **Docker Hub** (free) to host your image. Then run it on **Azure App Service** (Web App for Containers) or, if available to you, Container Apps.

- **App Service (Docker):** Use **Part A** (push to Docker Hub) then **Part B – App Service** below. App Service has a free tier (F1) and fits student plans.
- **Container Apps:** Use **Part A** then **Part B – Container Apps** (may not be free on your subscription).

**Prerequisites:** Docker Desktop running, backend image already built (`docker build -t llmshield-backend .`). All commands below are in **PowerShell** from your PC.

---

### Part A: Push your image to Docker Hub

#### Step A1: Create a Docker Hub account (if you don’t have one)

1. Open a browser and go to **[https://hub.docker.com](https://hub.docker.com)**.
2. Click **Sign up**.
3. Choose a **Docker ID** (username): only lowercase letters, numbers, underscores. Example: `alishallmshield` or `llmshieldfyp`. Remember this — you’ll use it in every command below.
4. Enter email and password, complete sign-up, and verify email if asked.
5. You’re logged in when you see your username at the top right.

---

#### Step A2: Log in to Docker Hub from your PC

1. Open **PowerShell** (you can stay in any folder).
2. Run:
   ```powershell
   docker login
   ```
3. When prompted:
   - **Username:** your Docker Hub username (Docker ID).
   - **Password:** your Docker Hub password (or an **Access Token** if you use 2FA — create one at Docker Hub → Account Settings → Security → New Access Token).
4. You should see: **Login Succeeded**.

---

#### Step A3: Tag your image for Docker Hub

Your local image is named `llmshield-backend`. Docker Hub expects: **username/image-name:tag**.

Replace **YOUR_DOCKERHUB_USERNAME** with your actual Docker ID (e.g. `alishallmshield`). Run:

```powershell
docker tag llmshield-backend YOUR_DOCKERHUB_USERNAME/llmshield-backend:latest
```

Example:
```powershell
docker tag llmshield-backend alishallmshield/llmshield-backend:latest
```

This only creates a new tag; it doesn’t upload yet.

---

#### Step A4: Push the image to Docker Hub

1. Run (again replace **YOUR_DOCKERHUB_USERNAME** with your Docker ID):
   ```powershell
   docker push YOUR_DOCKERHUB_USERNAME/llmshield-backend:latest
   ```
2. The first push can take several minutes (your image is large). Wait until you see: **latest: digest: sha256:...**.
3. **Verify:** In a browser go to **https://hub.docker.com**, make sure you’re logged in, click **Repositories**. You should see **llmshield-backend** with tag **latest**.

---

### Part B: Create Azure Container App from Docker Hub

#### Step B1: Open Azure Portal and start creating a Container App

1. Go to **[https://portal.azure.com](https://portal.azure.com)** and sign in with your **Azure for Students** account.
2. In the top search bar type **Container Apps** and click **Container Apps** (the service, not “Container Apps environments”).
3. Click **+ Create** (or **+ Create container app**).
4. You’ll go through a wizard with several tabs: **Basics**, **Container(s)**, **Ingress**, etc. Follow the steps below for each tab.

---

#### Step B2: Basics tab

1. **Subscription:** Azure for Students (should already be selected).
2. **Resource group:** Select **llmshield-rg** (the one you created earlier). If you don’t see it, choose **Create new** and name it `llmshield-rg`.
3. **Container app name:** e.g. `llmshield-backend`. This will be part of your URL.
4. **Region:** Choose **East US** (or any region that works for your subscription).
5. **Container Apps Environment:**
   - If you see an existing environment in the same region, select it.
   - Otherwise click **Create new**, give it a name like `llmshield-env`, same region, then select it.
6. Click **Next: Container(s)** at the bottom.

---

#### Step B3: Container(s) tab – use Docker Hub image

1. **Use quickstart image:** Leave **unchecked** (we’re using our own image).
2. **Image source:** Select **Docker Hub** or **Other registry** (depending on what the portal shows).
   - If you see **Docker Hub**: choose it.
   - If you see **Image type** or **Registry**: choose **Docker Hub** or **Public**.
3. **Image:** Enter exactly (replace with your Docker Hub username):
   ```text
   YOUR_DOCKERHUB_USERNAME/llmshield-backend:latest
   ```
   Example: `alishallmshield/llmshield-backend:latest`
4. **CPU and Memory:** Leave default (e.g. 0.5 CPU, 1 Gi memory) to save cost. You can increase later if needed.
5. **Target port:** Set to **8000** (your app listens on 8000).
6. **Environment variables (optional here):** You can add them in this tab or in **Step B5** after creation. If the wizard has an “Environment variables” section here, click **+ Add** and add at least:
   - Name: `MONGODB_URL`  Value: your MongoDB Atlas connection string (see Step B5).
   - Name: `SECRET_KEY`   Value: a long random string (e.g. generate one at [https://randomkeygen.com](https://randomkeygen.com) — use “Code Key”).
   - Name: `BACKEND_CORS_ORIGINS`  Value: `https://fyp-llmshield.vercel.app` (or your Vercel frontend URL).
7. Click **Next: Ingress** at the bottom.

---

#### Step B4: Ingress tab

1. **Ingress:** Set to **Enabled**.
2. **Ingress traffic:** **Accept traffic from anywhere** (or “External” / “Public”) so your Vercel app can call the API.
3. **Ingress type:** **HTTP**.
4. **Target port:** **8000** (should be pre-filled).
5. **Transport:** **HTTP** (default).
6. **Traffic:** 100% to latest revision (default).
7. Click **Next** (or **Review + create** if that’s the last step).

---

#### Step B5: Review + create, then add environment variables

1. Click **Review + create**. Wait for validation to pass, then click **Create**.
2. Wait until the deployment finishes (status: “Your deployment is complete”).
3. Click **Go to resource** to open your new Container App.
4. In the left menu under **Settings**, click **Environment variables** (or **Containers** → your container → **Environment variables**).
5. Click **+ Add** and add these (replace values with your real ones):

   | Name | Value |
   |------|--------|
   | `MONGODB_URL` | Your **MongoDB Atlas** connection string. Get it from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) → your cluster → Connect → “Connect your application” → copy the URI. Replace `<password>` with your DB user password. Example: `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/llmshield_db` |
   | `SECRET_KEY` | A long random secret (not `test-secret`). Use e.g. a 32+ character random string. |
   | `BACKEND_CORS_ORIGINS` | Your frontend URL, e.g. `https://fyp-llmshield.vercel.app` (no trailing slash). |
   | `ENVIRONMENT` | `production` |
   | `PORT` | `8000` |

   If you use Supabase, Pinecone, or OpenAI, add those variables too (see `backend/.env.example`).
6. Click **Apply** or **Save**.
7. The app may restart; wait a minute.

---

#### Step B6: Get your backend URL and test

1. On the Container App **Overview** page, find **Application Url** (or **FQDN**). It looks like:
   ```text
   https://llmshield-backend.xxxxx.eastus.azurecontainerapps.io
   ```
2. Copy that URL and open it in a browser. You should see JSON with “LLMShield Backend API” and “version”: “2.0.0”.
3. Try the health check: open **https://&lt;your-url&gt;/health/live** — you should see `{"status":"alive"}`.
4. **Important:** Your backend needs a **real MongoDB** in the cloud. `mongodb://localhost:27017` does **not** work inside Azure. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas), get the connection string, and set it as `MONGODB_URL` in the Container App environment variables, then save. The app will restart and connect to Atlas.

---

#### Step B7: Point your Vercel frontend to this backend

1. Go to [vercel.com](https://vercel.com) → your project (**fyp-llmshield**) → **Settings** → **Environment Variables**.
2. Add or edit:
   - **REACT_APP_API_URL** = `https://<your-application-url>/api/v1`  
     Example: `https://llmshield-backend.xxxxx.eastus.azurecontainerapps.io/api/v1`
   - **REACT_APP_API_BASE_URL** = `https://<your-application-url>`  
     Example: `https://llmshield-backend.xxxxx.eastus.azurecontainerapps.io`
3. **Redeploy** the frontend: **Deployments** → three dots on latest deployment → **Redeploy**.

---

### Part B – App Service (recommended if Container Apps is not free)

Use this **instead of** the Container App steps above. You still need **Part A** (image pushed to Docker Hub) done first.

#### Step S1: Create a Web App that uses Docker

1. Go to **[https://portal.azure.com](https://portal.azure.com)** and sign in with your Azure for Students account.
2. In the top search bar type **App Services** and open **App Services**.
3. Click **+ Create** → **+ Web app**.
4. **Basics** tab:
   - **Subscription:** Azure for Students.
   - **Resource group:** **llmshield-rg** (or create new).
   - **Name:** e.g. **llmshield-backend** (must be globally unique; add numbers if taken, e.g. llmshield-backend-fyp).
   - **Publish:** select **Docker Container**.
   - **Operating System:** **Linux**.
   - **Region:** e.g. **East US**.
   - **Pricing plan:** **Free F1** (or **Basic B1** if you need more). Free F1 has limits but is $0.
5. Click **Next: Docker**.

#### Step S2: Docker tab – use Docker Hub image

1. **Options:** **Single Container**.
2. **Image Source:** **Docker Hub**.
3. **Access type:** **Public** (your image is public on Docker Hub).
4. **Image and tag:**  
   Enter exactly (replace with your Docker Hub username):  
   `YOUR_DOCKERHUB_USERNAME/llmshield-backend:latest`  
   Example: `alishallmshield/llmshield-backend:latest`
5. **Startup Command:** leave **empty** (the Dockerfile CMD already runs uvicorn).
6. Click **Review + create** → **Create**. Wait until deployment finishes, then click **Go to resource**.

#### Step S3: Set port and application settings

1. In the App Service, go to **Settings** → **Configuration** (left menu).
2. **General settings** tab:
   - **Stack settings:** Already set by Docker.
   - **Startup Command:** leave empty unless you need to override.
3. Open the **Application settings** tab.
4. Click **+ New application setting** and add (one by one):

   | Name | Value |
   |------|--------|
   | **WEBSITES_PORT** | **8000** (tells App Service your app listens on 8000). |
   | **MONGODB_URL** | Your MongoDB Atlas connection string (see note below). |
   | **SECRET_KEY** | A long random secret (not test-secret). |
   | **BACKEND_CORS_ORIGINS** | Your Vercel URL, e.g. `https://fyp-llmshield.vercel.app` |
   | **ENVIRONMENT** | **production** |
   | **PORT** | **8000** |

   Add any other vars from `backend/.env.example` (e.g. OPENAI_API_KEY, Supabase) if you use them.
5. Click **Save** at the top (confirm if asked). The app will restart.

**MongoDB:** Use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier). Get the connection string from your cluster → Connect → “Connect your application”. Put it in **MONGODB_URL**. `mongodb://localhost:27017` does not work in Azure.

#### Step S3b: If you get "ImagePullFailure" (Azure can't pull from Docker Hub)

Azure may fail to pull your image (rate limits or auth). Add Docker Hub credentials:

1. In the Web App, go to **Deployment Center** (left menu).
2. Open the **Settings** tab (or **Registry** / **Container** section).
3. Under **Registry credentials** (or "Docker Hub" / "Registry source"):
   - **Registry source:** Docker Hub (or "Other" with URL `https://index.docker.io/v1/`).
   - **Login:** Your Docker Hub username (e.g. `alishashahidkhan`).
   - **Password:** Your Docker Hub password, or an **Access Token** from [Docker Hub → Account Settings → Security → New Access Token](https://hub.docker.com/settings/security).
4. **Save** and **Restart** the Web App. Azure will pull the image as an authenticated user.

Also confirm on [hub.docker.com](https://hub.docker.com) that the repository **llmshield-backend** is **Public** and has tag **latest**.

---

#### Step S4: Get your backend URL and test

1. In the App Service **Overview** page, find **Default domain** (or **URL**). It looks like:  
   `https://llmshield-backend.azurewebsites.net` (or with your chosen name).
2. Open that URL in a browser. You should see JSON with “LLMShield Backend API”.
3. Open `https://<your-app-url>/health/live` — you should see `{"status":"alive"}`.

#### Step S5: Point Vercel frontend to this backend

1. Go to [vercel.com](https://vercel.com) → your project → **Settings** → **Environment Variables**.
2. Set **REACT_APP_API_URL** = `https://<your-app-service-url>/api/v1`  
   Example: `https://llmshield-backend.azurewebsites.net/api/v1`
3. Set **REACT_APP_API_BASE_URL** = `https://<your-app-service-url>`  
   Example: `https://llmshield-backend.azurewebsites.net`
4. **Deployments** → … → **Redeploy**.

---

### Quick reference – Docker Hub path

| Step | What to do |
|------|------------|
| 1 | Create account at [hub.docker.com](https://hub.docker.com). |
| 2 | `docker login` (use your Docker ID and password). |
| 3 | `docker tag llmshield-backend YOUR_DOCKERHUB_USERNAME/llmshield-backend:latest` |
| 4 | `docker push YOUR_DOCKERHUB_USERNAME/llmshield-backend:latest` |
| 5a | **App Service:** Create **Web app** → Publish **Docker Container** → Image from **Docker Hub** → `YOUR_DOCKERHUB_USERNAME/llmshield-backend:latest` |
| 5b | **Container Apps:** Create **Container App** → Image from **Docker Hub** → same image (if available on your plan). |
| 6 | Set **WEBSITES_PORT** = 8000 (App Service) or **Target port** 8000 (Container Apps); add env vars (MONGODB_URL, SECRET_KEY, BACKEND_CORS_ORIGINS). |
| 7 | Copy app URL → set in Vercel (REACT_APP_API_URL, REACT_APP_API_BASE_URL) → Redeploy frontend. |

---

## Option 1: Azure (Student) — **Recommended**

**Why it fits:** Azure for Students gives **$100 credit** (no credit card for sign-up in many regions) and includes App Service, Container Apps, and MongoDB-compatible services (e.g. Cosmos DB or MongoDB Atlas).

### A. Azure App Service (Python)

1. **Sign up:** [Azure for Students](https://azure.microsoft.com/en-us/free/students/) — verify with your university email.
2. **Create a Web App:**
   - Portal: **Create a resource** → **Web App**.
   - Runtime: **Python 3.11** (or 3.10).
   - Region: choose one close to your users.
3. **Configure startup:**
   - In App Service → **Configuration** → **General settings**:
   - **Startup Command:**  
     `uvicorn app.main:app --host 0.0.0.0 --port 8000`
   - Or use a startup script (see below).
4. **Deploy code:**
   - **Deployment Center** → connect your GitHub repo.
   - Set **Root of repository** to the folder that contains your backend (e.g. `backend` or repo root if you set **Application path** accordingly).
   - Build: use **Python** or **GitHub Actions** with a workflow that installs deps and runs from `backend`.
5. **Environment variables:**  
   In **Configuration** → **Application settings**, add all vars from `backend/.env.example` (e.g. `MONGODB_URL`, `SECRET_KEY`, `PINECONE_*`, `OPENAI_API_KEY`, CORS origins, etc.).  
   For CORS, set `BACKEND_CORS_ORIGINS` to your frontend URL, e.g. `https://fyp-llmshield.vercel.app`.
6. **MongoDB:**  
   Use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier) and set `MONGODB_URL` in App Service to the Atlas connection string.

### B. Azure Container Apps (Docker)

Better if you prefer Docker and more control over the runtime.

1. Create a **Container Registry** (e.g. Azure ACR) and push your image (use the `Dockerfile` in this repo).
2. **Container Apps** → Create → use the image, set port **8000**, and add the same env vars as above.
3. Scale to zero when idle to save credit.

---

## Option 2: Railway

- **Pros:** Very simple GitHub deploy, free trial credit, good for FastAPI.
- **Cons:** Paid after trial; cold starts on free tier.
- **Steps:** [railway.app](https://railway.app) → New Project → Deploy from GitHub → select repo, set **Root Directory** to `backend`, add **Start Command** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Add env vars in Railway dashboard. Use MongoDB Atlas for `MONGODB_URL`.

---

## Option 3: Render

- **Pros:** Free tier for web services, supports Docker or native Python.
- **Cons:** Free tier sleeps after inactivity (cold start); 750 hours/month free.
- **Steps:** [render.com](https://render.com) → New → **Web Service** → connect repo, set **Root Directory** to `backend`. Build: `pip install -r requirements.txt`. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Add env vars. Use MongoDB Atlas.

---

## Option 4: Fly.io

- **Pros:** Global regions, free tier, good for containers.
- **Cons:** Requires Docker and `flyctl`; a bit more setup.
- **Steps:** Install `flyctl`, run `fly launch` in your backend directory (or repo root with Dockerfile context). Use a `Dockerfile` that installs deps and runs `uvicorn app.main:app --host 0.0.0.0 --port 8080`. Set secrets with `fly secrets set KEY=value`. Use MongoDB Atlas.

---

## Option 5: Google Cloud Run (Student / Free tier)

- **Pros:** Pay per request, free tier; student credits if you have them.
- **Cons:** Cold starts; need to containerize (Docker).
- **Steps:** Build and push image to Google Artifact Registry, then create a **Cloud Run** service from that image, set port **8000**, and add env vars. Use MongoDB Atlas.

---

## Option 6: AWS (Student – Free Tier / Credits)

- **Pros:** Free tier (e.g. 12 months) or AWS Educate credits; Elastic Beanstalk or ECS.
- **Cons:** More services to learn; free tier limits.
- **Steps:** Use **Elastic Beanstalk** (Python platform) or **ECS** with Fargate. Deploy from GitHub or upload code. Set env vars in the environment. Use MongoDB Atlas (or DocumentDB if you stay in AWS).

---

## Option 7: DigitalOcean App Platform

- **Pros:** Simple UI, predictable pricing.
- **Cons:** No free tier; paid from day one.
- **Steps:** Create an App from GitHub, set root to `backend`, build/run commands similar to Render. Add env vars and use MongoDB Atlas.

---

## Summary Table

| Platform           | Best for              | Free tier / Student | Complexity |
|--------------------|------------------------|---------------------|------------|
| **Azure (Student)**| FYP, full control      | $100 credit         | Medium     |
| **Railway**        | Quick deploy           | Trial credit        | Low        |
| **Render**         | Simple Python deploy   | 750 hrs/month       | Low        |
| **Fly.io**         | Global, Docker         | Free allowance      | Medium     |
| **Google Cloud Run**| Serverless containers | Free tier           | Medium     |
| **AWS**            | Already using AWS      | Free tier / credits | Higher     |
| **DigitalOcean**   | Simple paid hosting    | No                  | Low        |

---

## After Deployment

1. **Backend URL**  
   You’ll get a URL like `https://your-app.azurewebsites.net` or `https://your-app.railway.app`.

2. **Frontend (Vercel)**  
   In Vercel → **Settings** → **Environment Variables**, set:
   - `REACT_APP_API_URL` = `https://your-backend-url/api/v1`
   - `REACT_APP_API_BASE_URL` = `https://your-backend-url`  
   Then redeploy the frontend.

3. **CORS**  
   In the backend env, set:
   - `BACKEND_CORS_ORIGINS` = `https://fyp-llmshield.vercel.app` (and any other frontend URLs you use).

4. **Health check**  
   Most platforms expect a root or `/health` route. Your FastAPI app can expose a simple endpoint, e.g. `/api/v1/health` or use the default docs at `/docs`.

---

## Minimal Startup for Azure App Service (Python, no Docker)

Use **Configuration → General settings → Startup Command** in the Azure portal. Choose the command that matches how code is deployed:

### Full repo at wwwroot (GitHub Actions deploys whole repo)

If the workflow uploads the **entire repository** (e.g. `main_llmshield-backend-py.yml`), then `wwwroot` contains `backend/`, `frontend/`, etc. The app and `requirements.txt` are under `wwwroot/backend/`. Use:

```bash
cd /home/site/wwwroot/backend && pip install -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Backend-only at wwwroot (e.g. custom workflow with `package: ./backend`)

If only the **backend folder** is deployed to wwwroot (e.g. `.github/workflows/azure-backend.yml` with `package: ./backend`), then `requirements.txt` and `app/` are directly in wwwroot. Use:

```bash
pip install -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Quick check:** If runtime logs show `Could not open requirements file: ... 'requirements.txt'`, the working directory is wwwroot and the repo is deployed as a whole — use the **full repo** startup command above.

---

*(Removed: old startup.sh option; use the commands above in the portal.)*

---

Using **Azure with your student account** is a strong choice for an FYP: you get real cloud experience and enough credit to run the backend and optionally a DB. The other options are good alternatives if you prefer a different provider or a faster initial deploy (e.g. Railway or Render).
