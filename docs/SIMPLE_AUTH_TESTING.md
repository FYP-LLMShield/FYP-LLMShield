# Simple Auth Testing Guide

This guide explains how to test **backend/email auth** (simple auth) flows: signup, email verification, login, forgot password, and reset password. Use this when Supabase Auth is not configured or when you want to validate the fallback path.

---

## Prerequisites

1. **Backend** running (e.g. `uvicorn app.main:app --reload` from `backend/`).
2. **Frontend** running (e.g. `npm start` from `frontend/`).
3. **Email** configured in backend so verification and password-reset emails can be sent:
   - Set `SMTP_*` (or your email provider) in `backend/.env` (see `backend/.env.example`).
   - If email is not configured, you can still test the **forgot-password request** (API returns success); the reset **link** will only work if you copy a token from logs or DB (see below).

---

## 1. Sign up (email)

1. Open the app and go to **Sign up** (e.g. `/auth` with sign-up form).
2. Enter **email** and **password** (meeting the requirements).
3. Submit.
4. **Expected:** Message like “Created account successfully. Please log in below.” — no automatic login.

**Note:** If verification is enabled, the new user is unverified until they click the link in the email (or use the verify endpoint).

---

## 2. Email verification (if enabled)

- **Via email:** Check inbox for “Verify your email” and open the link. It should open e.g. `/auth?verify=1&token=...` and the app will call `POST /auth/verify-email/{token}`.
- **Expected:** “Email verified” (or similar); you can then log in.

**Without email:** You can verify manually by calling the API:

```bash
curl -X POST "http://localhost:8000/auth/verify-email/YOUR_VERIFICATION_TOKEN"
```

To get `YOUR_VERIFICATION_TOKEN` you can check backend logs or the DB (e.g. `users` collection, verification token field).

---

## 3. Login (email)

1. On the **Login** form, enter the same **email** and **password**.
2. Submit.
3. **Expected:** “Login successful … redirecting to dashboard” and redirect to dashboard.
4. **If account is not verified:** 403 with “Email not verified…” (when backend requires verification).

---

## 4. Forgot password

1. On the **Login** form, click **“Forgot password?”** (opens the Forgot Password modal).
2. Enter the **email address** for the account whose password they want to reset.
3. Submit.
4. **Expected:** Message like “We've sent a password reset link to **<that email address>**.”  
   - The API always returns success for security (same message even if the email is not in the DB).
5. Check the **email** for “Reset Your Password - LLMShield” and a link like:
   - `http://localhost:3000/reset-password?token=...`  
   (If you set `FRONTEND_URL` in backend `.env`, the link uses that base URL.)

**Note:** Forgot password only works for users that exist in **MongoDB**. Users that exist only in Supabase Auth (and were never created via backend signup or Google signup) will not receive a reset email.

---

## 5. Reset password

1. Open the **reset link** from the email (e.g. `http://localhost:3000/reset-password?token=...`).  
   - Or go to `/reset-password` and paste the token in the URL: `/reset-password?token=YOUR_TOKEN`.
2. Enter a **new password** that meets the requirements (length, uppercase, lowercase, number, special char).
3. Confirm password and submit.
4. **Expected:** “Your password has been successfully reset. You will be redirected to the login page shortly.” Then redirect to `/auth`.
5. **Login** with the same email and the **new password** to confirm.

**If the link is invalid or expired:**

- You’ll see an error like “This password reset link is invalid or expired. Please request a new one.”
- Tokens expire (e.g. after 1 hour). Request a new “Forgot password” to get a new link.

---

## 6. Testing without email (e.g. local dev)

If SMTP is not set up, you can still test the reset flow:

1. **Request reset:** Use the Forgot Password modal with an email that exists in MongoDB. The API will return success (email won’t actually send).
2. **Get the token:**  
   - Check backend logs (if you log the token in dev), or  
   - In MongoDB, open the `password_reset_tokens` collection, find the latest document for that user, and use the stored token (if you store the raw token) or generate one from the same secret/params your app uses.  
   - Easiest: add a temporary log in `request_password_reset` that prints `reset_token` (only in dev), then use it in the URL.
3. **Open:** `http://localhost:3000/reset-password?token=PASTE_TOKEN_HERE` and set the new password.

---

## Quick checklist

| Flow                 | How to test |
|----------------------|-------------|
| **Sign up**          | Sign up with email/password → see “account created, please log in”. |
| **Verify email**     | Click link in verification email, or call `POST /auth/verify-email/{token}`. |
| **Login**            | Log in with email/password → redirect to dashboard. |
| **Forgot password**  | Login → “Forgot password?” → enter email → see “sent reset link” and receive email. |
| **Reset password**   | Open link from email → set new password → redirect to login → log in with new password. |
| **Invalid/expired**  | Open `/reset-password?token=invalid` or use an old link → see invalid/expired message. |

---

## Backend endpoints (simple auth)

- `POST /auth/register` – sign up (email + password).
- `POST /auth/login` – login (email + password).
- `POST /auth/verify-email/{token}` – mark user verified.
- `POST /auth/forgot-password` – body: `{ "email": "user@example.com" }`.
- `POST /auth/reset-password` – body: `{ "token": "...", "new_password": "..." }`.

All of these work with backend JWT and MongoDB; no Supabase required for these flows.
