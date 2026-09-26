# Scaper — connector system for Explorer

Status: **Migration 008 applied to Supabase; Eventbrite verified live end-to-end (33 events, Orlando).** No scheduler running yet. Last updated 2026-09-26.

Scaper is a separate process (`python -m scaper`) in this repo. It writes to Rovvy's Postgres; Rovvy only reads. It does not import `app.*`.

```
ingest.sources ──► connector.fetch() ──► ingest.raw_records (sha256 change detection)
                                              │ connector.extract()  (pure; re-runnable)
                                              ▼
                     venue ──► ingest.place_links ──► public.places (existing Overture spine)
                     event ──► public.events (existing table, additive columns)
                                              ▼
                     GET /api/v2/explorer/events  →  /explore-v2
```

## Decisions (and where they differ from the original brief)

| Brief said | Decision | Why |
|---|---|---|
| Scaper owns a new `public.places` | **Reuse the existing `places` (1.88M Overture rows).** Venues link through `ingest.place_links`: existing link → PostGIS 100 m + trigram similarity ≥ 0.45 → otherwise insert with `gers_id NULL` | A second places table would fork the data spine. `gers_id NULL` rows stay out of the Overture hot index (`WHERE gers_id IS NOT NULL`). |
| Scaper owns a new `public.events` | **Evolve the existing, empty `public.events`** (ADD COLUMN only) | `/api/v2/explorer/events` already queries it with PostGIS. |
| Eventbrite as a city-search source | **Target-based only**: each source row is an organizer or venue ID | `/v3/events/search/` returns **404**. Verified live 2026-09-26. `/organizers/{id}/events/` returned 33 live events. |
| Claude API extracts every record | **Deterministic `extract()` for structured APIs.** Claude only for unstructured text (Phase 2) | JSON-to-JSON mapping by LLM adds cost and hallucination risk with no gain. |
| Instagram via RapidAPI scraper (Phase 2) | **Blocked** | Conflicts with `data-spine.md` §4/§10: no background Instagram crawler in any form. |

## Schema (`migrations/008_scaper_ingest.sql`, idempotent)

- `ingest.sources`: connector, unique `name`, `config` jsonb (validated by that connector's Pydantic model), `city_slug`, `enabled`, `interval_minutes`, `last_run_at`.
- `ingest.runs`: status `running|succeeded|partial|failed` plus counters (fetched, unchanged, inserted, updated, rejected, failed). A partial unique index allows **one running run per source**. Runs older than 2 h are marked abandoned.
- `ingest.raw_records`: unique `(connector, external_id)`, `payload`, `payload_sha256`, `extraction_status pending|extracted|rejected|failed`. An unchanged, already-extracted payload skips extraction; a failed one is retried.
- `ingest.place_links`: `(connector, external_id) → places.id`, with method `geo_name|created|manual` and a score.
- `public.events` additions: `status` (checked), `description`, `is_free`, `currency`, `image_url`, `venue_name`, `timezone`, `city_slug`, `source_id`, `raw_record_id`, `first_seen_at`, `last_seen_at`, `updated_at`. Unique `(provider, external_id)` is the upsert key. FKs to places, sources and raw_records use `ON DELETE SET NULL`.

**Visibility contract** (the reader implements it): `status IN (scheduled, sold_out, postponed)` and `COALESCE(expires_at, end_time, start_time) > now()`. `expires_at` defaults to `end_time`, or `start_time + 6h`. After a **complete, error-free** fetch, any source event the provider no longer lists gets `expires_at = now()`. If it reappears, it is restored.

## Run semantics

- A fetch error stops fetching, but already-fetched rows are still extracted. The run is marked `failed`, and nothing is expired.
- An extraction exception marks that raw record `failed` and the run `partial`. That record is retried on the next run.
- A `Rejected` result (online, unlisted, no coordinates, draft) is not an error. Its reason is stored in `extraction_error`.
- HTTP: 4 attempts on 429/5xx/transport errors, honouring `Retry-After`. Other 4xx responses fail fast.

## Operate

```
python -m scaper preview --connector eventbrite --config '{"kind":"organizer","id":"<id>"}'
python -m scaper add-source --connector eventbrite --name eventbrite:org:<id> --config '{...}' --city-slug chicago
python -m scaper run --source eventbrite:org:<id>
python -m scaper run-due        # schedule this (Cloud Run job / cron), e.g. every 15 min
```

## Connector roadmap — terms/cost to re-verify before building

| Connector | Status | Note |
|---|---|---|
| Eventbrite | Built | Needs a curated organizer/venue list per city. That list is ongoing ops work. |
| Ticketmaster Discovery | Next | Best free geo-search source (`latlong` + `radius`). The app already uses it via the v1 path. |
| Meetup | Verify | GraphQL API access has required a Meetup Pro subscription, so it may not be $0. |
| Yelp Fusion | Verify | Plans have moved to paid tiers and the ToS limits caching. It likely cannot be stored into `places`. |
| Google Places | Verify | ToS forbids caching content beyond `place_id`. Store links, not data. |
| Instagram | Blocked | See `data-spine.md`. User-pasted single links remain the allowed path. |

## Open risks

1. No scheduler runs `run-due` yet. Purge: after each successful fetch, Scaper rows (`source_id IS NOT NULL`) past `COALESCE(end_time, start_time + 6h)` are deleted; the count goes to `ingest.runs.purged`.
2. The main `/explore` hub (`GET /api/v1/explore/events`) does not read `public.events` yet. Only `/explore-v2` does.
3. Venue matching thresholds (100 m, similarity 0.45) are untuned against real data.
4. No Eventbrite organizer list exists yet.
