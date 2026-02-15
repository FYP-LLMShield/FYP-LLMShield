# Email setup checklist (verification + password reset)

Use this after setting `EMAIL_USERNAME`, `EMAIL_PASSWORD`, etc. in `.env`.

---

## 1. Security (important)

**If you ever shared your App Password** (e.g. in chat or in a screenshot):

1. Go to [Google Account → Security → App passwords](https://myaccount.google.com/apppasswords).
2. **Revoke** the old app password.
3. **Create a new** App Password and put the new value in `.env` as `EMAIL_PASSWORD=...`.
4. Restart the backend.

Never commit `.env` or share it; it’s in `.gitignore` for a reason.

---

## 2. Double-check .env

- **Variable names** (exact):
  - `EMAIL_USERNAME=team.llmshield@gmail.com`
  - `EMAIL_PASSWORD=<your-16-char-app-password>`
  - `SMTP_SERVER=smtp.gmail.com`
  - `SMTP_PORT=587`
- **No spaces** around `=` and no quotes unless the value has spaces.
- **File location**: backend loads **both**:
  - Project root: `FYP-LLMShield/.env`
  - Backend folder: `FYP-LLMShield/backend/.env`  
  Use one of these; backend folder overrides root for the same variable.

---

## 3. Gmail requirements

- **2-Step Verification** is turned on (required for App Passwords).
- **App Password** is 16 characters, from Google Account → Security → App passwords (not your normal Gmail password).
- If you use “Less secure app access”, that’s deprecated; use an App Password instead.

---

## 4. Optional but useful

- **Display name in inbox:**  
  `EMAIL_FROM_NAME=LLMShield Team`  
  (so the sender shows as “LLMShield Team” instead of only the address.)

- **Reset link URL:**  
  If the app is not at `http://localhost:3000`, set:  
  `FRONTEND_URL=https://your-actual-frontend-url`  
  so the “Reset your password” link in the email points to the right place.

---

## 5. What to do next

1. **Restart the backend** after any `.env` change (env is read at startup).
2. **Confirm in logs** on startup you see:  
   `Email: configured (verification and password-reset emails will be sent)`  
   If you see “Email: not configured”, the backend is not reading the vars (check file path and variable names).
3. **Test password reset**
   - Log in form: enter an email that exists in **MongoDB** (e.g. from backend signup).
   - Click **Forgot password?** (no extra box; it uses that email).
   - In the **backend terminal** you should see either:
     - `Password reset email sent to <email>` → email was sent; check inbox and spam.
     - `Password reset requested but email send failed for <email>` → SMTP/config issue; fix `EMAIL_*` and SMTP.
     - `Password reset requested for non-existent email` → that user is not in MongoDB; use an account created via your app’s signup (email/password).
4. **Test verification email**
   - Sign up with a **new** email/password.
   - Check that inbox (and spam) for “Verify your email - LLMShield” from team.llmshield@gmail.com.

---

## 6. If email still doesn’t arrive

- Check **spam/junk** and “Promotions” (Gmail).
- In **backend logs**, look for “email send failed” or SMTP errors (e.g. authentication failed, connection refused).
- Confirm the **user exists in MongoDB** for password reset (backend signup or dual-write from Supabase).
- Try sending from the same Gmail account in another client (e.g. Thunderbird) to confirm the App Password works.
