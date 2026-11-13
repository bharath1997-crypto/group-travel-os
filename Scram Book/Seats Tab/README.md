# Seats Tab — activity log

## Artifacts

| File | Description |
|------|-------------|
| [Rovvy_Seats_Scrum_Book.xlsx](./Rovvy_Seats_Scrum_Book.xlsx) | 263-item SeatShare feature, UI and graphics inventory (incl. missing capabilities) in the Live/Explorer tracker format. **Seats Tasks** column **L** = Cursor development plan per row; worksheet **Cursor Context Log** = full raw log (263 rows). The `Review` tab holds Critical findings, sprint plan S1–S5, per-change test plan and workbook rules. |

---

## 2026-11-13 — Offer wizard batch 1 (timezone, price units, cost step, review, draft)

**Context:** Owner asked for the offer-a-ride flow to be fixed and extended in batches; batch 1 is front end only.

**Goals addressed:** S132, S138, S140, S142, S143, S151 (all recorded as Partial, see below).

**Result:**
- Departure is built from the pickup's time zone (`seats-time.ts`: India = Asia/Kolkata, elsewhere the device zone) instead of a fixed +05:30; date input has `min` = today there; departures under 15 minutes away are blocked.
- Price input takes normal units (12.50) with a "Use the max" button (`seats-price-input.ts`); no default price; it fills from the server cap.
- Cost step: Tolls row shows real tolls or "Not included" with a separate total row; a failed preview shows an error with Try again, and the price field and Publish stay blocked until the cap loads.
- New step 4 "Review your ride" before publishing (progress bar is now 4 segments).
- Unfinished ride is saved in this browser (`seats-offer-draft.ts`, localStorage, try/catch) and restored with a Start over link; a successful publish clears everything (vehicle, time, seats, approval, price too).

**Verification:** `npx vitest run "app/(dashboard)/seats"` → 10 files, 39 passed (11 new); `npx tsc --noEmit` clean. Browser: `/seats` Offer tab shows "step 1 of 4", no console errors. Steps 2-4 were not driven in the browser (needs live route and cost APIs).

**Risks:** Rows stay Partial until steps 2-4 are checked in a browser. Region is still `IN-MH` and the cap data exists for Maharashtra only, so US trips (like Chicago) still cannot get a real cap; that is batch 2 backend work. Currency is still a relabel of INR (S145). Nothing pushed; production database untouched.

**Next action:** Browser-drive steps 2-4, then batch 2 (return trip, recurring rides, luggage and rider rules, vehicle details; needs a migration and your approval).

---

## 2026-10-18 — Sprint S1 critical fixes (crash, cancel, guest states, demo fallback)

**Context:** Owner decision (same day) scoped Sprint S1: five critical findings from 2026-09-27 without payments, currency/timezone, trust signals, or companion feature.

**Goals addressed:** Tab-switch map crash; driver cancel booking status + rider notifications; truthful guest 401 on search and `/seats/me`; remove demo fixture on API errors; rider cancel confirmed seat; block driver self-book.

**Result:**
- Frontend: `removeSeatShareRouteLayers` + cleanup before `map.remove()` (`seats-route-map-sync.ts`, `SeatsRoutePanel.tsx`); search/me load resolution (`seats-load-state.ts`, `SeatsPageClient.tsx`); auth/error empty states (`SeatsFindEmptyState.tsx`, `SeatsYourRidesTab.tsx`); confirmed **Cancel seat** in Your rides.
- Backend: `cancel_ride` → `cancelled_driver` + in-app `seats_cancelled`; `create_booking` self-book guard; `withdraw_booking` allows `confirmed`.

**Verification:**
- `pytest tests/test_seats_booking.py tests/test_seats_integration.py tests/test_seats_publish_schema.py tests/test_seats_s1.py -q` → **9 passed**, 8 skipped (Postgres integration).
- `cd frontend; npx vitest run app/(dashboard)/seats` → **9 files, 28 passed**.
- `cd frontend; npx tsc --noEmit` → **0 errors**.

**Risks:** Authenticated two-party cancel/notify flows not exercised in browser this session; notification delivery still depends on existing notification pipeline.

**Next action:** Product decision India-only vs multi-market, then Sprint S2 (currency/timezone).

---

## 2026-10-18 — Owner decision: Seats only for first launch (no companions feature yet)

**Context:** Owner discussed a "travel companion" community feature (find new people to go with, not dating) alongside seat sharing, then clarified the seat-share app is the existing Seats tab.

**Decision:** First launch keeps **Seats as built** (cost-capped, no in-app payments, friend/friend-of-friend visibility) and fixes the seven Critical findings of 2026-09-27 (Sprint S1 first). The companion feature is **deferred until after launch**; when built it should attach to an Explore event/place, reuse Seats' trust rules and Lounge chat, and stay destination-based (not dating).

**Verification:** none (decision record only; no code changed).

**Risks:** companion safety/ID verification and any charging beyond cost-sharing need legal review in the launch country before they are built.

**Next action:** Cursor works Sprint S1 (tab-switch crash, cancel-listing status + rider notification, guest 401 states, remove demo fallback, regression tests), then the India-only vs multi-market decision before S2.

---

## 2026-09-27 — Seats feature inventory, criticality review and sprint plan

**Context:** User asked for the same Excel inventory and analysis used for the Live tab, applied to the Seats (SeatShare) tab, plus a plan for how the work will be run.

**Goals addressed:** Catalogue every separately assessable Seats control, display, action and backend behavior. Separate status from importance and difficulty. Record evidence and acceptance checks. List missing capabilities. Define the sprint order and the test plan.

**Result:** Created `Rovvy_Seats_Scrum_Book.xlsx` with **263 items** (S001–S263) in `Seats Tasks` and a `Review` tab. Importance: **83 Critical, 134 Important, 46 Later**. Status: **133 Complete in code, 86 Partial, 44 Pending**. The workbook has 19 workstreams, from Page shell through Testing & QA. Format matches Live: table, frozen header, status/importance/difficulty dropdowns, same color rules.

**Critical findings (not fixed in this review):**
1. **Crash:** after a route loads on Find, switching to Your rides throws `Cannot read properties of undefined (reading 'getLayer')`. The route map layer cleanup runs after `map.remove()` (`SeatsRoutePanel.tsx` / `seats-route-map-sync.ts`). Reproduced in the browser.
2. **Cancel listing fails when riders exist:** `cancel_ride` writes booking status `cancelled`, which is not in the `ride_bookings` CHECK list (`cancelled_driver` expected). Riders are also never notified.
3. **Guest states are untruthful:** a 401 on search shows "No matches", and a 401 on `/seats/me` shows empty rides. Any search error falls back to demo fixture rides.
4. **Currency and timezone:** the UI relabels INR paise as another currency. The server formats everything as ₹. Fuel data exists for IN-MH only. Search, publish and display times are hard-coded to IST.
5. **Placeholder trust signals:** the rating is a formula, "Verified" only means a phone number is on file, ride count is always 0, and "Best rated" actually sorts by time.
6. **Pricing step:** the Tolls row shows the total cost. The price input takes raw paise. The preview uses straight-line distance while publish uses road distance. A failed preview stays on "Loading…" and keeps the ₹470 default price.
7. **Lifecycle gaps:** requests made within 2 h of departure expire immediately. Withdrawn and expired bookings disappear from history. A rider can't cancel a confirmed seat. A driver can book their own ride. "Open in Splits" has no reader for `split_entries`.

**Verification:**
- Browser, `localhost:3000/seats`, logged out: Mumbai→Pune autocomplete took >3 s; 3 route options; route map painted after about 15 s; `/seats/rides` 401 showed "No matches"; the tab-switch crash was reproduced; Offer step 1 and Your rides were viewed; at 375 px there was no horizontal overflow. Nothing was submitted: no sign-in, publish, booking or watch.
- `npx vitest run app/(dashboard)/seats/__tests__`: **6 files, 17 passed**.
- `pytest test_ride_cost test_seats_booking test_seats_publish_schema test_seats_integration`: **17 passed**, including 8 integration tests on local Postgres.
- The workbook reopened with 263 unique, fully populated IDs, table `A6:K269`, and dropdowns and COUNTIFs to row 269. Formulas recalculate on open, since LibreOffice isn't installed here to cache values. The workbook was not rendered visually.

**Unresolved risks:** Rows marked Code only need runtime checks. Authenticated and two-party flows, notification delivery, real GPS and non-India markets were not exercised. Priorities for missing capabilities need product-owner confirmation. The `graphify` CLI is not installed in this shell. No application code was changed.

**Next action:** Sprint S1: fix the tab-switch crash, the cancel-listing status and rider notifications, and the guest 401 states; remove the demo fallback; add regression tests. Then decide on India-only vs multi-market before Sprint S2 (currency and timezone).

---

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
