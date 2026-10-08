# Scaper — Ticketmaster for all 50 US states (build spec)

Status: **approved by owner 2026-10-05; assigned to Cursor.** Pilot first (AK, TX, CA), then
all 50 states only after owner approval of pilot numbers.
Parents: `Scaper_Connector_Architecture.md`, `Scaper_Dedup_Spec.md`. Rules: `AGENTS.md`.

## Why

Owner wants Ticketmaster events for every state ("Alaska to Texas"). Measured 2026-10-05
(Discovery API, next 60 days): California 5,709 · Texas 3,070 · Alaska 19 · US total
capped at 10,000 in the counter (real total est. 40k–60k).
**Eventbrite is out of scope**: its official API has no search (`/v3/events/search/` → 404);
only per-organizer/venue listing. Do not scrape eventbrite.com.

## Current code (read first)

- `scaper/connectors/ticketmaster.py` — geo source (lat/lng/radius_km), pages of 200,
  `last_fetch_complete` only if totalElements ≤ 1000 (Discovery deep-paging cap:
  size × page < 1000), strips `distance`/`units`/`_links` before hashing.
- `scaper/pipeline.py` — fetch → raw_records → extract → resolve_place → upsert_event →
  expire_unseen → purge_past_events(source) → dedupe_city(source.city_slug).
- `scaper/store.py` — `PostgresStore`, one transaction per call (slow at scale).
- `app/services/explore_scaper_events.py` — v1 hub reads Scaper events by `city_slug`;
  `scaper_city_enabled` checks `ingest.sources.city_slug`.
- `app/services/scaper_event_visibility.py` — shared visibility CTE (keep using it).
- Live sources today: `ticketmaster:chicago`, `ticketmaster:orlando` + 6 Eventbrite orgs.

## Build

1. **State mode in the Ticketmaster connector.** Config accepts either the existing geo
   form or `{"state_code": "TX", "days_ahead": 60}` (validate 2-letter US state codes,
   incl. DC). Query `countryCode=US&stateCode=XX`.
   **Window splitting:** for each date window, read `page.totalElements`; if > 1000,
   bisect the window (by time) and recurse until every window ≤ 1000 or the window is
   < 1 hour (then fetch what is reachable and mark the fetch incomplete). The fetch is
   complete only if every window was fully paged. Never request page × size ≥ 1000.
   Respect 5 req/s (existing `page_delay`) and log calls used per run.
2. **Per-event city/state.** A state source covers many cities, so stamp events from the
   **venue**: `city_slug = slug(venue.locality)` (same slug rule as
   `explore_scaper_events.city_slug`, e.g. "New York" → `new-york`) and new column
   `events.state_code` (venue region). Geo/city sources keep using `source.city_slug`
   (so Chicago suburbs stay "chicago").
   **Migration `migrations/010_scaper_state.sql`** (additive, idempotent): add
   `events.state_code text`, index `(state_code, city_slug, start_time)`; add
   `ingest.sources.state_code text`. Backfill `state_code` for existing rows from
   `raw_records` venue data where possible.
3. **Dedup per touched city.** After a state run, call `dedupe_city` for every distinct
   `city_slug` the run inserted/updated (not just `source.city_slug`).
4. **Batched writes.** 50k events must not take hours. Process extraction in chunks
   (e.g. 200) inside one transaction per chunk; cache `resolve_place` per venue
   external_id within a run; use multi-row upserts where practical. Keep the existing
   per-record failure semantics (one bad record → that raw record `failed`, run `partial`).
   Target: a Texas run (~3k events) under 3 minutes from a us-west machine.
5. **Hub lookup for any city.** `scaper_city_enabled` must also return true when visible
   Scaper events exist for that `city_slug` (not only when a source is stamped with it).
   Keep the query indexed/cheap.
6. **Overlap rule.** When a state source is enabled, **disable** the Ticketmaster
   city sources inside that state (e.g. `ticketmaster:chicago` when IL is on;
   `ticketmaster:orlando` when FL is on) so two sources don't fight over the same
   events (source_id flips, expiry). Eventbrite sources stay.
7. **Scheduler.** Each state is its own source (`ticketmaster:state:tx`), default
   `interval_minutes=360`. Check total daily calls stay < 5,000 (Ticketmaster limit) and
   report the estimate.

## Compliance gates (added 2026-10-05 from Perplexity research of the live Ticketmaster terms)

Source: developer.ticketmaster.com/support/terms-of-use (dated 2023-06-27, still live).

- **Rollout beyond the 3-state pilot is ON HOLD** until Ticketmaster answers in writing. Two clauses apply:
  (a) "rate limit or block applications that make a large number of calls … not primarily in response to direct user actions", which puts a scheduled national crawl at risk;
  (b) no "deriv[ing] revenues" from the API without approval, so monetizing Rovvy needs written permission.
- **Storage:** only "for reasonable periods in order to provide the service". Build these in:
  8. **Retention purge.** When an event is purged (past) or delisted, delete its
     `ingest.raw_records` payload too (today the payload is kept forever). Keep no Ticketmaster
     content for events older than 7 days past their end.
  9. **Owner removal within 24 hours.** Add `python -m scaper remove --provider ticketmaster
     --external-id <id>` (or `--venue-id`) that deletes the event, its raw record and dedup
     links immediately, and blocks re-ingest of that id (blocklist table). Test it.
  10. **Eventbrite past-event rule (stricter).** For `provider='eventbrite'`, purge at event
     end (no 6 h grace beyond `end_time`; if no end, start + 6 h), and in the same transaction
     delete the raw record. Places created from an Eventbrite venue (`place_links.method='created'`,
     `gers_id IS NULL`) are deleted when no future Eventbrite event references them; matched
     Overture places stay (only the link row goes).
  11. **Provider links.** Event cards/drawer render the provider event URL as a real
     `<a href target="_blank" rel="noopener">` (no `nofollow`): "View on Eventbrite" /
     "Tickets via Ticketmaster". Add a one-line footer/legal note: Rovvy is independent and
     not owned by Eventbrite or Ticketmaster.
- **Images:** keep hot-linking Ticketmaster image URLs. Never copy them to R2.
- **Attribution:** event cards and drawer must show "Tickets via Ticketmaster" linking to the
  API-provided event URL; never imply a partnership.

## Tests (AGENTS.md §7)

- Unit (mock HTTP): state config validation; window bisect (counts 2,500 → splits until
  ≤1000; < 1 h window → incomplete); never page past 1000; city_slug/state from venue.
- Pipeline with in-memory store: dedupe called per touched city; chunk failure semantics.
- Rolled-back Postgres suite (`SCAPER_PG_TEST_URL`, pattern in
  `tests/test_scaper_postgres.py`): migration 010 applies twice; state run stamps
  per-venue city/state; hub lookup finds a city with events but no city source.
- Full CI suite stays green: `DATABASE_URL=sqlite:///./test.db SECRET_KEY=test-secret-key-for-ci-must-be-long-enough .venv\Scripts\python -m pytest -q`.

## Pilot (needs owner approval before each DB step)

1. Ask owner → apply migration 010 to Supabase.
2. Ask owner → add and run `ticketmaster:state:ak`, `:tx`, `:ca`.
3. Report: events per state, cities covered, runtime, API calls, rejected/failed counts,
   DB size before/after (`pg_database_size`), `/api/v1/explore/events?city=Austin`
   (and one CA, one AK city) returning rows. **Stop** for approval before the other 47.

## Out of scope

Eventbrite scaling, flights (dropped), frontend changes beyond what the hub needs,
pushing to `Production-main` (owner pushes).
