# Rovvy — Project Memory for AntiGravity

## Project Overview
- Name: Rovvy (formerly Group Travel OS)
- Tagline: Roam together
- GitHub: github.com/bharath1997-crypto/group-travel-os
- Branch: Production-main (always push here)
- Project root: D:\group travel os

## Tech Stack
- Backend: FastAPI (Python 3.13)
- Database: PostgreSQL via Supabase
- ORM: SQLAlchemy 2.0 + Alembic
- Validation: Pydantic v2
- Frontend: Next.js + Tailwind CSS
- Deployment: Cloud Run + Vercel
- Real-time: Firebase RTDB
- Email: Brevo SMTP via fastapi-mail
- Auth: JWT (key: gt_token in localStorage)
- Background jobs: APScheduler

## Critical Rules — NEVER BREAK
1. NEVER modify frontend/lib/api.ts
2. NEVER modify frontend/lib/auth.ts
3. NEVER commit .env
4. ALWAYS SQLAlchemy 2.0 select() style
5. ALWAYS Pydantic v2 ConfigDict
6. ALWAYS AppException for HTTP errors
7. Routes → Services → Models strictly
8. All external calls in try/except
9. FCM always in try/except
10. JWT key is 'gt_token' only
11. Push to Production-main ONLY
12. Vote counts = COUNT() never columns
13. PostgreSQL = source of truth
14. Firebase RTDB = ephemeral only

## Brand
- Primary: #0F766E (teal)
- Background: #0F172A (navy)
- Surface: #1E293B
- Logo: RovvyLogo from @/components/RovvyLogo
- Name: ALWAYS "Rovvy" never "Travello"

## Navigation
5 tabs: Home/Plan/Explore/Group/Profile
- Plan: Flights, Hotels, Routes, Buses
- Explore: Activities, Events, Weather
- Group: Buddy Trips, Travel Hub, Live

## Current State
- Tests: 154 passing
- Phase 4 in progress
- Completed: Flights, Routes, Hotels,
  Activities, Deal Scanner, Buddy Trips,
  Email Verification, Welcome Email
- Next: Buses page

## Existing Services
app/services/flight_service.py
app/services/route_service.py
app/services/activity_service.py
app/services/hotel_service.py
app/services/deal_scanner_service.py
app/services/buddy_service.py
app/services/email_verification_service.py
app/services/notification_service.py

## Existing Routes
/api/v1/auth/*
/api/v1/users/*
/api/v1/groups/*
/api/v1/trips/*
/api/v1/flights/search
/api/v1/routes/search
/api/v1/activities/search
/api/v1/hotels/search
/api/v1/buddy/*
/api/v1/weather/*
/api/v1/explore/*

## Test Command
.venv\Scripts\python -m pytest -q
Expected: 154+ passing

## Deploy Command
git add .
git commit -m "message"
git push origin Production-main
