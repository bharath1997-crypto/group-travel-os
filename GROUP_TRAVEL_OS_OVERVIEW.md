# Group Travel OS — Project Overview (Consolidated)

This document summarizes the **Group Travel OS** stack, **repository layout**, **what has been built and fixed** during development and deployment work, and **commands / configuration** you are likely to use again.

---

## 1. What is Group Travel OS?

**Group Travel OS** is a **group travel planning and coordination** product:

- **Backend:** **FastAPI** (`app.main:app`), Python 3.13, **PostgreSQL** (local or **Supabase**), **SQLAlchemy** + **Alembic** migrations, **JWT** auth, **Google / Facebook OAuth**, optional **Firebase** (Realtime DB), **Stripe**, **OpenWeatherMap**, background **APScheduler** jobs (feed / polls), etc.
- **Frontend:** **Next.js** (App Router), TypeScript, dashboard UI (map, groups, feed, weather, etc.), talks to the API via `NEXT_PUBLIC_API_URL` / `frontend/lib/api.ts`.
- **Deploy targets discussed / used:** **Google Cloud Run** (API), **Vercel** (frontend), optional **Koyeb** config files exist in-repo.

**API prefix:** `/api/v1`  
**Health (no prefix):** `GET /health`

---

## 2. High-level repository structure

```
group-travel-os/                    # Python app root (also Docker build context)
├── app/                            # FastAPI application
│   ├── main.py                     # App factory, CORS, lifespan, route registration
│   ├── jobs/                       # APScheduler (feed refresh, poll auto-close)
│   ├── models/                     # SQLAlchemy models
│   ├── routes/                     # API routers (auth, groups, trips, oauth, …)
│   ├── schemas/                    # Pydantic schemas
│   ├── services/                   # Business logic (incl. oauth_service, auth_service, …)
│   └── utils/                      # database, auth helpers, firebase, exceptions, …
├── alembic/                        # Migrations (versions/*.py)
├── alembic.ini                     # Alembic config; URL overridden in env.py
├── alembic/env.py                  # DATABASE_URL from env or settings
├── config.py                       # Pydantic Settings (.env)
├── run.py                          # Local dev entry (uvicorn)
├── requirements.txt                # Full deps (incl. pytest, pyright for dev)
├── requirements-prod.txt         # Slim set for Docker / Cloud Build (no dev tools)
├── tests/                          # pytest
├── frontend/                       # Next.js app (Vercel root = this folder)
│   ├── app/                        # Routes (auth), dashboard, auth/callback, …
│   ├── components/
│   ├── lib/                        # api.ts (API_BASE), auth helpers
│   ├── public/
│   ├── .env.production             # NEXT_PUBLIC_API_URL for production builds
│   ├── tsconfig.json               # baseUrl + @/* paths for @/ imports
│   └── next.config.ts
├── scripts/
│   └── deploy-cloud-run.ps1        # Optional: build + deploy to Cloud Run
├── Dockerfile                    # python:3.13-slim, requirements-prod, uvicorn on PORT
├── .dockerignore
├── .gcloudignore                 # Shrinks gcloud upload (excludes frontend/, .venv, …)
├── Procfile / runtime.txt / koyeb.yaml   # Other hosting patterns (as added)
├── .env / .env.example           # Local secrets template (never commit .env)
└── firebase-credentials.json     # Local only; gitignored; do not commit
```

---

## 3. Configuration (environment variables)

**Backend (`config.py` / `.env`):**

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | JWT signing (required) |
| `DATABASE_URL` | PostgreSQL URL (required) |
| `FRONTEND_URL` | CORS / OAuth redirects (e.g. Vercel) |
| `API_PUBLIC_URL` | Public API base for OAuth `redirect_uri` (must match Google/Meta consoles) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook OAuth |
| `FIREBASE_CREDENTIALS_PATH` / `FIREBASE_DATABASE_URL` | Optional Firebase |
| `ALLOWED_ORIGINS` | CORS (often JSON array in production) |
| `DEBUG`, `ENVIRONMENT` | Docs visibility, logging |

**Frontend:**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Base URL for API (e.g. `https://…run.app/api/v1`) — used in `frontend/lib/api.ts` |

**Production (Cloud Run):** secrets and env vars are set in the **Cloud Run service** (and optionally **Secret Manager** for `DATABASE_URL`, `SECRET_KEY`, `GOOGLE_CLIENT_SECRET`, etc.). The running container does **not** read your laptop’s `.env`.

---

## 4. OAuth flow (summary)

1. Browser hits backend `GET /api/v1/auth/oauth/google/start` (or Facebook).
2. Backend redirects to Google/Facebook with signed `state`.
3. Provider redirects to `API_PUBLIC_URL/api/v1/auth/oauth/{provider}/callback`.
4. Backend exchanges code, finds/creates user, issues JWT, redirects browser to **`FRONTEND_URL/auth/callback?access_token=...`** (frontend route **`/auth/callback`** — not `(auth)/callback`, which would be `/callback` only).

**Google “sign-in is not configured”** means `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is missing in **that** environment (e.g. Cloud Run).

---

## 5. Database and migrations

- **Alembic:** `alembic upgrade head` (uses `DATABASE_URL` from environment or `settings` via `alembic/env.py`).
- **Supabase:** use connection string from Supabase dashboard; pooler vs direct host as documented by Supabase; URL-encode special characters in passwords.

---

## 6. Deployment artifacts (what exists in-repo)

| File | Role |
|------|------|
| `Dockerfile` | Production image: `gcc`/`libc6-dev`, `pip install -r requirements-prod.txt`, `uvicorn` on `${PORT:-8080}` |
| `requirements-prod.txt` | Same pins as `requirements.txt` minus pytest/pyright stack |
| `.dockerignore` | Keeps `frontend/`, `.env`, `.venv`, tests, etc. out of image |
| `.gcloudignore` | Keeps huge/locked paths out of **gcloud** source upload (critical on Windows) |
| `scripts/deploy-cloud-run.ps1` | `gcloud builds submit --tag` + `gcloud run deploy` with secrets |
| `Procfile`, `runtime.txt`, `koyeb.yaml` | Alternative platforms |

---

## 7. Chronology of work (this project / sessions — condensed)

This is a **narrative** of problems addressed and patterns established; your git history is authoritative.

1. **OAuth callback URL:** Frontend OAuth callback lives at **`/auth/callback`** (`frontend/app/auth/callback/page.tsx`) so it matches backend redirects to `/auth/callback`.
2. **Facebook authorize URL:** Explicit `response_type=code` added in OAuth service for parity with Google.
3. **Git / secrets:** `firebase-credentials.json` was removed from history (filter-branch / filter-repo) after **GitHub push protection** blocked pushes; **rotate** any leaked keys.
4. **Koyeb / Procfile / runtime / Alembic env:** Deployment-oriented files and `get_url()` for `DATABASE_URL` in Alembic.
5. **Cloud Run Dockerfile:** Split **`requirements-prod.txt`**, added compilers for pip, **`CMD`** listens on **`PORT`**.
6. **Cloud Run runtime:** App requires **`SECRET_KEY`** + **`DATABASE_URL`** at import; missing env → container exits; **`--set-secrets`** must use **`ENV=SecretName:version`**, not raw connection strings.
7. **gcloud upload:** **`.dockerignore` does not apply** to `gcloud builds submit` / `gcloud run deploy --source`**; **`.gcloudignore`** added; stop Next.js dev to avoid `.next` locks; huge uploads caused **WinError 32** until ignores were fixed.
8. **Artifact Registry:** Image push failed until a **Docker** repository existed (e.g. `cloud-run` in `asia-south1`) and **`gcloud auth configure-docker`** was done.
9. **Successful deploy:** Clean copy of backend to a temp folder **or** use `.gcloudignore`; service URL example: `https://group-travel-os-api-704551807369.asia-south1.run.app`.
10. **Vercel:** **`tsconfig.json`** `baseUrl` + `@/*` paths; **`frontend/.env.production`** with `NEXT_PUBLIC_API_URL`; **`api.ts`** uses `process.env.NEXT_PUBLIC_API_URL || http://localhost:8000/api/v1`.
11. **Google OAuth in prod:** Set **`GOOGLE_CLIENT_ID`**, **`GOOGLE_CLIENT_SECRET`**, **`API_PUBLIC_URL`**, **`FRONTEND_URL`** on Cloud Run; Google Console redirect URI must match **`…/api/v1/auth/oauth/google/callback`**.

---

## 8. Command reference (cheat sheet)

**Local backend (from repo root):**

```powershell
cd D:\Practice\group-travel-os\group-travel-os
.venv\Scripts\activate
python run.py
# or: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Tests:**

```powershell
pytest tests/ -q
```

**Alembic:**

```powershell
alembic upgrade head
alembic current
```

**Frontend:**

```powershell
cd frontend
npm install
npm run dev
```

**gcloud (examples — adjust project/region):**

```powershell
gcloud config set project group-travel-os
gcloud auth login
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Artifact Registry (once)
gcloud artifacts repositories create cloud-run --repository-format=docker --location=asia-south1
gcloud auth configure-docker asia-south1-docker.pkg.dev

# Secrets (values via stdin — do not commit)
echo YOUR_SECRET | gcloud secrets versions add SECRET_KEY --data-file=-

# Deploy (correct secret wiring)
gcloud run deploy group-travel-os-api --source . --region asia-south1 --allow-unauthenticated --port 8080 `
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest" `
  --set-env-vars="ENVIRONMENT=production,DEBUG=False,API_PUBLIC_URL=https://YOUR-API.run.app,FRONTEND_URL=https://YOUR-VERCEL.app"
```

**PowerShell:** use **`$env:VAR`** not **`%VAR%`**; **`gcloud`** stderr can confuse **`$ErrorActionPreference = Stop`** — the deploy script uses **`Continue`** during gcloud calls.

---

## 9. Security checklist

- Never commit **`.env`**, **`firebase-credentials.json`**, or OAuth **client secrets**.
- **Rotate** any secret that appeared in chat, CI logs, or a blocked push.
- **Supabase / DB:** rotate password if exposed.
- **Cloud Run:** prefer **Secret Manager** for `DATABASE_URL`, `SECRET_KEY`, `GOOGLE_CLIENT_SECRET`.

---

## 10. Where to go next

- Confirm **`GET /health`** on the deployed API.
- Run **migrations** against production DB once if not already applied.
- Complete **Google OAuth** env vars on Cloud Run and **JavaScript origins** for your Vercel domain in Google Cloud Console.
- Align **Stripe / OpenWeather / Facebook** env vars when you enable those features in production.

---

*This file is a snapshot for onboarding and operations; update it when the architecture or deploy flow changes.*
