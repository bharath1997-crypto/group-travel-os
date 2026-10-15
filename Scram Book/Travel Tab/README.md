# Travel Tab — Scram Book

Authoritative planning and activity record for Rovvy Flights / Travel search.

## Artifacts

| File | Description |
|------|-------------|
| [Rovvy_Travel_Flights_Scrum_Plan.xlsx](./Rovvy_Travel_Flights_Scrum_Plan.xlsx) | Flights scrum plan |
| [Rovvy_Flights_Detailed_Product_Report.docx](./Rovvy_Flights_Detailed_Product_Report.docx) | Product report |
| [FL-045_WhiteLabel_Rollback.md](./FL-045_WhiteLabel_Rollback.md) | Travelpayouts white-label rollback |

## Activity log

### 2026-10-14 — Ground-only route intelligence (no flight planning)

- **Context:** Follow-up to flight product removal — route intelligence, Wayra, and UI must not suggest air travel (AGENTS.md §4).
- **Result:** Rewrote `route_intelligence_service` (drive/transit hints only; `ground_unavailable_reason` for long/intercontinental). Removed `FLIGHT_*` enums/segments. Scrubbed Wayra seeds, Live copy, consent/cookie text, scripts probes. Map POI “airports” category unchanged (Live search places only).
- **Verification:** `pytest -q` (sqlite CI) — **987 passed, 36 skipped**. `npx vitest run` — **549 passed**. `npx tsc --noEmit` — **0 errors** (after deleting `frontend/.next`).
- **Next action:** None unless owner wants `ground_unavailable_reason` surfaced in more Travel surfaces.

### 2026-10-14 — Flight product removed (owner decision; directions-only)

- **Context:** AGENTS.md §4 — no flight metasearch, booking, or provider work; keep A→B directions (`/routes`, Live handoff, route intelligence segments).
- **Result:** Removed backend `flights` router, flight services/schemas/models, deal scanner job, Duffel/Amadeus/Kiwi config; frontend `/flights` app tree and nav; ground-only `RouteService.search_routes`. Trip bookings accept `https://…` `provider_reference` only. Draft SQL `migrations/013_drop_flight_product.sql` (not applied).
- **Verification:** `pytest -q` (sqlite CI env) — **988 passed, 36 skipped**. `cd frontend; npx vitest run` — **549 passed**. `npx tsc --noEmit` — **0 errors** (regenerate `.next` types after route deletion). `python -c "import app.main"` — OK. `frontend/lib/api.ts` / `auth.ts` unchanged (no flight refs).
- **Risks:** Legacy `bookings.provider=duffel` enum retained for existing rows; user `home_airport` columns remain until optional migration columns are approved.
- **Next action:** Owner approves `013_drop_flight_product.sql` on production Postgres if `flight_bookings` should be dropped.

### 2026-09-14 — CI flight search / booking unblocks

- **Context:** CI failed because provider selection, booking, and search dates were tied too tightly to runtime keys and today's date.
- **Goals:** Keep Duffel when it is enabled; skip only extra unconfigured providers; let mocked book/order routes reach the service; stop rejecting static test dates that have aged out.
- **Result:** `enabled_providers()` no longer empties the list when Amadeus (or another extra adapter) lacks credentials. Booking no longer 503s before `get_offer` / `create_order` / `get_order`. Production still returns 503 when the Duffel client itself has no key. Metasearch route-recovery tests use relative future dates; past-date validation stays in production.
- **Verification:** `pytest tests/test_flight_provider_registry.py tests/test_flight_booking.py tests/test_flight_metasearch.py tests/test_amadeus_provider.py tests/test_flight_journey_service_unit.py` — 91 passed (2026-09-14).
- **Risks:** Duffel remains listed when enabled even without an API key; search still reports unconfigured and 503s when every returned provider is unconfigured.
- **Next action:** Re-run the failing CI job on Production-main after this is pushed.
