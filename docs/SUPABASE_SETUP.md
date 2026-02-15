# Supabase setup for LLMShield

Your `.env` is already set. Do the following in the Supabase dashboard so the backend can store users.

## 1. Create the `users` table

The backend uses a **custom** `users` table (not Supabase Auth). Create it once:

1. In Supabase dashboard, open **SQL Editor** (left sidebar).
2. Click **New query**.
3. Paste the script below and run it.

```sql
-- LLMShield custom users table (used by backend with Supabase as primary store)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  hashed_password text,
  username text not null,
  name text not null,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  verification_token text,
  reset_token text,
  reset_token_expires timestamptz,
  mfa_enabled boolean not null default false,
  mfa_secret text,
  recovery_codes jsonb not null default '[]',
  trusted_devices jsonb not null default '[]',
  mfa_setup_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login timestamptz,
  google_id text,
  profile_picture text,
  display_name text default '',
  subscription_id uuid,
  current_subscription_tier text not null default 'premium',
  subscription_status text not null default 'active'
);

-- Indexes for login and lookups
create index if not exists users_email_idx on public.users (email);
create index if not exists users_username_idx on public.users (lower(username));
create index if not exists users_verification_token_idx on public.users (verification_token) where verification_token is not null;
```

4. Click **Run** (or Ctrl+Enter). You should see “Success. No rows returned.”

## 2. Confirm in Table Editor

- Go to **Table Editor** in the left sidebar.
- You should see a **users** table. It can be empty at first.

## 3. Test from the app

1. Start the backend (from `backend/`):  
   `uv run uvicorn app.main:app --reload` (or your usual command).
2. Open the frontend and **Sign up** with a new email/username/password.
3. In Supabase **Table Editor** → **users**, you should see the new row.
4. Log in with that user to confirm auth works.

## 4. Use the **service_role** key (required)

In `.env` you must set **SUPABASE_SERVICE_KEY** to the **service_role** (secret) key, not the anon key.

- In Supabase: **Settings → API** → copy **service_role** (under "Project API keys").
- If you use the anon key, inserts can be blocked by RLS and users will only be stored in MongoDB.

## 5. Check Supabase from the backend

After starting the backend, open:

- **http://localhost:8000/health/supabase**

You should see `supabase_configured: true` and `supabase_reachable: true`. If not, the response will show an error (e.g. table missing, wrong key). Fix that before signing up again.

## 6. Optional: match project URL

If your Supabase project URL in the dashboard is different from `.env`, copy **Project URL** and **service_role** from **Settings → API** into `.env` for the project where you created the `users` table.

Once the `users` table exists, `.env` has the service_role key, and `/health/supabase` shows reachable, new signups will be stored in both Supabase and MongoDB.

---

## 7. Optional: Supabase Auth as primary (backend as fallback)

You can use **Supabase Auth** for sign up / sign in. When Supabase is down or unreachable, the app automatically uses the **backend + MongoDB** auth (current implementation) as fallback.

**Backend (.env):**

- **SUPABASE_JWT_SECRET** – In Supabase: **Settings → API** → **JWT Secret**. Required so the backend can verify Supabase-issued access tokens.
- **SUPABASE_ANON_KEY** – **Project URL** and **anon** (public) key; backend health uses these to report `supabase_auth_primary`.

**Frontend (.env):**

- **REACT_APP_SUPABASE_URL** – Same as `SUPABASE_PROJECT_URL` (e.g. `https://xxxxx.supabase.co`).
- **REACT_APP_SUPABASE_ANON_KEY** – **anon** (public) key from **Settings → API**.

**Flow:**

1. **Login / signup:** Frontend tries Supabase Auth first (`signInWithPassword` / `signUp`). If that fails due to network or Supabase being down, it falls back to backend `/auth/login` and `/auth/register`.
2. **API calls:** Frontend sends either the Supabase access token or the backend JWT in `Authorization: Bearer <token>`. The backend accepts both (verifies Supabase JWT with `SUPABASE_JWT_SECRET`, or backend JWT with `SECRET_KEY`).
3. **Session on load:** Frontend restores session from `supabase.auth.getSession()` if available; otherwise from localStorage (backend token).

**Health check:** `GET /health/supabase` returns `supabase_auth_primary: true` when `SUPABASE_PROJECT_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_JWT_SECRET` are set.
