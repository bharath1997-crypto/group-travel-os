# Group Travel OS — Project reference (structure, phases, roadmap)

This document answers: **what the project is**, how the **repository is structured**, what **“stretch” / future work** means in this codebase (there is **no** first-class concept named *stretcher*), and where to read more.

---

## 1. “Stretcher” vs what actually exists in the repo

| Term | In this project |
|------|------------------|
| **Stretcher** | **Not used** as a product or architecture term anywhere in the backend/frontend source. |
| **`items-stretch`** | Appears only as **Tailwind CSS** layout classes (e.g. `flex … items-stretch`) — flex alignment, not a feature name. |
| **Stretch goals / later work** | Documented in **`PROJECT_HANDOFF.md`** (section *Intentionally not fully built / future*) and in **`config.py`** comments (**Phase 2** Firebase, **Phase 3** OpenWeather + Stripe). |
| **Structures** | If you meant **structures**, that maps to: **folder layout**, **API routers**, **SQLAlchemy models**, **Next.js route groups**, and **services** — all summarized below. |

For day-to-day onboarding, prefer **`GROUP_TRAVEL_OS_OVERVIEW.md`** (stack, deploy, commands) and **`PROJECT_HANDOFF.md`** (features, flows, data model). This file is the **inventory-style** companion.

---

## 2. What Group Travel OS is

- **Product:** Group travel **planning and coordination** (groups/crews, trips, places, polls, expenses, feed, map, weather, subscriptions, AI assistant, social/notifications, etc.).
- **Backend:** **FastAPI**, Python 3.13, **PostgreSQL**, **SQLAlchemy** + **Alembic**, **JWT** auth, **Google/Facebook OAuth**, optional integrations (Firebase, Stripe, OpenWeather, OpenAI/Gemini, Brevo/SMTP, Twilio).
- **Frontend:** **Next.js** (App Router), TypeScript, Tailwind. UI often brands as **Travello**; backend settings use **Group Travel OS**.
- **API base:** `/api/v1` for feature routes; **`GET /health`** has no prefix.

---

## 3. Repository structure (top level)

```
group-travel-os/                 # Python app root; Docker build context
├── app/                         # FastAPI package
│   ├── main.py                  # App factory, CORS, lifespan, router registration
│   ├── jobs/                    # APScheduler (feed trending, poll auto-close)
│   ├── models/                  # SQLAlchemy ORM
│   ├── routes/                  # HTTP routers (thin)
│   ├── schemas/                 # Pydantic I/O models
│   ├── services/                # Business logic
│   └── utils/                   # DB, auth, firebase, exceptions, …
├── alembic/                     # Migrations
├── config.py                    # Pydantic Settings from .env
├── run.py                       # Local dev (uvicorn)
├── requirements.txt             # Full deps
├── requirements-prod.txt        # Slim image deps
├── tests/                       # pytest
├── frontend/                    # Next.js (Vercel root = this folder)
├── scripts/                     # e.g. Cloud Run deploy
├── docs/                        # Operational / reference markdown
├── Dockerfile, .dockerignore, .gcloudignore
├── GROUP_TRAVEL_OS_OVERVIEW.md
├── PROJECT_HANDOFF.md
└── .env / .env.example          # Secrets — never commit .env
```

---

## 4. Backend: registered API routers

All of the following are mounted under **`/api/v1`** from `app/main.py` (order matters for some path overlaps; e.g. join-requests before groups).

| Router module | Role (high level) |
|---------------|-------------------|
| `app.routes.auth` | Register, login, JWT, `/me`, OAuth, email verification, **presence** |
| `app.routes.join_requests` | Group invite-code join requests |
| `app.routes.groups` | Groups CRUD, membership, invite codes |
| `app.routes.trips` | Trips under groups + trip-by-id routes (incl. public preview, roster, join requests) |
| `app.routes.locations` | Saved locations + trip locations |
| `app.routes.polls` | Polls + trip polls |
| `app.routes.expenses` | Expenses + currency rates |
| `app.routes.location_shares` | Live location sharing sessions |
| `app.routes.meet_points` | Meet points + trip-scoped meet points |
| `app.routes.timers` | Timers |
| `app.routes.feed` | Activity feed |
| `app.routes.stats` | Stats |
| `app.routes.weather` | Weather (needs API key in env) |
| `app.routes.subscriptions` | Stripe subscriptions |
| `app.routes.pins` | Saved pins |
| `app.routes.ai_assistant` | AI assistant API |
| `app.routes.notifications` | Notifications |
| `app.routes.invitations` | Group invitations |
| `app.routes.users` | User-related endpoints |
| `app.routes.social` | Social graph (friends, block, etc.) |
| `app.routes.app_settings` | Per-user app settings |

---

## 5. Backend: data model modules (`app/models/`)

Conceptual entities (each has a `.py` file unless noted):

- **User** — auth profile, verification, OAuth ids, optional `fcm_token`, flags such as **`profile_public`**
- **Group**, **GroupMember**, **MemberRole** — crews + roles + **`last_seen_at`** (presence)
- **GroupJoinRequest** — invite-code approval flow
- **Trip**, **TripStatus** — trips belong to a group
- **TripJoinRequest**, **TripRoster** — public trip sharing + join + roster notes
- **Location**, **TripLocation** — places + attachment to trips
- **LocationShare** — file header describes live session (**Phase 2**-style wording in code)
- **MeetPoint**, **MeetPointAttendance** — file header references **Phase 2** in code comments
- **Destination**
- **Poll**, **PollOption**, **Vote**, enums **PollType**, **PollStatus**
- **CurrencyRate**, **Expense**, **ExpenseSplit**
- **Subscription** (Stripe)
- **GroupInvitation**
- **Notification**
- **FriendRequest**, **BlockedUser**
- **UserAppSettings**
- **SavedPin** — model file `saved_pin.py` (also referenced in `__all__` in `models/__init__.py`)

Alembic revisions under `alembic/versions/` are the source of truth for the live schema history.

---

## 6. Backend: services (`app/services/`)

Business logic is split into modules such as:

`auth_service`, `oauth_service`, `group_service`, `trip_service`, `trip_public_service`, `trip_join_request_service`, `join_request_service`, `location_service`, `location_share_service`, `poll_service`, `expense_service`, `currency_service`, `feed_service`, `meet_point_service`, `timer_service`, `weather_service`, `stats_service`, `subscription_service`, `pin_service`, `notification_service`, `invitation_service`, `social_service`, `presence_service`, `email_service`, `email_verification_service`, `ai_assistant_service`, `app_settings_service`.

---

## 7. Background jobs (`app/jobs/`)

**APScheduler** (`app/jobs/scheduler.py`):

- **Weekly:** `recalculate_trending_scores` (feed)
- **Hourly:** `auto_close_expired_polls`

---

## 8. Configuration “phases” (stretch / optional integrations)

From `config.py` comments and optional env vars:

| Phase / area | Meaning |
|--------------|---------|
| **Firebase** | Commented as **Phase 2** — optional `FIREBASE_CREDENTIALS_PATH`, `FIREBASE_DATABASE_URL`; startup in `main.py` attempts `get_firebase_app()`. |
| **OpenWeatherMap** | Commented as **Phase 3** — `OPENWEATHER_API_KEY`; weather routes. |
| **Stripe** | Commented as **Phase 3** — `STRIPE_*`, `STRIPE_PRO_PRICE_ID`. |
| **OpenAI / Gemini** | AI assistant — `OPENAI_API_KEY`, `GEMINI_API_KEY` (Gemini described as primary engine in settings comments). |
| **Brevo / SMTP** | Transactional email (verification, etc.). |
| **Twilio** | SMS/WhatsApp OTP fields. |

Full variable lists: **`.env.example`**, **`docs/CLOUD_RUN_ENVIRONMENT.md`** (production checklist).

---

## 9. Frontend: route groups and pages

### Route groups

| Group | Purpose |
|--------|---------|
| **`(auth)`** | Login, register, verify-email, join by invite path, forgot/reset password, phone, resend verification — **outside** dashboard auth gate. |
| **`(dashboard)`** | Authenticated shell: dashboard, trips, travel-hub, feed, map, weather, stats, buddies, notifications, subscription, settings, onboarding, complete-profile, etc. |
| **`(share)`** | Public share UI, e.g. **`/s/trips/[tripId]`** for trip preview without login. |
| **`auth/callback`** | OAuth return (`/auth/callback`). |
| **`auth/phone`** | Duplicate path segment under `auth/` for phone flow (as listed in tree). |
| **Root** | `app/page.tsx` — marketing/landing. |
| **`join`** | `app/join/page.tsx` — join flow page (top-level, not under `(auth)`). |

### Page inventory (`frontend/app/**/page.tsx`)

Landing: `page.tsx`.  
Auth: `(auth)/login`, `register`, `verify-email`, `forgot-password`, `reset-password`, `phone`, `join/[invite_code]`, `resend-verification`.  
OAuth: `auth/callback/page.tsx`, `auth/phone/page.tsx`.  
Dashboard: `dashboard`, `trips`, `trips/[id]`, `trips/plan`, `travel-hub`, `travel-hub/[groupId]`, `travel-hub/[groupId]/profile`, `feed`, `map`, `weather`, `stats`, `split-activities`, `buddies`, `notifications`, `subscription`, `complete-profile`, `onboarding`, `profile`, plus extensive **`settings/*`**.  
Share: `(share)/s/trips/[tripId]`.  
Join: `join/page.tsx`.

---

## 10. Product roadmap / “not done yet” (from handoff + UI)

From **`PROJECT_HANDOFF.md`** §8 (*future*), condensed:

- Rich **invite-by-email** for people without accounts.
- **Trip-only membership** distinct from group membership (today joining the trip’s **group** is the model).
- **Password reset** end-to-end if not completed everywhere.
- More **hardening**, **analytics**, first-class **mobile** clients (FCM exists as a hook).

From the app UI copy (`settings/usage`): **activity log** is called out as on the **roadmap**.

---

## 11. Other markdown docs in the repo

| File | Contents |
|------|----------|
| `GROUP_TRAVEL_OS_OVERVIEW.md` | Consolidated stack, deploy chronology, commands, security |
| `PROJECT_HANDOFF.md` | Product narrative, API surface, flows, data model, frontend architecture |
| `docs/CLOUD_RUN_ENVIRONMENT.md` | Cloud Run + Vercel env var checklist |
| `frontend/README.md` | Default Next.js starter readme (minimal project-specific detail) |
| `frontend/AGENTS.md` | Short Next.js agent note (upstream breaking changes reminder) |
| `.agents/` / `.augment/` skills | Third-party Postgres skill packs, not product spec |

---

## 12. How to keep this file accurate

- **Routers:** `app/main.py` → `_register_routes`.
- **Models:** `app/models/*.py` and `alembic/versions/`.
- **Pages:** `frontend/app/**/page.tsx`.
- **Deploy/env:** `config.py`, `.env.example`, `docs/CLOUD_RUN_ENVIRONMENT.md`.

---

*Generated as a structural inventory. Update sections when you add routers, models, or major UI routes.*
