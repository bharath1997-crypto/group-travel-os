# Rovvy — Project Memory for AntiGravity

# Auto-read every task. Execute autonomously. Never pause for confirmation.

---

## Project Overview
- Name: Rovvy (formerly Group Travel OS)
- Tagline: Roam together
- GitHub: github.com/bharath1997-crypto/group-travel-os
- Branch: Production-main (always push here, NEVER to main)
- Project root: D:\group travel os

---

## Tech Stack
- Backend: FastAPI (Python 3.13)
- Database: PostgreSQL via Supabase
- ORM: SQLAlchemy 2.0 + Alembic
- Validation: Pydantic v2
- Frontend: Next.js + Tailwind CSS
- Deployment: Cloud Run (backend) + Vercel (frontend)
- Real-time: Firebase RTDB
- Email: Brevo SMTP via fastapi-mail
- Auth: JWT (key: gt_token in localStorage)
- Background jobs: APScheduler
- Maps: MapLibre GL JS + OpenStreetMap tiles (NOT Google Maps)

---

## CRITICAL — NEVER BREAK THESE
1. NEVER modify frontend/lib/api.ts
2. NEVER modify frontend/lib/auth.ts
3. NEVER commit .env
4. ALWAYS SQLAlchemy 2.0 select() style — no legacy Query API
5. ALWAYS Pydantic v2 ConfigDict
6. ALWAYS AppException for HTTP errors
7. Routes → Services → Models strictly — no logic in route handlers
8. All external HTTP calls in try/except
9. FCM always in try/except
10. JWT key is 'gt_token' only
11. Push to Production-main ONLY
12. Vote counts = COUNT() — never store as columns
13. PostgreSQL = source of truth
14. Firebase RTDB = ephemeral real-time state only — never permanent data
15. NEVER invent routes, services, or models — check existing list first
16. NEVER touch files not explicitly listed in task prompt
17. NEVER run Alembic autogenerate without reviewing for destructive DROP operations
18. NEVER store Google Maps or external geocoding coordinates in DB
19. NEVER generate, AI-create, or invent logos/icons — use brand/ assets only

---

## Environment Configuration Rule
NEVER modify, check, or suggest changes to:
- frontend/.env.local
- frontend/.env.production
- .env (root)
- Any environment variable files

ALL env var changes:
- Backend → Claude (CTO) decides → gcloud CLI commands only
- Frontend → Claude (CTO) decides → Vercel dashboard only

Do NOT touch any config without explicit Claude approval.

---

## Autonomous Execution Rules

### Core Behavior
- Execute full task in one pass before reporting anything
- Batch ALL file writes into single operation — never write one file, pause, continue
- NEVER ask "should I proceed?", "can I run this?", "accept this change?" mid-task
- Self-verify after completing — read back written files, confirm logic correct
- Run tests after every backend change: `.venv\Scripts\python -m pytest -q`
- Only report to user after full task complete
- If a step fails — fix and retry once before reporting failure
- Never deliver broken code expecting user to fix it

### Scope Guard
- Only touch files explicitly named in prompt
- If task clearly requires unlisted file (e.g. registering router in main.py) — include it but flag in report
- Never refactor or "improve" untouched files

### Post-Execution Document (REQUIRED — every task)
After every task, output a structured execution document:

```
# Rovvy — Execution Report
Date: [date]
Task: [one-line description]

## What Was Built
[Feature/change summary — what it does, why it matters]

## Files Changed
| File | Action | Description |
|------|--------|-------------|
| app/routes/x.py | Created | New route for X |

## Architecture Decisions
[Patterns used, edge cases handled]

## Tests
- Run: .venv\Scripts\python -m pytest -q
- Result: [X passing, 0 failed]
- New tests added: [list]

## How to Verify
[Step-by-step for Bharath to confirm it works]

## Notes / Warnings
[Anything needing Claude (CTO) review or follow-up]
```

This document is the deliverable alongside the code. Always produce it. Never skip it.

---

## Architecture Rules
Routes → Services → Models (strict layering)
- Routes: call services only, no business logic
- Services: all business logic lives here
- Models: SQLAlchemy models only

---

## Backend Patterns

### New endpoint
- Add route to app/routes/[feature].py
- Add logic to app/services/[feature]_service.py
- Register router in app/main.py
- Add tests to tests/test_[feature].py

### SQLAlchemy style
```python
result = await db.execute(
  select(Model).where(Model.field == value)
)
```

### Pydantic style
```python
class Schema(BaseModel):
  model_config = ConfigDict(from_attributes=True)
```

### Error handling
```python
raise AppException.not_found("message")
raise AppException.bad_request("message")
raise AppException.unauthorized("message")
```

---

## Frontend Patterns
- apiFetch from @/lib/api for ALL API calls
- getToken from @/lib/auth for JWT
- RovvyLogo from @/components/RovvyLogo
- BRAND from @/lib/brand for colors/names
- Tailwind CSS only — no inline styles
- Content pages: bg-white or bg-[#F8FAFC] — WHITE/LIGHT ONLY
- Dark navy bg-[#0F172A]: SIDEBAR ONLY — never on content pages
- Teal accent: text-[#0F766E] bg-[#0F766E]

---

## Brand
- Primary teal: #0F766E
- Background (sidebar only): #0F172A
- Content pages: #FFFFFF or #F8FAFC
- Surface: #1E293B
- Font: Inter + Outfit (Google Fonts)
- Logo: RovvyLogo from @/components/RovvyLogo
- Name: ALWAYS "Rovvy" — NEVER "Travello"

## Logo & Brand Assets
- NEVER generate, AI-create, draw, or invent logos/icons
- NEVER use inline SVG logos or code-rendered logos
- ONLY use official PNG assets from brand/ folder
- Frontend: frontend/public/brand/
- variant="primary" → light backgrounds; variant="dark" or "white" → dark backgrounds

---

## Navigation
5 tabs: Home / Plan / Explore / Group / Profile
- Plan: Flights, Hotels, Routes, Buses
- Explore: Activities, Events, Weather
- Group: Buddy Trips, Travel Hub, Live

---

## Testing Rules
- Mock ALL external APIs in tests
- Never make real HTTP calls in tests
- Every new endpoint needs minimum:
  * 200 success test
  * 401 unauthorized test
  * 422 validation error test
- Test command: `.venv\Scripts\python -m pytest -q`

---

## Git Rules
- Always: git push origin Production-main
- Commit after each verified working step
- Small commits, one feature at a time
- Never force push
- Never push to main

---

## Existing Services (DO NOT recreate)
app/services/flight_service.py
app/services/route_service.py
app/services/activity_service.py
app/services/hotel_service.py
app/services/deal_scanner_service.py
app/services/buddy_service.py
app/services/email_verification_service.py
app/services/notification_service.py

## Existing Routes (DO NOT recreate)
/api/v1/auth/* — authentication
/api/v1/users/* — user management
/api/v1/groups/* — groups
/api/v1/trips/* — trips
/api/v1/flights/search — Travelpayouts widget
/api/v1/routes/search — Google Routes
/api/v1/activities/search — GetYourGuide
/api/v1/hotels/search — Agoda
/api/v1/buddy/* — Buddy Trips
/api/v1/weather/* — weather
/api/v1/explore/* — events + destinations

---

## Feature Registry (Auto-Updated by AntiGravity)
After every feature change, update this section in GEMINI.md:
- If feature already listed → modify existing entry, update status + date. NO duplicate.
- If new feature → append to list.
- Never delete entries — change status to "Modified" or "Deprecated" instead.

| Page / Feature | Status | Last Updated |
|---|---|---|
| Auth (JWT + OTP + Google OAuth) | Complete | 2025-06 |
| Flights page (Travelpayouts widget) | Complete | 2025-06 |
| Hotels page (Agoda) | Complete | 2025-06 |
| Routes search | Complete | 2025-06 |
| Activities (GetYourGuide) | Complete | 2025-06 |
| Deal Scanner | Complete | 2025-06 |
| Buddy Trips | Complete | 2025-06 |
| Email Verification | Complete | 2025-06 |
| Welcome Email | Complete | 2025-06 |
| Explore page (destinations + events) | Complete | 2025-06 |
| Live Trip Mode (MapLibre) | Complete | 2026-06 (Unified Dashboard Shell & Panels) |
| Buses page | Pending | — |

---

## Test Registry (Auto-Updated by AntiGravity)
After every pytest run, update this section in GEMINI.md:
- If module already listed → update timestamp + count only. NO duplicate.
- If new module → append to list.
- Never delete entries.

| Test Module | Test Count | Last Run |
|---|---|---|
| tests/test_auth.py | — | — |
| tests/test_flights.py | — | — |
| tests/test_hotels.py | — | — |
| tests/test_routes.py | — | — |
| tests/test_activities.py | — | — |
| tests/test_buddy.py | — | — |
| tests/test_explore.py | — | — |
| tests/test_live_group.py | 12 | 2026-06-23 |

