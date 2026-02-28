# Demo: Password Reset Email + Simple Backend Signup

Use this to show in your demo that:
1. **Forgot password** sends a reset email **from** your team address (e.g. `team.llmshield@gmail.com`).
2. **Simple backend signup** works once so you have a user to test forgot password with.

---

## 1. Set up email in backend (so reset comes from team.llmshield@gmail.com)

In **`backend/.env`** add (or ensure you have):

```env
EMAIL_USERNAME=team.llmshield@gmail.com
EMAIL_PASSWORD=your-16-char-gmail-app-password
EMAIL_FROM_NAME=LLMShield Team
```

- **Gmail:** Use a [Gmail App Password](https://support.google.com/accounts/answer/185833) (not your normal password). Enable 2-Step Verification first, then create an App Password and paste it in `EMAIL_PASSWORD`.
- **`EMAIL_FROM_NAME`** is optional; if set, the inbox will show **"LLMShield Team"** as the sender name with `<team.llmshield@gmail.com>`.

Restart the backend after changing `.env`.

---

## 2. Test simple backend signup once

1. Start **backend** and **frontend** (e.g. frontend at `http://localhost:3000`).
2. Open the app and go to the **Sign up** form (e.g. `/auth` and switch to Sign up).
3. Use **email/password only** (no Google):
   - Email: an address you can receive mail at (e.g. your own or a test inbox).
   - Password: one that meets the requirements (length, upper, lower, number, special char).
4. Submit.
5. You should see something like: **"Created account successfully. Please log in below."**
6. (Optional) If verification is enabled, verify the email (link in inbox or `POST /auth/verify-email/{token}`) so you can log in. Otherwise you may need to disable verification for the demo or use a backend that doesn’t require it for login.

You now have one **backend (simple auth)** user in MongoDB that you can use for the forgot-password demo.

---

## 3. Demo: Forgot password sends email from team.llmshield@gmail.com

1. On the **Login** form, click **"Forgot password?"**.
2. Enter the **email address** for the account whose password you want to reset.
3. Submit. The app shows: **"We've sent a password reset link to &lt;their email address&gt;"** — i.e. the address they just entered.
4. Open the **inbox** for that email. You should see:
   - **From:** `LLMShield Team <team.llmshield@gmail.com>` (if `EMAIL_FROM_NAME` is set) or `team.llmshield@gmail.com`.
   - **Subject:** something like "Reset Your Password - LLMShield".
   - A link like `http://localhost:3000/reset-password?token=...`.

That demonstrates that clicking **Forgot password** sends the reset email **from** your configured address (`team.llmshield@gmail.com`).

---

## 4. Optional: Complete the reset in the demo

1. Click the link in the email (or open `/reset-password?token=...` with the token from the link).
2. Set a new password and submit.
3. Log in with the same email and the new password to confirm.

---

## Troubleshooting

- **No email received:** Check `EMAIL_USERNAME` and `EMAIL_PASSWORD` in `backend/.env`, and that the user exists in **MongoDB** (created via backend signup or backend Google signup). Check backend logs for SMTP errors.
- **Wrong sender:** Ensure `EMAIL_USERNAME=team.llmshield@gmail.com` (no typos). Restart the backend after changing `.env`.
- **Signup fails or user not found:** Ensure you’re using the **Sign up** form (email/password) and not only Supabase/Google; backend signup writes to MongoDB, which forgot-password uses.

---

## No verification email / "Email not verified" on login

If you get **"Email not verified. Please check your email and click the verification link before logging in."** and **no email** arrived from team.llmshield@gmail.com:

### 1. Fix email so verification emails are sent

In **`backend/.env`** set:

```env
EMAIL_USERNAME=team.llmshield@gmail.com
EMAIL_PASSWORD=your-16-char-gmail-app-password
```

Use a [Gmail App Password](https://support.google.com/accounts/answer/185833) (not your normal password). Restart the backend, then **sign up again** with a new account so a verification email is sent.

### 2. Verify without email (use link from backend logs)

If email is **not** configured, the backend **logs the verification link** when you sign up. After creating an account:

1. Look at the **backend terminal** for a line like:
   - `Email not configured ... Verify manually by opening: http://localhost:3000/auth?verify=1&token=...`
   - or `Could not send verification email ... Verify manually: http://...`
2. **Copy that full URL** and open it in your browser. The app will call the verify endpoint and mark your email verified.
3. Then log in as usual.

If you already signed up and didn't save the link, use option 3 or 4 below.

### 3. Verify via API (if you have the token)

If you have the verification token (e.g. from MongoDB or Supabase `users.verification_token`):

- **Browser:** Open `http://localhost:3000/auth?verify=1&token=YOUR_TOKEN`
- **API:** `POST http://localhost:8000/api/v1/auth/verify-email/YOUR_TOKEN`

### 4. Allow login without verification (dev/demo only)

In **`backend/.env`** add:

```env
REQUIRE_EMAIL_VERIFICATION=false
```

Restart the backend. You can then **log in without verifying** that account. Use this only for local/dev or demo; keep it `true` in production.
