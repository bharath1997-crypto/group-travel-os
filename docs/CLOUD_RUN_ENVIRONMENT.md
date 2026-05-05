# Cloud Run environment — Group Travel OS API

This list is for **Google Cloud Run** (`group-travel-os-api`), not Cloud Storage. Use **Environment variables** (plain text) or **Secret Manager** (sensitive values) as noted.

Your screenshot already has **`FRONTEND_URL`** and **`API_PUBLIC_URL`** — good.  
**`GOOGLE_CLIENT_ID` is missing** in the UI you shared; without it, Google sign-in will not work (`Google sign-in is not configured`).

---

## 1. Required (app will not behave correctly without these)

| Name | Where to put it | Example / notes |
|------|------------------|-----------------|
| `DATABASE_URL` | Secret → env | PostgreSQL connection string (you already map this). |
| `SECRET_KEY` | Secret → env | Long random string for JWT / OAuth state (you already map this). |
| `FRONTEND_URL` | Plain env | `https://group-travel-os.vercel.app` — **no trailing slash**. OAuth redirects here after login. |
| `API_PUBLIC_URL` | Plain env | `https://group-travel-os-api-XXXXX.asia-south1.run.app` — **no** `/api/v1`. Must match the public URL Google redirects back to. |
| `ALLOWED_ORIGINS` | Plain env | **Add this.** CORS for your Next.js app. Example: `https://group-travel-os.vercel.app` or comma-separated list including preview URLs if you use them. |
| `GOOGLE_CLIENT_ID` | Plain env **or** Secret | OAuth **Web client** ID from Google Cloud Console (same as `NEXT_PUBLIC_GOOGLE_CLIENT_ID` on Vercel). **You had the secret but not the ID.** |
| `GOOGLE_CLIENT_SECRET` | Secret → env | You already have this. Value must be the plain `GOCSPX-…` string, not JSON. |

### Google Cloud Console (OAuth client)

Under **Authorized redirect URIs**, add **exactly** (replace host if yours differs):

```text
https://group-travel-os-api-704551807369.asia-south1.run.app/api/v1/auth/oauth/google/callback
```

Under **Authorized JavaScript origins**, add:

```text
https://group-travel-os.vercel.app
```

---

## 2. Strongly recommended

| Name | Notes |
|------|--------|
| `ENVIRONMENT` | Set to `production`. |
| `DEBUG` | Omit or `false` in production. |
| `FACEBOOK_APP_ID` | Plain env, if you use Facebook login. |
| `FACEBOOK_APP_SECRET` | You already map this secret. |

---

## 3. Optional (feature-dependent)

Only add if you use the feature on production.

| Name | Purpose |
|------|--------|
| `BREVO_API_KEY` | Transactional email (verification, password reset HTML). |
| `FROM_EMAIL` | Default `noreply@travello.app` if unset. |
| `FROM_NAME` | Default `Travello` if unset. |
| `FIREBASE_CREDENTIALS_PATH` | Usually not set on Cloud Run; prefer mounting JSON or using ADC — follow how you deploy Firebase Admin. |
| `FIREBASE_DATABASE_URL` | If the API uses Realtime Database. |
| `OPENAI_API_KEY` | AI assistant features. |
| `OPENWEATHER_API_KEY` | Weather endpoints. |
| `STRIPE_SECRET_KEY` | Payments. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks. |
| `STRIPE_PRO_PRICE_ID` | Subscription price id. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS/OTP. |
| `SMTP_*` | Alternative to Brevo for email. |

---

## 4. Vercel (Next.js) — separate from Cloud Run

These are **not** on Cloud Run; set them in **Vercel → Environment Variables** (Production):

| Name | Example |
|------|--------|
| `NEXT_PUBLIC_API_URL` | `https://group-travel-os-api-704551807369.asia-south1.run.app/api/v1` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same Web client ID as `GOOGLE_CLIENT_ID` on the API. |
| `NEXT_PUBLIC_*` Firebase keys | As in your `frontend/.env.local`. |

Redeploy Vercel after changing `NEXT_PUBLIC_*`.

---

## 5. Why variables “changed” or disappeared

- **Cloud Build trigger** can redeploy a revision from CI; if the **service YAML** or Terraform only declares some variables, a deploy can **replace** the service definition. After any infra-as-code change, re-check **Cloud Run → Edit & deploy new revision → Variables & secrets**.
- Prefer **keeping this checklist in git** and documenting **one source of truth** (e.g. `cloudbuild.yaml` or Terraform) so prod env does not drift.

---

## 6. Minimum patch for your current issue (Google + localhost redirect)

1. Add **`GOOGLE_CLIENT_ID`** to Cloud Run (same value as in Google OAuth client + Vercel).
2. Add **`ALLOWED_ORIGINS`** = `https://group-travel-os.vercel.app` (and any other origins you need).
3. Confirm **`FRONTEND_URL`** and **`API_PUBLIC_URL`** match production URLs (your screenshot looks correct).
4. Confirm **Google redirect URI** matches `{API_PUBLIC_URL}/api/v1/auth/oauth/google/callback` exactly.
5. Redeploy API if needed; redeploy **Vercel** if `NEXT_PUBLIC_API_URL` was wrong.

---

## Copy-paste block (adjust secrets / placeholders)

Plain environment variables (Cloud Run UI):

```env
FRONTEND_URL=https://group-travel-os.vercel.app
API_PUBLIC_URL=https://group-travel-os-api-704551807369.asia-south1.run.app
ALLOWED_ORIGINS=https://group-travel-os.vercel.app
ENVIRONMENT=production
GOOGLE_CLIENT_ID=paste-your-google-oauth-web-client-id.apps.googleusercontent.com
FACEBOOK_APP_ID=paste-if-using-facebook
```

Secrets (create in Secret Manager, then **reference** as env vars):

- `DATABASE_URL`
- `SECRET_KEY`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_APP_SECRET`
- Optional: `BREVO_API_KEY`, `STRIPE_SECRET_KEY`, etc.

Do **not** commit real secrets into this file; only use the console / Secret Manager.
