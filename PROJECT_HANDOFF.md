# Group Travel OS — Project handoff

This document describes **what the project is**, **how it is built**, **what is implemented today**, and **what was added in recent work**. Use it as context for tools like Claude when discussing architecture, features, or next steps.

---

## 1. What this project is

**Group Travel OS** (backend config name: `Group Travel OS`, `APP_VERSION` ~ `0.1.0`) is a **group travel planning and coordination** web application. The product UI often brands as **Travello** (logo, marketing copy).

**Core idea:** users belong to **groups** (crews). Each group can have **trips**, **locations / maps**, **polls**, **expenses**, **feed**, **weather**, **stats**, and related collaboration features. **Authentication** supports email/password, **Google** and **Facebook** OAuth, and **email verification** via SMTP.

**Typical local URLs:**

| Layer | URL |
|--------|-----|
| Next.js frontend | `http://localhost:3000` |
| FastAPI backend API | `http://localhost:8000` |
| API base (frontend env) | `NEXT_PUBLIC_API_URL` → defaults to `http://localhost:8000/api/v1` |

---

## 2. Technology stack

| Area | Choice |
|------|--------|
| **Backend** | Python **FastAPI**, **SQLAlchemy 2**, **Alembic** migrations, **PostgreSQL** |
| **Auth** | JWT (access tokens), **passlib/bcrypt**, **python-jose**; OAuth 2 for Google/Facebook |
| **Frontend** | **Next.js** (App Router), **React 19**, **TypeScript**, **Tailwind CSS** |
| **Email** | SMTP (e.g. Gmail App Password) for verification emails |
| **Payments** | **Stripe** (subscriptions — keys in env) |
| **Weather** | **OpenWeatherMap** API |
| **Other** | **Firebase Admin** (optional / phase-2 style), **APScheduler** for jobs |

---

## 3. Repository layout (high level)

```
group-travel-os/
├── app/                    # FastAPI application package
│   ├── main.py             # App factory, CORS, router registration
│   ├── models/             # SQLAlchemy ORM models
│   ├── routes/             # API routers (thin controllers)
│   ├── services/           # Business logic
│   ├── schemas/            # Pydantic request/response models
│   └── utils/              # DB, auth helpers, exceptions
├── alembic/                # DB migrations
├── config.py               # Pydantic Settings from .env
├── frontend/               # Next.js app
│   └── app/
│       ├── (auth)/         # Login, register, verify-email, join-by-code, forgot-password
│       ├── (dashboard)/    # Authenticated shell: trips, groups, feed, map, settings, …
│       ├── (share)/        # Public share pages (e.g. trip preview without forced login)
│       ├── auth/callback/  # OAuth return handling
│       └── page.tsx        # Marketing / landing
├── scripts/                # e.g. Cloud Run deploy scripts
├── requirements.txt
└── .env / .env.example     # Secrets — never commit .env
```

---

## 4. API surface (`/api/v1`)

Routers are mounted under **`/api/v1`** unless noted.

| Area | Router / prefix | Purpose |
|------|------------------|---------|
| Health | `GET /health` | No prefix; DB probe |
| Auth | `/auth/*` | Register, login, JWT, `/me`, profile PATCH, change password, OAuth start/callback, email verification send/confirm, **`POST /auth/presence`** (web presence) |
| Group join | `/groups/join`, `/groups/{id}/toggle-membership`, `/groups/join-requests/*` | Invite code requests; admin approve/deny |
| Groups | `/groups` | CRUD-style group operations, list, get, join by code, remove member, regenerate invite |
| Trips | `/groups/{group_id}/trips`, `/trips/*` | Trips nested under group; trip CRUD by id; **public preview**, **roster note**, **trip join requests** |
| Locations | `/locations`, `/trips/{id}/locations` | Saved places, attach to trips |
| Polls | trip polls + poll CRUD | Voting |
| Expenses | expenses | Split bills |
| Location shares, meet points, timers | various | Coordination features |
| Feed | feed | Activity feed |
| Stats, weather | stats, weather | Analytics / weather |
| Subscriptions | subscriptions | Stripe |
| Pins | pins | Saved pins |

**Notable newer endpoints (trips / social layer):**

- `GET /trips/{trip_id}/public` — **No auth required**; optional `Authorization` improves flags (`viewer_is_member`, etc.).
- `PATCH /trips/{trip_id}/roster` — Member sets optional **public trip note** (shown on public preview if `profile_public`).
- `POST /trips/{trip_id}/join-requests` — Authenticated user asks to join the **trip’s group** (respects `group.is_accepting_members`).
- `GET /trips/{trip_id}/join-requests` — Group **admins** list pending trip join requests.
- `PATCH /trips/join-requests/{request_id}/approve|deny` — Admin approves (adds `GroupMember`) or denies.

---

## 5. Data model (conceptual)

- **User** — identity, profile fields, `hashed_password`, OAuth IDs, `fcm_token` (mobile), flags `is_active`, `is_verified`, **`profile_public`** (controls name visibility on **public trip preview**).
- **Group** — name, description, **`invite_code`**, **`is_accepting_members`**, creator.
- **GroupMember** — role (`admin` | `member`), **`last_seen_at`** (web presence for green/red UI).
- **Trip** — belongs to a **group**; title, dates, status enum, creator.
- **TripRoster** — (`trip_id`, `user_id`) optional **note** (“what I’m looking forward to”) for public preview.
- **TripJoinRequest** — user requests access to trip’s group; **approve** adds **GroupMember**.
- **GroupJoinRequest** — separate flow for **invite code** join (pending/approve/deny).
- Plus: **locations**, **trip_locations**, **polls**, **expenses**, **feed**, **subscriptions**, **pins**, etc., as implemented in `app/models/`.

**Migrations:** `alembic/versions/` — run `alembic upgrade head` after pulling. A migration adds `profile_public`, `group_members.last_seen_at`, `trip_roster`, `trip_join_requests` (revision id `e5f6a7b8c9d0` in the branch that added this feature).

---

## 6. Frontend architecture

### Route groups

| Group | Purpose |
|--------|---------|
| **`(auth)`** | Pages that must not sit behind the **dashboard** user gate: login, register, **verify-email** (success/error after clicking email link), forgot-password, join by invite code. |
| **`(dashboard)`** | Wrapped by **`DashboardUserProvider`** + **`DashboardShell`** (sidebar: Dashboard, Trips, Groups, Feed, Map, Weather, Stats, Settings). Requires JWT in `localStorage` (`gt_token`); otherwise redirects to `/login`. Includes **`PresenceHeartbeat`** (periodic `POST /auth/presence`). |
| **`(share)`** | **Public** pages that must work **without** login — e.g. **`/trips/[tripId]`** preview so shared links from email/chat work in a cold browser session. |

### Important files

- `frontend/lib/api.ts` — `apiFetch` (attaches Bearer token when present).
- `frontend/contexts/dashboard-user-context.tsx` — Loads `/auth/me`; redirects unauthenticated users to login (reason verify-email was moved out of dashboard).
- `frontend/components/GroupsSplitLayout.tsx` — **Groups** left list + right detail area.
- `frontend/app/(share)/trips/[tripId]/page.tsx` — Public trip preview, join request, admin approve/deny, roster note for members.

### Environment

- `NEXT_PUBLIC_API_URL` — backend API base including `/api/v1` path segment as used by the client.

---

## 7. Authentication & verification flows

1. **Register / login** — JWT stored client-side; `/auth/me` for profile.
2. **OAuth** — Google/Facebook; redirect URIs must match **`API_PUBLIC_URL`** and app console settings (see `oauth_service`).
3. **Email verification** — SMTP settings in `.env`; user receives link to backend `GET /auth/verify-email/confirm?token=...` which then redirects to **`FRONTEND_URL/verify-email?verified=1`** (or error query params). The **verify-email page lives under `(auth)`** so logged-out users still see success/error (not bounced to login by the dashboard layout).
4. **Forgot password** — UI placeholder; full reset flow may be incomplete (check `forgot-password` page copy).

---

## 8. Product features — current state

### Implemented (representative)

- User profiles, profile completion hints, settings (including **public profile toggle** for trip previews).
- Groups: create, invite code, join (immediate or **request/approve**), membership toggle, group detail with **trips**, **members** with presence (**green/red**) and **mobile app** hint (📱 when `fcm_token` present).
- Trips: create per group; **trip UUID** as share id; **trips list** with search-by-id; **public trip page** (places, counts, public names + notes, no chat); **request to join**; **admins** approve/deny on same public page when logged in as group admin.
- Locations, polls, expenses, feed, map, weather, stats, subscriptions (Stripe), pins — wired in backend/routes; UI depth varies by screen.

### Intentionally not fully built / future

- **Invite-by-email** for people without accounts, rich “Facebook-style” inactive-user funnels beyond presence + FCM flag.
- **Trip-only membership** separate from group membership (today, joining the trip’s **group** is the join model).
- **Password reset email** end-to-end (if not completed).
- Hardening, analytics, mobile apps as first-class clients (FCM exists for future push).

---

## 9. Configuration (`.env`)

See **`.env.example`** for variables. Typical groups:

- **`SECRET_KEY`**, **`DATABASE_URL`**
- **`FRONTEND_URL`**, **`API_PUBLIC_URL`** (OAuth redirects)
- **Google / Facebook** OAuth client IDs/secrets
- **SMTP** — email verification
- **`OPENWEATHER_API_KEY`**
- **Stripe** keys and price id
- CORS: **`ALLOWED_ORIGINS`** (see `config.py` — supports JSON array or comma-separated URLs)

Never commit real `.env` files or live secrets into git.

---

## 10. How to run (development)

**Backend** (from repo root, with venv activated):

```bash
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend** (from `frontend/`):

```bash
npm install
npm run dev
```

Ensure PostgreSQL is running and `DATABASE_URL` is correct.

---

## 11. Deployment notes

- Scripts such as `scripts/deploy-cloud-run.ps1` target **Google Cloud Run** (adjust project/service names as needed).
- Health check: **`GET /health`**.
- Production: set **`DEBUG=False`**, restrict CORS origins, use strong **`SECRET_KEY`**, configure OAuth redirect URLs for production domains.

---

## 12. Recent work summary (for continuity)

This section captures **incremental features** discussed in development sessions (not necessarily exhaustive git history):

1. **Email verification** — DB columns on `User`, SMTP-backed send/confirm, register hook, public **`/verify-email`** page under **`(auth)`** so the success screen is visible without JWT.
2. **Trips / sharing** — Public **`GET /trips/{id}/public`**, **`TripRoster`** notes, **`TripJoinRequest`** with admin approve/deny, **`profile_public`**, **`group_members.last_seen_at`**, **`POST /auth/presence`**.
3. **Frontend** — **`(share)/trips/[tripId]`** for logged-out access; dashboard **Trips** page (create, list, open by ID); **Groups** split layout; **Settings** toggle for public profile; **PresenceHeartbeat** in shell.

---

## 13. Naming & branding

- **Backend / config:** “Group Travel OS”.
- **Frontend:** often **Travello** in UI (logo, auth screens).

---

## 14. Suggested questions for follow-up work

- Do we need **trip join requests** surfaced inside **group** admin UI only, or is the **public trip page** enough?
- Should **public trip** URLs use shorter codes (nanoid) instead of raw UUIDs?
- **Email invites** for non-users: new tables + transactional email vs. share-link only?

---

*Last updated to reflect the repository state at the time this file was written. If features drift, regenerate or patch sections from `app/main.py`, `app/models/`, and `frontend/app/`.*
