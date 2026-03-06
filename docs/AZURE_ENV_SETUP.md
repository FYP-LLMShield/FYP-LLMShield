# Azure environment variables setup

Use this to fix the “Supabase not configured” and “MODEL_ENCRYPTION_KEY not set” messages and to set optional features (Supabase) in Azure.

---

## Where to set values in Azure

1. Open **Azure Portal** → your App Service **llmshield-backend-py**.
2. In the left menu, open **Environment variables** (or **Configuration** → **Application settings** / **Environment variables** tab).
3. Add or edit variables there. After changes, click **Save** (or **Apply**) and **Restart** the app.

---

## 1. MODEL_ENCRYPTION_KEY (recommended)

This key encrypts stored model credentials. If it’s not set, the app generates a new one on each restart, so stored credentials can’t be decrypted after a restart.

### Step 1: Generate a key (one-time)

On your machine (with the backend venv active, or any Python that has `cryptography`):

```powershell
cd backend
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy the output (a long base64 string).

### Step 2: Add to Azure

1. In the app’s **Environment variables**, click **+ Add** (or **New application setting**).
2. **Name:** `MODEL_ENCRYPTION_KEY`  
   **Value:** paste the key you generated.
3. Save and restart the app.

### Step 3 (optional): Local use

In `backend/.env` add:

```env
MODEL_ENCRYPTION_KEY=<same-key-you-generated>
```

Use the same value in Azure and locally so credentials stay valid in both.

---

## 2. Supabase (optional)

Supabase is **optional**. The app runs with MongoDB only. Configure Supabase only if you use it for auth or storage.

### If you don’t use Supabase

- Do nothing. The log “Supabase not configured (optional)” is normal.
- No Azure env vars needed for Supabase.

### If you do use Supabase

#### Step 1: Get credentials from Supabase

1. Go to [https://app.supabase.com](https://app.supabase.com) and open your project (or create one).
2. **Project Settings** (gear) → **API**.
3. Copy:
   - **Project URL** → use for `SUPABASE_PROJECT_URL`
   - **anon public** key → use for `SUPABASE_ANON_KEY` (e.g. frontend)
   - **service_role** key → use for `SUPABASE_SERVICE_KEY` (backend only; keep secret)
4. On the same **API** page, find **JWT Secret** (Project API keys section) and copy it → use for `SUPABASE_JWT_SECRET`.

#### Step 2: Add to Azure

In the app’s **Environment variables**, add:

| Name | Value | Required |
|------|--------|----------|
| `SUPABASE_PROJECT_URL` | `https://xxxxx.supabase.co` | Yes (if using Supabase) |
| `SUPABASE_SERVICE_KEY` | Your **service_role** key | Yes (if using Supabase) |
| `SUPABASE_ANON_KEY` | Your **anon public** key | If frontend uses Supabase Auth |
| `SUPABASE_JWT_SECRET` | JWT Secret from API page | If verifying Supabase-issued tokens |

Save and restart the app.

#### Step 3: Create the `users` table in Supabase (required for signup)

The backend stores app users in a **custom** `public.users` table (not Supabase Auth’s built‑in users). If this table doesn’t exist, you get **“Failed to create user in database”**.

1. In **Supabase Dashboard** → **SQL Editor**, open a new query.
2. Copy the full contents of **`backend/scripts/supabase_users_table.sql`** from this repo.
3. Run the script. It creates `public.users` with the right columns and RLS policies for the **service_role** key (used by the backend).
4. If the trigger line fails with a syntax error, try changing `EXECUTE FUNCTION` to `EXECUTE PROCEDURE` and run again.

After this, registration and “Continue with Google” (once Google OAuth is fixed) will persist users in Supabase.

#### Step 4 (optional): Local use

In `backend/.env` add the same variables (see `backend/.env.example`).

---

## 3. “Continue with Google” – Error 400: origin_mismatch

Google OAuth fails with **“Access blocked: Authorization Error”** and **Error 400: origin_mismatch** when your app’s origin is not allowed in the OAuth client.

**Fix (no code change):**

1. Open **Google Cloud Console** → [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Open your **OAuth 2.0 Client ID** (Web application) used for “Sign in with Google”.
3. Under **Authorized JavaScript origins**, add:
   - `https://fyp-llmshield.vercel.app` (your Vercel app URL)
   - `http://localhost:3000` if you test sign-in locally
4. Under **Authorized redirect URIs**, add the exact redirect URL your app uses (e.g. Supabase callback or your backend callback URL).
5. Save. Try “Continue with Google” again after a short delay.

---

## 4. If you still see “Failed to create user in database”

1. **Supabase table** – Ensure you ran **Step 3** above so `public.users` exists.
2. **Azure env vars** – In App Service **Environment variables**, confirm `SUPABASE_PROJECT_URL` and `SUPABASE_SERVICE_KEY` are set and correct (Project URL and **service_role** key from Supabase **Project Settings → API**).
3. **Redeploy** – Redeploy the backend so the latest code (including Supabase proxy fix) and env are in use.
4. **Logs** – When you try to sign up, open Azure **Log stream** (or **Deployment / Logs**). Look for the exact Supabase/PostgREST error (e.g. `relation "users" does not exist`, or an RLS/column error). That message will tell you whether the table is missing, RLS is blocking, or a column type is wrong.

---

## 5. Still not working? Diagnose with the backend health endpoint

Your backend exposes **`/health/supabase`** to verify Supabase from the running app.

1. **Get your Azure backend URL**  
   It's the same base URL you use for `REACT_APP_API_URL` on Vercel (e.g. `https://your-app.azurewebsites.net`), **without** `/api/v1`.

2. **Call the health endpoint**  
   In a browser or with curl:
   ```
   https://YOUR-AZURE-BACKEND-URL/health/supabase
   ```
   Example: `https://llmshield-backend-py.azurewebsites.net/health/supabase`

3. **Interpret the response**
   - **`supabase_configured: true`, `supabase_reachable: true`** – Backend can see Supabase; if signup still fails, check Azure **Log stream** when you submit the form for the real error (e.g. duplicate email, column mismatch).
   - **`supabase_configured: false`** – `SUPABASE_PROJECT_URL` or `SUPABASE_SERVICE_KEY` is missing in Azure. Add them, Save, Restart, and try again.
   - **`supabase_configured: true`, `supabase_reachable: false`** – URL or **service_role** key is wrong, or the Supabase client failed to init (e.g. proxy). Check the `message` and `error_detail` fields in the JSON; fix the env vars and restart.

4. **Frontend must call this backend**  
   On Vercel, **Environment variables** must include `REACT_APP_API_URL` = `https://YOUR-AZURE-BACKEND-URL/api/v1` (with `/api/v1`). Redeploy the frontend after changing it so signup and Google sign-in hit Azure, not localhost.

---

## 6. "Continue with Google" still shows origin_mismatch

- **Authorized JavaScript origins** must match the **exact** URL in the browser address bar when the error appears (no trailing slash). If your app runs at `https://typ-llmshield.vercel.app`, add that; if it's `https://fyp-llmshield.vercel.app`, add that. Add both if you use both.
- **REACT_APP_GOOGLE_CLIENT_ID** on Vercel must be the same **Client ID** as the OAuth client where you added the origins (same project in Google Cloud Console).
- After saving in Google Cloud Console, wait **5–60 minutes** for changes to apply, then try again in an incognito/private window.

---

## 7. Quick checklist

| Item | Action |
|------|--------|
| **MODEL_ENCRYPTION_KEY** | Generate once with the Python command above → add to Azure (and optionally to `backend/.env`). |
| **Supabase** | If you use it: add `SUPABASE_PROJECT_URL`, `SUPABASE_SERVICE_KEY`, and optionally `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` in Azure. In Supabase, run **`backend/scripts/supabase_users_table.sql`** in the SQL Editor so the `users` table exists. If you don’t use it: ignore the “Supabase not configured” message. |
| **After changes** | Save and **Restart** the app in Azure. |

---

## 8. Other useful Azure settings

- **WEBSITES_CONTAINER_START_TIME_LIMIT** = `600` – Gives the app up to 10 minutes to start (avoids 504 during slow startup).
- **MONGODB_URL** – Your MongoDB Atlas (or other) connection string; required for the backend to work.
- **SECRET_KEY** – Strong random string for JWT; required in production (don’t leave default).

These can be set in the same **Environment variables** (or Application settings) page.
