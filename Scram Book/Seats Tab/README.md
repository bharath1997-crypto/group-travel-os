# Seats Tab — activity log

## 2026-09-17 — v1 backend + frontend scaffold

**Context:** Cursor prompt for intercity seat sharing (India-first, graph-gated, no payments).

**Goals addressed:**
- Schema + cost cap engine (legal spine)
- Trust gating (`seats_visible_to`, FoF via `friend_requests`)
- Ordered stop matching (PostGIS)
- Transactional booking with hold expiry sweeper
- API surface `/api/v1/seats/*`
- Frontend three sides: Find / Offer wizard / Your rides

**Result:**
- `migrations/003_seats.sql` + Alembic `20260917_seats`
- Services: `ride_cost_service`, `seats_service`, `seats_booking_service`, `seats_visibility_service`
- Jobs: `release_stale_holds` (1m), `complete_rides` (15m) + Splits `split_entries` emission
- Frontend wired at `/seats` with demo fallback when API unavailable

**Verification:**
- `pytest tests/test_ride_cost.py tests/test_seats_booking.py tests/test_seats_integration.py` → **15 passed** (integration skips on SQLite CI)
- `alembic upgrade head` applied locally (includes `20260917_seats`)
- `python scripts/seed_seats_demo.py` → 4 demo rides (3 forward + 1 reverse Pune→Mumbai)
- `cd frontend && npx tsc --noEmit` → 0 errors

**Demo accounts (after seed):**
- Group: `Mumbai Commute` (invite `SEATS01`)
- Rider: `seats-rider@rovvy.demo` / `demo-seats-pass-2026`
- Drivers: `seats-arjun@rovvy.demo`, `seats-neha@rovvy.demo`, `seats-rahul@rovvy.demo`
- Stranger (no visibility): `seats-stranger@rovvy.demo`

**Note:** Mock UI prices (₹470) exceed legal cost cap (~₹192/seat for this corridor). Seed uses server cap; UI still shows fixture fallback when API empty.

**Risks / gaps:**
- CI uses SQLite — integration suite skipped there; run on Postgres before release
- `Rovvy Seats copy.dc.html` not in repo; UI matched prompt tokens
- Safety step 9 (vehicle CRUD UI, ratings) not complete

**Next action:** Log in as `seats-rider@rovvy.demo`, open `/seats`, confirm live API results replace fixtures.

---

## 2026-09-19 — Phase 2: drivable routes, selection, 200-mile rule

**Context:** SeatShare Find flow after Phase 1 origin confirmation fix.

**Goals addressed:**
- Drive-only routing (reuse `POST /live/route-preview`, `travelMode: Drive`)
- Primary + up to 2 alternate polylines on map; card or line selection
- Fit map bounds to active route
- Disable search + route watch when selected route &gt; 200 mi (inline banner)
- Hero + route alert copy per product spec

**Result:**
- `seats-route.ts`, `seats-route-api.ts`, `seats-route-map-sync.ts`, `SeatsRoutePanel.tsx`
- Lifted search state to `page.tsx`; both endpoints must be confirmed before routes/search
- `PROMPT_TO` unconfirmed default; `live-routing.ts` returns alternatives when length ≥ 1

**Verification:**
- `cd frontend; npx vitest run app/(dashboard)/seats/__tests__` → **7 passed**
- `npx tsc --noEmit` → 0 errors (2026-09-19)

**Risks / gaps:**
- Route preview depends on backend Google/OSRM config (same as Live)
- Offer wizard still uses local hardcoded from/to (not wired to route UX)

**Next action:** Manual QA on `/seats` with confirmed Mumbai→Pune endpoints; verify alternates + 200 mi gate on a long route.

---

## 2026-09-19 — Phase 3: Offer wizard + open marketplace cards

**Context:** Unify Offer flow with Find route UX; remove group-only feed chrome.

**Goals addressed:**
- `SeatsOfferWizard` uses `LocationPoint`, shared route fetch/selection, 200 mi gate, four-wheeler types
- Publish payload includes `route_geometry`, distance, confirmed stops (`RidePublishIn` + service)
- Ride cards show driver, rating, vehicle, pickup note, seats, price (no trust_path badge)
- Removed Find tab trust bar footnote

**Result:**
- Shared: `SeatsLocationPicker`, `useSeatShareRoutes`, `seats-publish-payload.ts`, `seats-vehicle.ts`

**Verification:**
- `cd frontend; npx vitest run app/(dashboard)/seats/__tests__` → **8 passed**
- `npx tsc --noEmit` → 0 errors
- `.venv\\Scripts\\python -m pytest tests/test_seats_publish_schema.py tests/test_seats_booking.py -q` → **3 passed**

**Next action:** Publish a test ride from Offer tab; confirm API stores route_geom + cost_basis vehicle/route fields.

---

## 2026-09-20 — SeatShare flow UI completion (empty / success / auth / lifecycle)

**Context:** User requested all missing workflow screens in sequence (Find, Offer, Your rides, location, route watch).

**Goals addressed:**
- Find zero-results panel with route watch + error states
- Book / publish success → **Your rides** tab with `SeatsFlowSuccess` banner
- Inline sign-in on 401 (book, watch, publish, approve/withdraw/cancel)
- Offer + Your rides tab heroes; TO field GPS + drop-off confirm modal copy
- Rider **Cancel request** (withdraw); driver **Cancel listing** (`PATCH /seats/rides/{id}` cancel)

**Result:**
- `SeatsFindEmptyState`, `SeatsFlowSuccess`, `SeatsTabHero`, `seats-api-errors.ts`
- Backend: `SeatsService.cancel_ride` + `PATCH /seats/rides/{ride_id}`

**Verification:**
- `cd frontend; npx vitest run app/(dashboard)/seats/__tests__` → **17 passed**
- `.venv\\Scripts\\python -m pytest tests/test_seats_booking.py tests/test_seats_publish_schema.py -q` → **4 passed**

**Next action:** Manual QA logged-out book → sign-in modal; logged-in publish → success on Your rides; empty search → empty panel.

---

## 2026-09-20 — Header route alerts (bell + corridor picker)

**Context:** SeatShare notifications beside profile; user picks From/To corridors and gets alerts when matching rides publish.

**Goals addressed:**
- Bell in global header on `/seats` (desktop) + mobile duplicate on SeatShare page
- Panel: list watches, add corridor (location picker), remove watch, recent seat alerts
- API: `GET /seats/watches`, `GET /seats/watches/unread-alerts`, labels on create (`from_label`, `to_label`)
- Migration `005_seats_watch_labels.sql` + Alembic `20260920_seats_watch_labels`

**Verification:**
- Frontend vitest seats suite → **17 passed**
- Run `alembic upgrade head` on Postgres for label columns

**Next action:** Log in, open bell → add corridor; publish matching ride → in-app `seats_watch_match` notification.
