# Rovvy Explorer Product Record

This folder is the authoritative Scram Book record for the Explorer hub and its discovery experience.

## 2026-10-09 — Decision: no live map crops on feed cards (option A)

- Context: G12 map crops (`0c4581b`, `73775a8`) rendered a full MapLibre map per card and snapshotted it. Measured per card: style 43 KB plus tile index 19 KB plus ~4 vector tiles (~300 KB) plus fonts, then render and wait, about 1.5–3 s each. With 2 at a time, 96 map cards took 1–2+ minutes. The owner also hit a runtime crash, "Cannot read properties of null (reading 'removeChild')": React unmounts the map host while MapLibre is still rendering, then `map.remove()` runs on a detached node (suspected; no stack trace was captured).
- **Owner decision (A):** feed cards without a real photo become compact text cards (no media area). The map stays only in the drawer (one map at a time). The card map crop is deferred to option B: pre-render the map image on the server once per place, store it in R2, and serve it as an image.
- **Result:** Deleted `ExploreMapCrop`, `explore-map-crop-snapshot.ts`, and tests; `ExploreSlotCard` compact text layout; `ExploreDrawerMap` unchanged; workbook **G12 → Partial/yellow**.
- **Verification:** Explore Vitest (no map-crop tests); `tsc --noEmit` (2 pre-existing ProfileTravelMap errors only); owner browser — full Naperville feed scroll + Load more ×3, no MapLibre on cards / no removeChild crash.

## 2026-10-09 — Explore map crop WebGL snapshot (G12 feed cards)

- **Context:** Claude review of `8d1e87b`; each visible feed card kept a live MapLibre map after scroll (~16 WebGL context cap).
- **Result:** `explore-map-crop-snapshot.ts` — `preserveDrawingBuffer`, first `idle` → PNG `img`, `map.remove()`; FIFO queue max 2 live maps; in-memory cache by lat/lng/zoom; compact OpenFreeMap/OSM attribution overlay; `ExploreMapCrop` toggles visibility via IntersectionObserver.
- **Verification:** Explore Vitest **134 passed** (27 files); manual — scroll full Naperville feed, every map card shows image, ≤2 canvases in DevTools.
- **Next action:** Owner browser sign-off on long feed scroll + mobile.

## 2026-10-09 — Explore feed Phase 1 approved (Perplexity proposal reviewed)

- Context: the owner shared a Perplexity proposal for an Instagram-style Explore feed, plus mockups of the feed and a place page.
- Claude's review:
  - Confirmed the "wrong area" bug: the hero showed Naperville while the request used downtown `CITY_COORDS`.
  - Confirmed text-only cards (~5 of 96 nearest places have photos) and Overture's data-quality issues (chains, "Millienum Park").
  - Flagged that the mockup's open hours, spots left, per-person prices, "Fits 6" and friend counts are placeholders, and F15 forbids showing them without data.
  - Drawn category images would reverse G08; the owner chose the **G12 map crop** instead.
- Decision: **Phase 1 spec** `Explore_Feed_Phase1_Spec.md`, assigned to Cursor. It maps to existing rows (G18/F02 location, F27 mixed feed, F31/G12 photo-first + map crop, F03 quality filter, F05 smaller labels with required links, F24/F28 real-data reason labels). Phase 2 (action-based ranking) and Phase 3 (place pages and Rovvy moments) come later.
- Pending separately: push of 4 local commits (CI duckdb fix), so production deploys at all.

## 2026-10-09 — Explore Phase 1 browser-review fixes (map crop, Scaper metro, geo filter)

- **Context:** Claude browser review of Phase 1 (`d8c3a1b..a97ffff`); blank `tiles.rovvy.app` crops, Naperville hero → 0 events, ~16 listings.
- **Result:** MapLibre + `resolveOpenFreeMapCleanStyleUrlForLiveMap()` lazy crops (`ExploreMapCrop`); events/places `city` → nearest Scaper metro within 80 km (Naperville → Chicago) while places query keeps hero lat/lon; `filterSlotsByLocationScope` skips city-name filter when geo anchor set; workbook **F03 → Partial/yellow** (Wikidata label not wired).
- **Verification:** Explore Vitest **129 passed** (25 files); browser `/explore` Naperville hero — 8 Events, `/explore/events?city=Chicago` 200, OpenFreeMap `styles/liberty` 200 on map crops; geo scope skips client city/state filter (API radius).
- **Next action:** Owner push when ready; wire Wikidata display label for F03 Complete.

## 2026-10-09 — Explore Feed Phase 1 (items 1–6, spec `Explore_Feed_Phase1_Spec.md`)

- **Context:** Owner-approved honest photo-first feed; F15 hide facts without backing data.
- **Result:** Hero scope drives places API coords (events stay city-scoped); per-day TM/EB interleave; photo-first rank + z17 map crop (G12); chain/category demote; smaller provider labels; reason chips from real fields + Collection similarity.
- **Verification:** Explore Vitest **126 passed** (23 files); `tsc --noEmit` 0 new errors (2 pre-existing ProfileTravelMap `zIndexOffset`); browser QA on `/explore` with Naperville-style scope (owner).
- **Risks:** Wikidata display names not in API yet — chain/category demote only; F27 still client pool only (no backend pagination).
- **Next action:** Phase 2 action-based ranking; owner browser sign-off on non-downtown location.

## 2026-10-08 — Scaper owner removal + `/legal/data` (spec item 9)

- **Context:** SHIFT HANDOFF + Ticketmaster national spec item 9; removal requests need a published contact (`rovvy230@gmail.com` via `frontend/lib/contact-config.ts` until owner moves to support@).
- **Goals:** `python -m scaper remove --provider --external-id`; block re-ingest; legal data-sources page; Explore drawer removal link.
- **Result:** `migrations/011_scaper_blocklist.sql`; `PostgresStore.remove_provider_event` + pipeline blocklist check; CLI `remove`; `/legal/data` with Overture, Wikimedia, Ticketmaster, Eventbrite, independence, `#removal`; drawer “Is this your event? Contact us”.
- **Verification (2026-10-08 CI rerun):** Backend `pytest tests/` (CI env: sqlite `DATABASE_URL`, `SECRET_KEY`) **976 passed**, 28 skipped, 0 failed; frontend `npx vitest run` **587 passed** (127 files); Scaper PG `tests/test_scaper_postgres.py` via `SCAPER_PG_TEST_URL` **14 passed** (rolled back). Commits: `a427726`, `17e6ff7` (`blocked_ids` once per run), `87a1126` (`blocked_ids` before `start_run`).
- **Risks:** Migration **011 not applied to Supabase** — ask owner before apply.
- **Next action:** Owner approves 011 on prod; forward TM/EB API registration mail to `CONTACT_EMAIL`; run remove CLI after verified takedown emails.

## 2026-10-05 — SHIFT HANDOFF (owner back in ~68 h): state of Explorer / Scaper

**Read this first next shift.** The newest detailed entries are below this one.

### Done and committed (local `Production-main`, 7 commits ahead of origin, NOT pushed)
- `9bdbf37`: Explore drawer **Directions opens the Live tab** (not Google Maps). The UUID place-ID and address fixes are included.
- `472b8fe`, `4e169ba`, `d7bc037`: Ticketmaster **state mode** (window bisect), migration 010 file, batched writes, hub works for any city with events.
- `759f985`, `bcd984a`: **Eventbrite purge at event end** (raw payloads and orphan venues too; Ticketmaster after 7 days); "View on Eventbrite" / "Tickets via Ticketmaster" real `<a href>` links; independence note.
- `1b0d4e6`: AGENTS.md §4 provider-terms rules and national-spec items 8–11.
- Claude reviewed all of them: CI 971 passed / 0 failed; rolled-back Supabase suite 13/13; Explore + Live Vitest 127/127.
- **CORRECTION 2026-10-08:** NOT in production. Every Production CI/CD run since `c726d13` (2026-09-27) failed (tests that import `duckdb`, which is missing from `requirements-ci.txt`, cause a collection error and exit 2), so the deploy job was skipped for `c726d13`, `14788d4`, `19f1974`, `86447c4` and `ab1e3f2`. Claude had reported `86447c4` as deploying without confirming the run. Fixed by adding `duckdb==1.5.5` to `requirements-ci.txt`, verified in a fresh venv built from requirements-ci.txt only: 946 passed, 0 failed. Pushed but not yet deployed: photos (Wikimedia + uploads), faster places, address/phone/map drawer, Scaper events in hub, series dedup, events pagination, shared rule book, flight tests removed.

### Waiting on the OWNER (in order)
> **Update 2026-10-08 (cleanup, owner-approved):** ran the 6 Eventbrite sources once (all succeeded; purged 2+0+0+3+0+6 = 11 ended events, which were also refreshed from Eventbrite). Then deleted 4 leftover raw copies of ended events by exact ID: 2 orphans whose events had been purged on 2026-09-27, before raw cleanup existed, and 2 rejected online events. **Result: 0 ended Eventbrite events, 0 ended raw copies, 0 created Eventbrite venues without a future event.** Eventbrite now has 91 events (all future) and 100 raw copies; Ticketmaster is untouched (947). **Code gap for Cursor:** the purge only deletes raw copies of events it deletes in the same step; it must also delete raw copies of ended events that have no event row (rejected items and old orphans).

> **Update 2026-10-08:** Pushed `ab1e3f2` (15 commits incl. spec item 9 blocklist and `/legal/data`). Migrations **010 and 011 applied** to Supabase and verified by Claude (blocklist table exists and is empty; 947/1,037 events have `state_code`; the 90 without are Eventbrite). CI/CD run 37761861393 was in progress at the time of writing. Reviewed by Claude: CI 976 passed / 0 failed; rolled-back Supabase suite 14/14. Frontend (`/legal/data`, drawer links) goes live only after the `main` sync. Items 1 (push) and 6's migration step are done; the rest of this list remains.

1. **Push** (= production deploy): `git push origin Production-main`.
2. **"approve cleanup"**: purge the 11 ended Eventbrite events, the raw copies of ended events and their orphan venues from Supabase (Eventbrite §3.1 non-compliance). Claude does it by running the 6 Eventbrite sources once with the new purge.
3. **Email Ticketmaster** for written approval (caching period, scheduled refresh, monetization); the draft is in the 2026-10-05 provider-terms entry. **The 47-state rollout is blocked until they reply.**
4. **Secrets/scheduler:** create the `TICKETMASTER_API_KEY` secret, add the 5 `R2_*` secrets, then run `scripts/deploy-scaper-job.ps1`. Without the scheduler, data stays stale (last fetch 2026-09-27) and past events are never purged.
5. **Roll the R2 secret key** (it was pasted in chat).
6. **Migration 010 + 3-state pilot** (AK, TX, CA): Cursor asks before applying and running.

### Open engineering tasks (who)
- ~~**Cursor:** spec item 9 (remove + blocklist + `/legal/data`)~~ — **2026-10-08 Complete in code** (migration 011 prod pending).
- **Cursor or Claude:** mix providers within each day in the hub feed (F27). Eventbrite is invisible today (Chicago: 0 of the 24 shown).
- **Codex (optional):** retire the HTML scrapers (`eventbrite_scraper.py`, `seatgeek_scraper.py`, `stubhub_scraper.py`); remove the dropped flight code (tests already gone).
- **Rejected sources:** Yelp, SeatGeek, Meetup. Flights are dropped; travel is A→B directions only (AGENTS.md §4).

### Added 2026-10-08: removal requests need a contact channel
- Gap: Rovvy has no published contact/takedown address. A Ticketmaster removal request would go to whatever email registered the API key, which nobody watches. The `scaper remove` command (spec item 9) is only half the solution.
- **Decided 2026-10-08:** contact/removal address is **`rovvy230@gmail.com`** (a dedicated Rovvy Gmail, not the owner's personal inbox); move to `support@rovvy.app` later through one config constant. Ticketmaster and Eventbrite API keys are registered to the **owner's personal Gmail** (address deliberately not recorded here; repo appears public). **Owner to do:** Gmail filter `from:(ticketmaster.com OR eventbrite.com)` → forward to `rovvy230@gmail.com`.
- **Cursor:** item 9 (remove + blocklist), plus a `/legal/data` page (data sources, attribution, independence note, removal contact) and an "Is this your event? Contact us" link in the Scaper event drawer.

### Known risks
- Ticketmaster may throttle scheduled crawls; monetizing needs their approval.
- Eventbrite: the "competing product" clause is undefined, so Rovvy stays a group-planning app that links out for tickets.
- r2.dev is rate-limited; switch to a custom domain (e.g. media.rovvy.app) before launch.
- `scratch/update_explorer_workbook_f48.py` was committed by mistake (harmless).

## 2026-10-05 — Eventbrite/Ticketmaster compliance (purge + provider links)

- **Context:** AGENTS.md §4 + `Scaper_Ticketmaster_National_Spec.md` items 10–11 (Eventbrite API terms: no past-event storage; crawlable outbound links; independence disclosure).
- **Result:** `purge_past_events` deletes matching `ingest.raw_records`, Eventbrite-specific orphan **created** venue cleanup (scoped `place_id`s from `DELETE … RETURNING`), Ticketmaster 7-day post-end retention. Explore drawer: real `<a href>` CTAs **View on Eventbrite** / **Tickets via Ticketmaster** plus footer independence note.
- **Verification:** `pytest -q` (CI sqlite) **971 passed**, 27 skipped; `tests/test_scaper_postgres.py` **13 passed** rolled-back Postgres; Vitest `explore-unknown-field-states` **14 passed**; `tests/test_scaper_store.py` asserts `PostgresStore.dedupe_city` / `relink_created_places` on class.
- **Risks:** Supabase still holds ended Eventbrite rows until Claude runs one-off cleanup (not done in this pass).
- **Next action:** Production DB cleanup; Ticketmaster 50-state pilot unchanged (migration 010 + owner approval).

## 2026-10-05 — Ticketmaster 50-state Scaper (Partial — pilot gates)

- **Context:** Owner-approved spec `Scaper_Ticketmaster_National_Spec.md` (pilot AK, TX, CA before remaining states).
- **Result:** State mode in `scaper/connectors/ticketmaster.py` (`countryCode` + `stateCode`, time-window bisect under 1k paging cap, API call logging). Migration `migrations/010_scaper_state.sql` adds `events.state_code` + index and `ingest.sources.state_code`. Pipeline stamps per-venue `city_slug`/`state_code`, dedupes every touched city, 200-row extraction batches. Hub `scaper_city_enabled` true when inventory exists without a city source. Overlap rule disables `ticketmaster:chicago` / `ticketmaster:orlando` when IL/FL state sources are registered.
- **Verification:** `DATABASE_URL=sqlite:///./test.db SECRET_KEY=test-secret-key-for-ci-must-be-long-enough .venv\Scripts\python -m pytest -q` → **970 passed**, 14 skipped. Opt-in `tests/test_scaper_postgres.py` includes migration 010 idempotency + state stamp tests when `SCAPER_PG_TEST_URL` is set.
- **Risks:** Production pilot not run — no migration 010 on Supabase, no `ticketmaster:state:*` sources added (per owner gate). Daily API budget: at 360 min intervals, 3 pilot states × ~6 runs/day; estimate **~30–120 calls/run** for TX/CA after bisect (owner to confirm on live pilot).
- **Next action:** Owner approves → apply `010_scaper_state.sql` on Supabase → add/run `ticketmaster:state:ak`, `:tx`, `:ca` → pilot report → approval before other 47 states.

## 2026-10-05 — F48 drawer Directions → Live tab (Complete in code)

- **2026-10-05 follow-up:** Deep link adds `address=` from drawer; `parseLiveDeepLink` returns `address`; Live handoff uses street address (not lat/lng fallback when present). Tests use real Overture UUID `5d1bbd9b-7a0d-4427-ba73-632cc1dc3f84`. Browser: Center for Native Futures Directions href includes `gers_id=dd5633a8-…` + `address=56+W+Adams+St…`; Live place panel opens with route preview.
- **Context:** Explore drawer “Directions” must hand off to Rovvy Live (same tab, Back returns to Explore), not Google Maps.
- **Result:** `live-explore-deeplink.ts` builds/parses `/live?gers_id&lat&lng&name&address`; `ExploreDetailDrawer` uses `<Link>` (places include Overture UUID `gers_id`); `LivePageClient` runs `selectDestination` once then `router.replace("/live")`. Removed `exploreDirectionsUrl`.
- **Tests:** Vitest `app/(dashboard)/explore` + `app/(dashboard)/live` (341+ tests pass); `live-explore-deeplink` + spine seed UUID cases; `tsc --noEmit` — only pre-existing `ProfileTravelMap.tsx` `zIndexOffset` errors.
- **Browser (localhost:3000):** Center for Native Futures → Directions → `/live` with place panel, spine address, route preview (~5.6 mi); `/live?lat=abc` → normal Live (no forced panel). Pritzker Park not re-checked this pass after UUID fix (link now includes `gers_id`).
- **Risks:** Route preview needs geolocation permission; without GPS, distance/route may differ. Automated browser did not exercise browser Back to Explore.
- **Next action:** Optional manual Back-button QA on device; regression only for this path.

## 2026-10-05 — F47 drawer photo · Orlando enrich dry-run (Partial)

- **Context:** Task 2 — run Wikidata + Wikimedia photo enrich for Orlando before prod writes; operator must approve Postgres updates.
- **Dry-run:** `scripts/05_enrich_wikidata.py --dry-run --metros orlando` → 342 entities, 15,372 places scanned, **99** match candidates, 166 rejected, 2 ambiguous (`dry_run=1 no_writes`). Cache: `data/enrich/wikidata_orlando.csv`.
- **Photos dry-run:** `scripts/07_enrich_wikimedia_photos.py --dry-run --metros orlando` → **0** places with QID awaiting Commons (expected until wikidata apply).
- **API check:** `GET /api/v1/explore/places?city=Orlando&lat=28.5417&lon=-81.3776&category=attractions&limit=50` → **50** places, **0** with `image_url` (no Orlando spine photos yet).
- **Scrum:** F47 row stays **Partial** (yellow); evidence + Cursor Context Log updated in `Rovvy_Explorer_Scrum_Book.xlsx`.
- **Next action:** Operator approves prod run: `05_enrich_wikidata.py --metros orlando` then `07_enrich_wikimedia_photos.py --metros orlando`; re-hit API and drawer QA.

## 2026-10-05 — CI flight unit test (Duffel adaptive path)

- **Fix:** `test_search_flights_duffel_success` used expired `expires_at` (filtered by `group_offers_into_itineraries`); mock offer expiry now +60 days; patch `flight_enabled_providers=duffel`; failure test patches `flight_journey_service.create_offer_request`.
- **Verify:** `tests/test_flight_service_unit.py` **6 passed** with CI env vars.

## 2026-09-27 — Cursor development plans in Scrum workbook

**Workbook:** `Rovvy_Explorer_Scrum_Book.xlsx` — column **J** (`Cursor development plan (engineering)`) on **Explorer Tasks** has one Cursor engineering plan per row (76 features/gates). New worksheet **Cursor Context Log** mirrors every task row with full acceptance/evidence plus the same plan (raw log for agents).

## 2026-09-26 — Eventbrite total and no-geographic-cutoff clarification

- User clarified there should be no geographic cutoff for the requested total. Read-only Supabase counts: `public.events` has 33 rows total; all 33 are Scaper/Eventbrite rows from the sole enabled Eventbrite source, organizer `84855780433`. A read-only official organizer API request returned HTTP 200 with `pagination.object_count=33`, `page_count=1`, and `page_size=50`; this is the complete total for that configured organizer/query, not a count of every Eventbrite event.
- Current connector `max_pages` defaults to 10 and permits at most 50. At the observed 50-event page size, that caps a run at roughly 500 events by default or 2,500 when configured to 50 pages, per source; neither is a provider-wide event cap. Eventbrite's public geographic event-search API is deprecated, so no platform-wide or citywide total is available through this connector without a defined organizer/venue source list.
- Product distinction: `/api/v2/explorer/events` still requires coordinates, defaults to a 50 km radius and 8 rows, and caps responses at 100; removing a geographic cutoff from ingest or an inventory count does not change that reader. Main `/explore` remains on its separate v1 path.
- Provider policy review: Eventbrite developer rate-limit documentation currently says 2,000 calls/hour and 48,000/day, while its API Terms page says 1,000 calls/hour per OAuth token. Plan against the stricter 1,000/hour pending confirmation from Eventbrite or token-specific limits. The Terms also restrict retaining content for past events; Scaper currently purges past `public.events` rows but leaves `ingest.raw_records.payload` behind. Review permission and add a raw-payload retention policy before broadening ingestion. No legal conclusion or new ingestion was made in this review.

## 2026-09-26 — CTO verification after Scaper live handoff

- Independently reran the Eventbrite and pipeline unit suites: 31 passed. Read-only Supabase SELECTs confirmed source `eventbrite:org:84855780433`, 33 current event rows, 33 visible within 5 km of downtown Orlando, 10 Eventbrite venue links with `geo_name` matching, and `ingest.runs.purged`. The three most recent run counters match insert 33, purge 1, and reinsert 1. The separate Postgres test run (6/6), migration deployment, and in-progress event API response were reported by the Scaper worker; this review did not rerun those operations. At review time, the 5 km query found 0 events currently in progress, which does not invalidate an earlier time-dependent observation.
- Decision: Eventbrite step 4 is credible and the live row counts are independently confirmed. Before a second connector, scope `purge_past_events()` to its source or move global purge into an explicit maintenance job; it currently deletes past rows across all Scaper sources and attributes the total to the source run that triggered it. Prioritize scheduling `run-due` and reading `public.events` in main `/explore` so the verified feed reaches the product. Ticketmaster can follow without replacing the existing v1 source until parity and deduplication are verified.

## 2026-10-05 — Eventbrite API terms (Perplexity): past-event content must go

- Source: Eventbrite API Terms of Use (last updated 2025-05-30) as quoted by Perplexity, plus Eventbrite platform docs; clauses not re-fetched by Claude.
- Rules:
  - §3.1: may store content for **future events only**; no past-event content (including venue and ticket data) without the organizer's explicit permission.
  - §3.2: show the event title plus a direct, crawlable link to the Eventbrite page, without nofollow.
  - §3.3: no Eventbrite trademarks; Rovvy must state it is independent.
  - §3.6: no standalone or direct-commercial use and no competing product. Indirect benefit from supporting the app is allowed.
  - §3.5: rate limit 1,000 calls/hour per token (the docs say 2,000/hour and 48,000/day; plan for 1,000).
  - §8: the API is free but Eventbrite may charge later.
- **Current non-compliance found (Supabase, read-only check):** 11 Eventbrite event rows have already ended but aren't purged (no scheduler runs); 14 raw payloads belong to ended events; 10 places were created from Eventbrite venue data. The drawer's "View provider" opens links with `window.open`, which isn't a crawlable `<a href>`.
- Actions: rules added to AGENTS.md §4; spec items 10–11 added for Cursor (stricter Eventbrite purge including raw payloads and created venues; real `<a href>` provider links; independence note). A one-off cleanup of past Eventbrite data awaits owner approval.
- Strategic risk: the "competes with Eventbrite" clause is undefined. Rovvy stays a group-planning app that links out for tickets; no ticketing, checkout or organizer tools on top of Eventbrite data.

## 2026-10-05 — Provider terms research (Perplexity): decisions

- Source: Perplexity research pasted by the owner, citing the live vendor pages (Ticketmaster terms dated 2023-06-27; Yelp API terms 2025-01-13; SeatGeek API terms; Meetup GraphQL docs; Cloudflare R2 pricing updated 2026-10-01; Supabase billing docs). The quoted clauses were not re-fetched by Claude.
- **Ticketmaster: allowed for now, under conditions.**
  - Store only for "reasonable periods"; no fixed limit is defined.
  - Owner removal requests must be handled within 24 hours.
  - Ticketmaster may throttle calls "not primarily in response to direct user actions".
  - "derive revenues … except as set forth" means monetizing needs written approval.
  - No mandatory logo found.
  → The 50-state rollout is held at the 3-state pilot until Ticketmaster replies. Retention purge of raw payloads and a 24 h removal command were added to the national spec (items 8–9). Images stay hot-linked.
- **Yelp: rejected.** $229/$299/$643 per month plus overage; content may be cached at most 24 hours; no own listings DB.
- **SeatGeek: rejected.** No systematic storage; logo plus link required on every surface; no AI/ML use (conflicts with Wayra).
- **Meetup: rejected for now.** API tied to Meetup Pro; price and aggregation rights unclear.
- **Open-data event feeds:** no verified per-state list. Approve feeds one by one after checking license, endpoint and refresh.
- **Pricing confirmed:** R2 matches my earlier quote (10 GB free, $0.015/GB-month, Class A $4.50/M, Class B $0.36/M, free egress). Supabase Pro: 8 GB of database included, then $0.125/GB.
- Not yet researched: **Eventbrite API terms** (storage, attribution, commercial use), even though Eventbrite data is already stored.
- Next actions: owner emails Ticketmaster for written approval; Perplexity researches the Eventbrite terms; Cursor implements spec items 8–9.

## 2026-10-05 — Ticketmaster all-50-states approved; spec handed to Cursor

- Context: the owner asked for Ticketmaster and Eventbrite data for every US state. Measured on the Discovery API (next 60 days): CA 5,709, TX 3,070, AK 19; the US total exceeds the API's 10,000 counter (estimated 40k–60k).
- Decision: **Ticketmaster nationwide is approved**, as a pilot (AK, TX, CA) first. **Eventbrite stays curated per organizer**: its official API has no search, and scraping is out.
- Assigned to **Cursor** (owner choice, token budget). Spec: `Scaper_Ticketmaster_National_Spec.md` (state mode with window bisect, per-venue city/state with migration 010, batched writes, any-city hub lookup, overlap rule, tests, pilot gates).
- Estimated cost: Ticketmaster API $0 (under 5,000 calls/day); about 6 KB per event, so ~300–400 MB for 60k events (current DB 1.4 GB); scheduler ~$0–3/month.
- Also found today: Eventbrite is invisible in the hub. Chicago shows 1 Eventbrite event in the first 100 loaded and 0 in the 24 shown, because the feed sorts by start time only and Ticketmaster dominates. Fix proposed: mix sources within each day (F27). Not started.
- Risks: Ticketmaster's terms on storing data are unverified (owner to check before going national). The scheduler isn't deployed, so data is stale since 2026-09-27.
- Next action: Cursor builds and runs the pilot (asking before each DB step); owner approves the full 50-state rollout.

## 2026-10-05 — Shared AI rule book + dated/green workbook rule applied to Explorer

- Context: the user asked whether Claude Code has a project rule book like Cursor (`.cursorrules`, 530 lines) and Antigravity (`GEMINI.md`, 307 lines). Claude's was 24 lines. The user approved consolidating, plus a new Scram Book rule: after development, put the date as a prefix on the feature's workbook row and make it green.
- Rule book: `AGENTS.md` is now the single shared rule book, with sections for the Scram Book protocol, stack, never-do list, product data rules, approvals, git, testing and brand. `CLAUDE.md` imports it (`@AGENTS.md`). `.cursorrules`, `GEMINI.md` and `.claude/CLAUDE.md` carry a pointer saying AGENTS.md wins on conflicts; their feature and test registries are unchanged.
- New completion rule (AGENTS.md §1):
  - Prefix the Task cell with `[YYYY-MM-DD]`.
  - Complete: `Complete in code` with a green fill (#DDF3E3). Partial: `Partial` with a yellow fill (#FFF2B3) and the gap in next action.
  - Prepend the dated evidence, and add one Cursor Context Log row per feature.
- Applied to `Rovvy_Explorer_Scrum_Book.xlsx` for this session's verified work:
  - **Green:** F48 Drawer map / directions (was Pending), F31 Listing photos, F04 Verified event inventory.
  - **Yellow:** F47 Drawer photo (Pending → Partial; landmark coverage only) and G06 Cross-provider dedup (Not started → Partial; Scaper cities only).
  - 5 log rows were appended. The workbook was backed up first; the COUNTIF formulas and 6 conditional-format rules were preserved.
- Compliance fix found by the new rules: the photo upload endpoint lacked 401 and 422 tests; both were added (17 upload tests pass).
- Risks: other tabs' workbooks don't yet have dated prefixes for past work; the rule applies from now on. The `.cursorrules`/`GEMINI.md` registries still duplicate status info and can drift.
- Next action: every assistant follows AGENTS.md §1 on its next task.

## 2026-10-03 — Cloudflare R2 photo storage live (local), end-to-end verified

- Context: the user created the Cloudflare R2 subscription ($0 due), the bucket `rovvy-place-media` and a bucket-scoped Object Read & Write token. The values are in the local `.env` only (gitignored). The first public URL given belonged to a different bucket and returned 401; the corrected `pub-a7cf…r2.dev` URL returns 404 for missing files, which confirms it's public.
- End-to-end check against real R2 + Supabase (Millennium Park, Chicago):
  1. The upload endpoint returned 201 with status `pending`.
  2. Both renditions reached the bucket (`image/jpeg`).
  3. The public URLs returned 200 at 1600 px and 640 px, with **0 EXIF tags and no GPS** (the source file carried GPS).
  4. The pending photo was hidden from `/explore/places`.
  5. `08_moderate_place_media.py approve` worked, and the photo was then served as the place image with the credit "Rovvy community photo".
  6. Cleanup removed both objects and the DB row; nothing remains.
- Risks: the secret key was pasted into the chat transcript, so the user should roll it. Production is not configured: the 5 `R2_*` values are not in Secret Manager or the Cloud Run deploy. r2.dev is rate-limited; move to a custom domain (e.g. `media.rovvy.app`) before launch.
- Next action: add the R2 secrets to Secret Manager plus the deploy `--update-secrets`; resolve the flight test; push.

## 2026-10-02 — Approved recommendations: R2 uploads, Cloud Run Job scheduler, series dedup, test fixes; commit e148254

- Context: after a cost comparison the user approved Cloudflare R2 for uploads, a Cloud Run Job in us-west1 for `scaper run-due`, dedup option 1 (one card per day showing the next slot), and fixing the failing tests before pushing.
- **Tests:** 5 tests failing at HEAD `19f1974` were fixed in the tests only. `test_flight_booking` patched a `settings` attribute that moved to `duffel_client`; `test_place_ingest_freshness_scoping` used bare MagicMocks, which the service now treats as non-Postgres.
  - **Still failing:** `test_flight_service_unit::test_search_flights_duffel_success`. It also fails on the parent commit. Cause: it searches the metro code "NYC", and `airport_dataset_service` now loads OurAirports (8,800 IATA codes), so the request appears to be dropped before the mocked Duffel call. The flights feature is marked dropped by another session's commit `c726d13`; left for its owner or the user.
- **Series dedup:** see `Scaper_Dedup_Spec.md` §8. Balloon Museum is 10 cards (one per day). v1 and v2 both return 347 Chicago events.
- **R2 uploads:** boto3 is added to all requirements files. Uploads go to R2 when `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_MEDIA_BUCKET` and `R2_MEDIA_PUBLIC_BASE_URL` are set; otherwise local disk in dev, or 503. 15 upload tests pass. No R2 bucket or credentials exist yet; the user must create them.
- **Scheduler:** `scripts/deploy-scaper-job.ps1` deploys the Cloud Run Job `scaper-run-due` (us-west1, 512Mi, 1 h timeout) and an hourly Cloud Scheduler trigger through a dedicated invoker service account. It parse-checks clean; **not executed**. The `TICKETMASTER_API_KEY` secret is missing from Secret Manager; `DATABASE_URL` and `EVENTBRITE_TOKEN` exist.
- **Commit `e148254`** (local; fast-forward of origin). On a clean checkout with CI's environment: 1081 passed, 1 failed (the flight test above). Because the deploy job needs green tests, **pushing will run CI but not deploy** until that test is resolved.
- Next action: user decides on the flight test (fix, or remove as part of the dropped feature), creates the R2 bucket and keys plus the Ticketmaster secret, runs the deploy script, then pushes.

## 2026-10-02 — Explore photos: Wikimedia Commons, Scaper events in v1 hub, user uploads; places query 20× faster

- Context: the user asked why images don't appear. Cause: Overture carries no photos (0 of 38,178 Chicago places), `place_media` was empty, and the v1 hub didn't read Scaper events. The user approved every photo option **except the Google Places Photos API**.
- **Wikimedia Commons** (`scripts/07_enrich_wikimedia_photos.py`):
  - Flow: `wikidata_qid` → P18 → Commons imageinfo.
  - Only CC0, public domain, CC BY and CC BY-SA are kept. NC/ND are rejected; a regex bug that would have let them through was caught by a test and fixed.
  - URLs, author and license go into `place_media` (`open_license`, approved, `gers:<id>`). No image bytes are stored.
  - Chicago: 1,278 QIDs → 260 with an image → **259 inserted**. Audit: CC BY 4.0 (92), BY-SA 3.0 (43), CC0 (31), BY-SA 4.0 (28), BY 2.0 (26), PD (18) and others; no NC/ND. Orlando has no QIDs yet (Wikidata enrichment was only run for Chicago).
  - The `/explore/places` SQL joins the newest approved `place_media` row and returns `image_attribution`, `image_license` and `image_source_url` (the Commons file page).
  - Cards show "Photo: author · Wikimedia Commons · license"; the drawer shows the same credit, linked. Verified on Pritzker Park (Mahir256, CC BY-SA 3.0).
- **Scaper events in the v1 hub:** the route hard-coded `== "orlando"`; it now uses `scaper_city_enabled` (any enabled `ingest.sources` city). Chicago v1 `/explore/events` → `scaper_city`, 413 events, **200/200 with images, 1.2 s** (the live Ticketmaster path took ~30 s). In the browser the hub shows Ticketmaster/TicketWeb event images. `test_explore_events_endpoint.py` pins its Ticketmaster-path tests with an autouse fixture so local runs against Supabase stay green.
- **Places performance:**
  - Problem: under load, `/explore/places` took 20–33 s, so the hub showed "Attractions · Restaurants couldn't load".
  - Cause: the SQL ran `ST_DWithin` over ~8.8k rows in a 100 km radius, then sorted all of them by distance.
  - Fix: a GiST KNN (`<->`) inner scan over-fetching `2×limit+10`, then an exact `ST_Distance` filter and re-sort.
  - Result: **identical IDs and order in 8/8 comparisons against HEAD** (Chicago, Orlando, radii 800 m–100 km), 0.09–0.54 s instead of 5–10 s. The photo join itself costs 0.15 ms × 48.
- **User uploads:**
  - `POST /api/v1/explore/places/{gers_id}/photos` (auth required, ≤10 MB, JPEG/PNG/WebP).
  - Each file is re-encoded to JPEG, which **drops EXIF and GPS**, and resized to 1600 px plus a 640 px thumbnail.
  - Stored in a GCS bucket when `PLACE_MEDIA_BUCKET` is set (publicly readable objects). Local disk is used in dev only; otherwise the endpoint returns 503.
  - Rows are `rovvy_user`, `pending`, attributed "Rovvy community photo". Limit: 10 uploads per user per day.
  - Moderation: `scripts/08_moderate_place_media.py list|approve|reject`.
  - Drawer: "Add a photo" for places, or "Sign in to add a photo" when signed out.
- Verification: upload tests 13 passed (EXIF/GPS stripping, resize, rejects, 201/404/422/429/503, path traversal); Wikimedia parser tests 5; address tests 4; spine 17; Scaper events + hub events 21 (local Supabase and CI SQLite); Explore Vitest 22 files / 121; tsc clean except the pre-existing `ProfileTravelMap.tsx` `zIndexOffset` errors. The moderation CLI `list` works against Supabase (0 pending).
- Not verified / risks:
  - The signed-in upload was not exercised in a browser (no test account in this session).
  - **No production bucket exists**, so uploads return 503 in production until `PLACE_MEDIA_BUCKET` is set and its objects are public.
  - Place photo coverage is low in the default feed (about 5 of 96 nearest places), because Commons covers landmarks, not shops and restaurants.
  - Event data is **97 h stale**: no scheduler runs `scaper run-due`.
  - Clean HEAD `19f1974` has 5 failing tests (2 flight booking, 3 place-ingest freshness scoping) that predate this work.
  - Balloon Museum slot chaining is still undecided. Not committed.
- Next action: user creates the GCS bucket (or picks another store), approves a `run-due` schedule, decides the Balloon Museum series rule, then commit and push.

## 2026-10-01 — Explore drawer: full address, phone, Directions/Call/Website, real map pin

- Context: the user compared the Explore drawer with Google's place panel. The drawer showed only "Chicago" and a striped placeholder map. The user wants a full address, actions, and (later) a ticket and admission chooser. This entry covers address and actions only. Ticket options, partner tickets and sponsored placements wait for the user's decision.
- Root cause: `_format_address` (app/services/place_spine_service.py) ignored Overture's `freeform` street key unless every other part was empty, so the street line was dropped. `phone` was never selected by the spine SQL.
- Built:
  - The formatter now uses `freeform` as the street line when there's no number and road.
  - The spine SQL selects `p.phone`, and `/explore/places` returns `phone`.
  - The frontend carries address, phone and lat/lng through `ExplorePlaceRow` → `ExploreSlot` → `ExploreSlotDetail`.
  - The drawer shows a real MapLibre pin map (new `ExploreDrawerMap.tsx`, OpenFreeMap via the Live resolver, with a one-time fallback to the public CDN).
  - Below the map: the full address, the phone, and Directions (Google Maps deep link, no key), Call (`tel:`) and Website chips (`explore-place-actions.ts`).
- Verification:
  - Local API, Chicago (48 places): 42 now carry a street line (it was effectively 0); 32 have a phone. Argyle Street Market has no street in Overture, so it correctly stays "Chicago, IL".
  - In the in-app browser, the drawer for Center for Native Futures shows "56 W Adams St, Chicago, IL, 60603", +17735193238, Directions/Call/Website, and a street map pinned at Clark & Adams.
  - Tests: Explore Vitest 21 files / 116 passed plus 5 new; backend place tests 27 passed plus 4 new; tsc 0 errors.
- Risks: the env resolves the map style to the unprovisioned `tiles.rovvy.app`, so each drawer open logs one failed fetch before falling back. Not verified on a phone or for event listings (events don't carry these fields yet). Not committed.
- Next action: user decides on ticket options (events from the dedup cluster, which needs `public.events` wired into the v1 hub) and on partner tickets (Viator and similar need user signup).

## 2026-09-27 — Events API keyset pagination; Chicago ingest live; dedup chaining issue found

- Context: user approved (1) pushing 8e474f1/2cee77c/c237550, (2) keyset pagination on `/api/v2/explorer/events` (`after_id` + `limit`, default 50, max 200, no response-shape change, frontend passes `after_id`), then (3) Chicago (41.8781, -87.6298, 25 km, Eventbrite + Ticketmaster).
- Push: remote had moved (`d73c59c`, flight CI tests only). This checkout holds other sessions' uncommitted edits to those same test files, so the merge was done in a temp worktree (`7c01854`). CI-equivalent suite there: 959 passed. The user pushed `7c01854` (this deploys: `production-ci.yml` runs `deploy` on Production-main). `c237550` also contained another session's Scaper edits (per-source purge, `run-due --city-slug`, `set-city-interval`); these were re-verified before the push (86 unit + 9/9 rolled-back PG).
- Pagination: ordered by `(start_time, id)` with keyset `(start_time, id) > cursor`. The body stays a list; the cursor goes in the `X-Next-Cursor` header, which is added to CORS `expose_headers`. An unknown cursor returns 400. `/explore-v2` gets a "Load more events" button. Commit `a5a6424` (local) was cherry-picked onto origin as `0f9f73d` (branch `scaper-pagination-push`); CI-equivalent suite there: **967 passed**. **Not pushed.** Tests: 7 new + 23 existing v2 = 30 passed; tsc 0 errors. Live on Supabase, Orlando 15 km: pages 50/50/23 = 123, all unique, ordered, equal to the SQL count. Not browser-verified.
- Chicago sources: `ticketmaster:chicago` (25 km) plus 5 Eventbrite organizers mined from existing Chicago event IDs: Japanese Culture Center, Skyline Yacht Cruises, ChicAfrik, Chicago Twenty Something, I Love House Music. **Excluded:** ORLOVE (29/38 events >25 km away), Nightlife Functions (23/23 outside), and Windy City Market (2/4 outside). Organizer sources can list events in other cities, and every event would be stamped `city_slug=chicago`.
- Chicago runs: all 6 succeeded, 0 failed. Ticketmaster: 861 fetched, 840 inserted, 21 rejected (no start time). The listing was complete but is **near the 1000 deep-paging cap**. Eventbrite: 59 inserted, 9 rejected (online). Links: 81 matched (71 `geo_name`, 8 `geo_name_wide`, 2 `geo_address`), 52 created. API pagination at limit 200: 200/200/108 = **508**, equal to the SQL visible count. Orlando was untouched. Cross-provider duplicates: 0.
- **Issue: 378 events hidden by dedup.** 2 are real duplicates (JAY B; Punchis Banda Rave at Navy Pier). **376 are Balloon Museum timed-entry slots** (Ticketmaster lists each 30-min slot as its own event), collapsed to one card per day. Cause: the clustering is transitive (union-find), so slots chain up to 10 h apart (348 hidden rows are more than 30 min from their canonical). That deviates from the approved pairwise ±30 min rule. A resulting bug: when the canonical (early slot) expires, later slots stay hidden until the next dedup run (up to the 6 h interval).
- Next action: user decides how to treat timed-entry series (see chat), then fix and re-verify Chicago. Push `0f9f73d` when ready (production deploy).

## 2026-09-26 — Scaper tier-A3 venue rule; Orlando dedup gate passed; 009 committed

- Context: user approved tier A3 (normalized name equal + street address equal + postcode equal, within 500 m). Gate: created places 11 → exactly 10. Commit 009 only if the gate passes.
- Built: `norm_street` (direction/suffix abbreviations, unit and suite dropped), `norm_postcode` (ZIP+4 → ZIP5) and `same_venue_address` in `scaper/dedup.py`. The A3 tier runs after A2 in `_match_place`. It is used by live resolution and by `relink-venues`, which now passes each created place's stored address. 009 was updated in place (it was uncommitted) to add the `geo_address` method and re-applied live; it is idempotent.
- Verification: unit 85 passed (A3 cases use the real Abbey address strings); rolled-back Supabase suite **9/9** (new: an A3 match at ~400 m wins while a same-name, different-street decoy at ~300 m is rejected); pyright clean.
- Live gate: relink matched 1 venue (`The Abbey-Orlando` → Overture `The Abbey`, `geo_address`). **Created places 11 → 10 ✅. Visible 140 → 139 (drop 1) ✅.** 0 orphan places. Both sources re-ran successfully with no changes. The API returned 200 with 0 hidden IDs.
- Result: migration 009 and the dedup code were committed.
- Risks: the API row cap of 100 is still binding (139 visible in Orlando). Dedup counts are attributed to whichever source's run reclustered the city.
- Next action: the 100-row cap task. Chicago only when the user confirms.

## 2026-09-26 — Scaper dedup (migration 009) applied; Orlando gate 1 of 2 passed

- Context: user approved the dedup spec with these rules. Venues: 250 m + name match after stripping. Events: same venue ±30 min + headliner containment. Winner: completeness score, with Ticketmaster winning ties. Cancelled and scheduled rows show independently. API filter: `duplicate_of IS NULL`. Gate: Orlando visible count drops by exactly 1, and created places drop from 13 to ≤ 10. Chicago stays blocked until the gate passes.
- Built:
  - `migrations/009_scaper_dedup.sql`: `events.duplicate_of` FK with `ON DELETE SET NULL`, a no-self-duplicate check, `runs.deduped`, and the `geo_name_wide` link method.
  - `scaper/dedup.py`: pure rules — `norm_venue`, `norm_title`, headliner containment, union-find clusters, canonical by completeness then Ticketmaster then first seen.
  - Venue matching: tier A1 (100 m trigram), then tier A2 (250 m + normalized name; containment needs 2+ words). Overture rows win.
  - `python -m scaper relink-venues [--city-slug]` backfill: moves links and events, then deletes orphaned created places.
  - The pipeline dedupes the source's city after purge.
  - The reader adds `duplicate_of IS NULL`.
- Verification:
  - Unit tests: 82 passed (10 new dedup cases built from the real Orlando pairs).
  - Rolled-back Postgres suite on Supabase with 008 + 009: **8/8 passed**. It covers hide/keep, idempotent re-dedup, a purged canonical resurfacing its duplicate, and the wide-match relink.
  - 009 applied live; the column, checks and FK are confirmed.
- Orlando gate:
  - **Visible drop = 1 ✅**: 140 → 139. Only `Joey Cash in Orlando` is hidden, under `Joey Cash "Poser Tour"`. The OMRI/MashBit pair stays visible. The API returned 200 with 0 hidden IDs.
  - **Created places 13 → 11 ❌** (target ≤ 10). The relink matched Conduit and The Abbey (`geo_name_wide`); 0 orphan places remain.
  - `The Abbey-Orlando` is unresolved. Ticketmaster has **3 venue IDs** for the same address (100 S Eola Dr, 32801), with coordinates up to 315 m from Overture's `The Abbey` (same address). A 250 m radius cannot reach it.
- Status: migration 009 is live; the code is uncommitted pending the gate decision. **Chicago remains blocked.**
- Next action: user decides on a proposed tier A2b (normalized name equal + same normalized street address + postcode, ≤ 500 m). It would resolve Abbey-Orlando (11 → 10) and would be re-verified in Orlando.

## 2026-09-26 — Scaper Ticketmaster live on Supabase; dedup spec drafted

- Context: user approved the live Ticketmaster run, the commit, then a dedup spec. **No second city until dedup is designed and approved.**
- Live result (`ticketmaster:orlando`, 28.5417,-81.3776, 15 km): run 1 inserted 108 (107 scheduled, 1 cancelled) with 0 failed. Run 2 found 108 unchanged, so stripping `distance` works. Run 3 purged one backdated row (`runs.purged=1`); the 33 Eventbrite rows were untouched. Run 4 restored the row (108 total). Venues: 18 linked (5 `geo_name`, 13 `created`); 0 events lack a place.
- API: `/api/v2/explorer/events` (15 km, limit 100) returned 200 with 100 rows (94 Ticketmaster). The cancelled row was not visible. The 100-row cap is now binding: 141 events are in range.
- Commits (local, not pushed): `8e474f1` (Scaper + 008 + Eventbrite), `2cee77c` (Ticketmaster).
- Dedup evidence: 0 cross-provider duplicates. 1 same-provider duplicate (Joey Cash, two TicketWeb IDs). 1 same-place, same-hour pair that are different shows (OMRI vs MashBit). 3 venue-match misses (Conduit at 102 m, The Abbey at 188 m, The Abbey-Orlando created twice). Raw title similarity scored the true duplicate 0.31 and the false pair 0.43, so the spec uses normalized titles.
- Spec: `Scaper_Dedup_Spec.md` (draft). Tiered venue matching; a `duplicate_of` hide-don't-delete event dedup; migration 009; acceptance tests; 4 open questions.
- Next action: user decides the spec's open questions → implement 009 + dedup → re-verify in Orlando → only then Chicago.

## 2026-09-26 — Scaper Ticketmaster connector (built; superseded by live entry above)

- Context: user confirmed Eventbrite end-to-end and approved Ticketmaster under the same rules: `source_id` scoping, purge after a successful fetch, `runs.purged`, venue linking within 100 m, and new places only when nothing matches. Scaper + 008 + Eventbrite were committed first as `8e474f1` (local, not pushed). The Explore v1 hub path is untouched.
- Built: `scaper/connectors/ticketmaster.py` (Discovery v2 geo source; config is lat, lng, `radius_km`, `days_ahead`, optional `segment_id`). The query window runs from now − 6 h to now + `days_ahead`, so in-progress events are included. Paging uses size 200. A listing counts as complete only if `totalElements` ≤ 1000 (the Discovery deep-paging cap); otherwise vanished events are not expired. The query-relative `distance`, `units` and `_links` fields are stripped before hashing, so an unchanged event isn't re-extracted on every run. Status mapping: onsale, offsale and rescheduled → scheduled; postponed → postponed; cancelled → cancelled. Missing `priceRanges` means an unknown price, never free. The CLI raises the httpx logger to WARNING because the API key travels in the query string.
- Verification: `pytest tests/test_scaper_ticketmaster.py tests/test_scaper_eventbrite.py tests/test_scaper_pipeline.py`: 50 passed. Pyright clean on `scaper/`. The live read-only preview (Orlando, 15 km, 14 days) accepted 108/108 events with a complete fetch; the key was not present in the CLI output. No Ticketmaster rows have been written to Supabase.
- Risks: there is no cross-provider dedup, so the same show listed on Eventbrite and Ticketmaster produces two rows. Overlapping geo sources would flip `source_id` between them. Keep sources non-overlapping per city.
- Next action: with approval, register `ticketmaster:orlando`, run it live, and verify API rows, purge and linking. Then commit the Ticketmaster work.

## 2026-09-26 — Scaper live: migration 008 applied, purge job, Eventbrite end-to-end verified

- Context: user approved (1) the rolled-back Postgres suite on Supabase, (2) applying 008, (3) a purge job, and (4) live end-to-end verification. Ticketmaster stays blocked until this entry is confirmed.
- Purge: `PostgresStore.purge_past_events()` deletes `public.events` rows where `source_id IS NOT NULL` (only Scaper sets it; the table has no `source` column) and `COALESCE(end_time, start_time + 6h) < now()`. It runs only after a successful fetch, never after a failed one. The count is stored in the new column `ingest.runs.purged`, which was folded into 008 before 008 was applied.
- (1) `tests/test_scaper_postgres.py` against Supabase: **6/6 passed**. This includes a purge-scoping test, where a non-Scaper past row survives. After the run: no `ingest` schema, 0 events, 0 stray test places. The rollback left no trace.
- (2) 008 applied and committed. Confirmed present: `ingest.{place_links,raw_records,runs,sources}`, 13 new `events` columns, `events_status_chk`, FKs to places, sources and raw_records, the unique index on `(provider, external_id)`, and `runs.purged`.
- (4) Live: source `eventbrite:org:84855780433` (Orlando), run 1 fetched 33 and inserted 33, with 0 failed. Place linking: 10 venues matched existing Overture places (`geo_name`), 0 created. `GET /api/v2/explorer/events` (TestClient against Supabase, auth overridden) at downtown Orlando with a 5 km radius returned **33 real rows**, including an event already in progress. Purge proof: one real row was backdated; run 2 reported purged=1 (also logged in `ingest.runs`); the row was deleted; the API returned 32. To restore, its raw record was set to `failed`; run 3 re-inserted it, for 33 total. Non-Scaper events: 0 touched.
- Unit suites: 31 passed (Eventbrite + pipeline, including purge-after-success and no-purge-after-failed-fetch).
- Risks: the source is registered, but no scheduler runs `python -m scaper run-due` yet. The main `/explore` hub still doesn't read `public.events`. Purged events keep their `ingest.raw_records` rows, so the payload history remains.
- Next action: user confirmation of step 4, then schedule `run-due` and build the Ticketmaster connector.

## 2026-09-26 — Scaper connector system: Eventbrite proof of concept (built, not deployed)

- Context: the brief asked for a separate Scaper ingest service feeding Explorer, with Eventbrite first. Design record: `Scaper_Connector_Architecture.md` (this folder).
- Goals addressed: `scaper/` package with a connector contract, retrying HTTP, the Eventbrite connector, the pipeline, a Postgres store, and a CLI. `migrations/008_scaper_ingest.sql` adds `ingest.{sources,runs,raw_records,place_links}` and additive `public.events` columns. The existing `places` table is reused; no second places table was created. The `/api/v2/explorer/events` reader now hides cancelled, completed and expired rows and keeps in-progress events visible.
- Evidence gathered on the live systems (read-only): Supabase already has an empty `public.events` table (read by `/explore-v2`) and 1.88M `places` rows. The `ingest` schema is absent, and `place_ingest_runs` (006) is not applied. Eventbrite `/v3/events/search/` returns 404. `/v3/organizers/{id}/events/` returns 200, and `python -m scaper preview` against one organizer fetched and extracted 33/33 live events with no DB writes.
- Verification: `pytest tests/test_scaper_eventbrite.py tests/test_scaper_pipeline.py tests/test_scaper_postgres.py tests/test_explorer_v2.py tests/test_migrations_unique.py`: 52 passed, 5 skipped. The skipped tests are the opt-in Postgres suite (`SCAPER_PG_TEST_URL`), which runs the migration and pipeline inside a rolled-back transaction. It has **not been run**. Pyright is clean on `scaper/` and the new tests.
- Not done / risks: 008 not applied, so no Scaper rows exist in Supabase. The main `/explore` hub does not read `public.events`. No curated Eventbrite organizer list exists. Meetup, Yelp and Google Places cost and terms need re-verification. The Instagram scraper is blocked by `data-spine.md`.
- Next action: run the rolled-back Postgres suite, then apply 008 with explicit approval. Seed a small organizer list for one launch city and run `scaper run-due` on a schedule. Then build the Ticketmaster connector and map `public.events` into `/api/v1/explore/events`.

## 2026-09-26 — CTO review of Scaper Eventbrite work in progress

- Follow-up after Claude X handoff: independently reran the stated five-file test command: 52 passed, 5 skipped. The five skipped tests require `SCAPER_PG_TEST_URL`; therefore migration idempotence, real Postgres writes, venue matching, and rollback behavior remain unverified. The new `Scaper_Connector_Architecture.md` and `/api/v2/explorer/events` filter change are present. The handoff reports a live 33-event Eventbrite preview, but this review did not rerun that provider call.
- Production test gate: do not point `tests/test_scaper_postgres.py` at live Supabase. Its fixture executes migration 008 twice inside each outer transaction; rollback prevents persistence but not temporary DDL locks on `events` and referenced `places`. Its 5-second `lock_timeout` limits waiting to acquire locks, not how long acquired locks are held. First run on a disposable Postgres/PostGIS staging database with the relevant schema. After that, review the migration and apply it separately before deploying the v2 reader change, which currently swallows pre-migration query errors as an empty list.
- Context: reviewed the proposed separate Scaper service and the untracked `scaper/` package, `migrations/008_scaper_ingest.sql`, and focused tests against the locked Explore data spine. This was a review, not a deployment or provider run.
- Fit: the implementation keeps the existing Overture `places` table, links provider venues to it where possible, and stores event provenance and run history. Eventbrite extraction is deterministic in this proof of concept; no Claude extraction stage or other proposed connectors are implemented.
- Verification: `python -m pytest -q tests/test_scaper_eventbrite.py tests/test_scaper_pipeline.py` via `.venv/Scripts/python.exe` passed 29 tests. Tests use mocked HTTP and an in-memory Store; Postgres migration, live provider token/endpoint, and `public.events` writes were not verified.
- Integration gap: main `GET /api/v1/explore/events` still calls `search_events_extended` / the Ticketmaster and `explore_contents` path. No Scaper-to-main-hub read mapping or event-detail lookup was found. Scaper rows should not be described as visible in Explore yet.
- Decision/risk: retain Overture as the place inventory source. Do not treat Google Places or Yelp as free bulk-ingest sources without current terms and cost review. The proposed background Instagram scraper conflicts with `data-spine.md`'s explicit no-crawler boundary. Next action is a Postgres migration/upsert integration test, then a gated `public.events` reader for the hub and event detail before claiming an end-to-end proof of concept.

## 2026-09-26 — Automatic narrow-screen Explore layout

- Goal: make the Explore feed and lower sections usable in the narrow Codex side view and Android-sized layouts through automatic CSS breakpoints. No user-facing mode switch or new provider API.
- At widths below 768px, listing cards without a verified photo show a compact 64px source/unknown strip instead of a tall striped image placeholder. Cards with photos keep their normal media height. The destination tabs and reel stay horizontally scrollable without visible scrollbar tracks; the arrow controls remain available.
- The saved picks bar now defaults to a compact summary above the shared bottom navigation. Its toggle expands party-size, provider-link, and Clear controls. The page reserves more scroll space while expanded. The global Wayra launcher uses the mobile navigation height and safe-area inset, and stays above the saved bar when present. Stored dragged positions are visually clamped to the viewport and bottom controls.
- Verified in the local 518px in-app browser: compact unknown-photo cards, mobile saved-bar expand/collapse, lower destination carousel, and the bottom controls. Measured rectangles after collapse: Profile top 666px, saved bar bottom 666px, Wayra bottom 578px, so those controls do not overlap at that viewport. `scrollbar-width` computed as `none` for the mobile destination tabs after fixing selector specificity.
- Explore Vitest: 116 passed across 21 files. `npx tsc --noEmit`: 0 errors. `git diff --check` found no whitespace errors in touched UI files. Physical Android device and wide desktop visual QA remain open; responsive CSS targets <=767px, with extra saved-bar spacing <=400px. F34 remains Partial for its separate account-isolation and Collection Retry gates.

## 2026-09-26 — F34 signed-in browser restore; saved-price loading state

- In a signed-in local Explore session, saved Griffith Park from its drawer. The card changed to Saved. Reloaded `/explore`; Collection restored one saved selection, and after the listing feed loaded the Griffith Park card and drawer both showed Saved. This verifies the save/reload portion for one account and listing. A browser cache-bypass reload was not performed.
- During restore, the saved bar briefly showed `$0 each` while its listing record was unresolved. Updated `ExploreSavedBar` to treat unresolved saved IDs as unknown-price, preserving the saved selection without implying a free listing.
- A focused server-rendering regression test checks the unresolved-listing state. Related save tests: 7 passed across 3 files; `npx tsc --noEmit`: 0 errors. `graphify update .` completed.
- F34 remains Partial in product and workbook row 60 is unchanged. Account A/B isolation, forced Collection GET failure and Retry, and Explore unsave are not browser-verified or complete. No second account was available in this session. The listing feed intermittently took long enough to show a partial source failure before Retry recovered; this is a separate inventory reliability issue.
- Next action: perform the remaining F34 browser gates with a second test account and a controlled Collection GET failure, then decide the Explore unsave acceptance requirement.

## 2026-09-26 — Remove unsupported rain prompt metrics; F34 browser gate

- Replaced the Explore masonry `ask-rain` prompt and subtitle with neutral indoor-discovery copy. The prior fixed “70% chance at 2 PM · 12 indoor swaps” had no live weather or inventory basis.
- Verified the new text in a local `/explore` browser session. The hub showed 24 of 96 loaded listings, Overture slot cards, and an opening detail drawer.
- The browser session was signed out: pressing the drawer’s Save to Collection button routed to `/login?next=%2Fexplore`. Therefore save → refresh, account isolation, and Collection failure → Retry remain unverified. F34 remains Partial in product and workbook row 60 is unchanged.
- Focused Vitest: 9 passed across the unsupported-group-fixtures and no-AI-inventory suites. `npx tsc --noEmit`: 0 errors. `graphify update .` completed.
- Next action: sign in on the local login page, then execute the F34 browser checklist already recorded below. Do not infer save persistence from the signed-out redirect.

## 2026-09-25 — F34 persistent saved listings (Partial in product)

### Context

Explore hub saves must use the existing **My Space / Collection** API (`GET`/`POST `/collection/items`), restore after refresh for signed-in users, and stay idempotent via stable `saved_from` keys (Overture place `id` = GERS id).

### Goals addressed

- **`explore-hub-save.ts`**: `explore:listing:place:{id}` / `explore:listing:event:{id}` keys, restore helpers, POST body builder.
- **`use-explore-hub-saves.ts`**: load collection on login, merge into saved bar + card/drawer state; save with saving/saved/error + Retry; signed-out → `/login?next=/explore` (no localStorage).
- **`collection_service.py`**: `find_item_by_saved_from` + idempotent `create_item` when `saved_from` repeats.
- **UI**: `ExploreDetailDrawer` save affordance + error row; `ExploreSlotCard` “Saved” mark; saved bar **Clear** drops session picks only (no Collection DELETE).

### Verification

- Vitest Explore: **112 passed** (19 files), including **`explore-hub-save.test.ts`** (5).
- Backend: **`tests/test_collection_idempotent_save.py`** + **`tests/test_collection.py`**: **6 passed**.
- `npx tsc --noEmit`: **0 errors**.
- **Not run in this pass:** manual browser save → refresh → still saved; account A/B switch in browser. Agent debug ingest logs in `use-explore-hub-saves.ts` (remove after browser QA).

### Status

- **F34 — Partial in product** (workbook row 60): persistence path is wired to Collections; remaining gaps: no Explore **unsave**, save payload often lacks lat/lng when hub slots omit coordinates, saved bar clear vs persisted “Saved” badge on cards (by design: clear ≠ delete Collection).

### 2026-09-25 follow-up — restore, reload retry UI

- **Fix:** `useExploreHubSaves` waits for dashboard auth **`loading === false`** and **`isLoggedIn()`** before `GET /collection/items`. **`saveUiState`** derives **saved** from persisted `saved_from` keys so drawer/card stay aligned after reload.
- **Reload failure:** Amber **alert banner** on `/explore` when Collection reload fails, with **Retry** (keeps message visible while retrying; clears only on success). Drawer save still has per-listing error + Retry.
- **Debug ingest:** removed (temporary F34 instrumentation).
- **Verification (automated):** Explore Vitest **113 passed** (20 files); collection pytest **6 passed**; `tsc` **0 errors**.
- **Verification (manual — required for F34 Complete):** save from drawer → hard refresh → card + drawer **Saved**; account A/B isolation; reload banner + Retry when Collection GET fails. **Not verified in Cursor browser automation** (local `/explore` did not render in MCP snapshot — blank shell only).

### F34 completion gate (status stays **Partial in product** until all pass)

**Required manual checks (not replaceable by Vitest/tsc):**

1. Save a listing from the **drawer** (signed in).
2. **Hard refresh** `/explore` — same listing shows **Saved** on **card and drawer**.
3. **Sign out** → sign in as **another user** — first user’s saves must **not** appear.
4. Sign back in as the **original user** — saves **return**.
5. **Failure → Retry:** force or simulate failed **Collection reload** (`GET /collection/items`) — amber **saved-listings banner** appears with **Retry**; after backend recovery, Retry restores saved marks. (Per-listing save failure still uses drawer error + Retry.)

**What blocks “Complete” even if 1–5 pass:**

- **Explore unsave** is not implemented (items remain in My Space only) — if product acceptance requires unsave from the hub, F34 stays **Partial**.
- Missing **lat/lng** on save body is **not** a gate unless acceptance requires coordinates for this flow.

**No further save-feature code** until a specific failure shows up in checks 1–5.

### Zero slot cards diagnosis (2026-09-25)

**Symptoms:** Hub UI loads but masonry shows **0 slot cards**; pulse bar may say partial failure for **Attractions · Restaurants**.

**Root causes (confirmed locally):**

1. **Places (`GET /explore/places`)** — Overture hot index SQL is **PostgreSQL/PostGIS only**. With **`DATABASE_URL` = sqlite** (default local `.env`), the route returns **503** (spine unavailable) so the hub marks attractions/restaurants as **failed**, not **empty**. Successful Postgres queries with zero rows return **200 + `places: []` + `source_status: "empty"`**; rows return **`source_status: "ready"`**. Freshness lookup failures must not drop already-fetched `places`. **Real Overture rows still require Postgres** with migrations **006/007** and ingest/resync — not sqlite.
2. **Events (`GET /explore/events`)** — **HTTP 200 does not imply inventory.** Empty `events: []` can mean cold cache before Ticketmaster fetch, or date/geo filters with no matches. After cache warm, Chicago + 14-day window + geo returned **50+ verified events** in TestClient while places stayed **[]** on sqlite.
3. **Hub card pipeline** — `fetchExploreHub` builds slots from verified events + Overture places; `filterSlotsByTimeScope` keeps **places** on calendar/day filters but scopes **events** to the active When/day. Zero cards = **both** failed/empty sources or filters removed all events.

**Verification (2026-09-26):** `tests/test_explore_place_spine.py` (sqlite **503** unavailable vs mocked Postgres **200 empty/ready**); Explore Vitest `explore-hub-fetch-state.test.ts` (events-only partial + failure line). TestClient on sqlite: places **503**, events **200** when TM cache warm. Hard refresh `/explore` — expect **event cards + partial banner** (Attractions · Restaurants) when places spine unavailable. **F34** remains **Partial in product**.

### Unblocking `/explore` for manual QA (2026-09-25)

- **UI renders** at `http://localhost:3000/explore` (hero, When row, destinations). Cursor MCP screenshots can look blank while DOM text is present.
- **Listing cards** require hub inventory: local probe showed `GET /api/v1/explore/events?city=Chicago` **200** on `:8000`, but the hub reported **partial failure** for **Attractions · Restaurants** and **0 masonry slot cards** until places spine/data is available.
- **Before F34 manual QA:** ensure FastAPI on the URL in `frontend/.env.local` (`NEXT_PUBLIC_*`), run hub **Retry** if partial banner shows, confirm at least one **slot card** opens a **drawer**. If only events load, save an **event** listing for the checklist.
- **Dev shell issues:** stale Next dev can throw `ChunkLoadError` (blank client) — restart the single `next dev` on port **3000** and hard refresh.

### Next action

- Operator: fix hub inventory (places spine / env) until slot cards appear, then run checks 1–5. Update workbook **F34** only after all pass; keep **Partial** if unsave remains out of scope but required by product.

## 2026-09-24 — Workbook status + UI availability row

- **Tasks tracked:** **76** (18 gates G01–G18 + 58 capabilities F01–F58), rows 9–84 on sheet **Explorer Tasks**.
- **Status (column D, as of 24 Sep 2026):** **33** Complete in code · **23** Partial · **15** Pending · **5** Not started (row 5 COUNTIF formulas on D9:D84).
- **New summary row 4 — UI availability:** **G08** unknown-state copy is **working in code** (Vitest); **F15** open-now/capacity remains **Partial in product** (honest unknowns on Overture place rows without spine hours). Evidence column H lists the Explore UI functions wired through `eventToSlot` / `placeToSlot`, drawer, and cards.
- **Not counted as “Complete”:** production browser QA, live provider inventory, or per-venue hours on Overture until spine supplies them.

## 2026-09-22 — Explorer Scrum task workbook

- Context/goals: user requested one Explorer-specific Excel tracker with every audited capability, task status, importance, difficulty, and color coding. Their review added the locked Overture → Supabase hot index → R2 cold path and the missing-data, trust, identity, and group-truth work.
- Result: `Rovvy_Explorer_Scrum_Book.xlsx` contains 76 task rows: 18 cross-cutting gates and all 58 capabilities from the feature audit. Status, importance, and difficulty are separate editable columns. Red marks **Very hard** difficulty; yellow marks **Critical** importance and **Partial** status; green marks **Complete in code**. The workbook includes filters and an at-a-glance status count.
- Verification: source audit parsed to 58 distinct IDs; the exported XLSX opened as a valid ZIP/XML package with 82 worksheet rows, six conditional-format rules, and three dropdown validations. A rendered top-of-sheet preview was inspected for legibility. No application code or production provider was tested for this documentation update.
- Unresolved risks: “Complete in code” describes a narrow local implementation, not production QA. The source audit predates same-day Critical batch 1; the workbook accounts for the documented fixes where identifiable and leaves data spine, unknown-state design, synthetic-rating removal, provider freshness, and actual group operations open. No full re-audit of all 76 rows was performed.
- Next action: use the Critical filter to agree the Overture/hot-index contract and unknown-state design acceptance criteria, then update task statuses only after implementation evidence.

## 2026-09-22 — Explore feature priority and completion audit

- Context/goals: user requested a project-informed ranking of every main Explore feature and a completion/pending Venn diagram.
- Result: [Explore feature priority audit](Explore_Feature_Priority_Audit.md) expands the 12 broad areas into 58 scoped capabilities: 15 complete in code, 22 partial, 21 pending; priority split is 17 Critical, 25 Important, 16 Later. Counts are not engineering-effort or production-readiness percentages.
- Verification: current TypeScript check passed; 9 Explore helper tests and 16 hero/location/photo tests passed (25 total). Architecture, active call paths, and candidate backend reuse were inspected. No application code changed.
- Risks: synthetic ratings, unverified availability/fee claims, generated event fallback, incorrect filter zero-state, incomplete location propagation, broken fresh OSM fallback, and label-only success actions remain. Earlier live/OSM wording in this record does not establish that every current listing is verified live inventory.
- Environment: source and local mocked/unit tests only; no browser, production-provider, or database-write verification in this audit.
- Next action: address the audit's Critical group before expanding AI/group workflows; update counts only after verification.

## 2026-09-23 — F15 backend pass: OSM hours + Ticketmaster sold out (Partial)

### Context

Second F15 pass: wire **existing** provider fields through `/explore/places` and Explore drawer/cards. No new external APIs, no open-now parsing, no Foursquare detail expansion.

### Goals addressed

- **`explore_city_extended_service.py`**: `opening_hours_from_osm_tags()`; OSM rescue rows include `opening_hours` + `hours_source: "openstreetmap"` when tags are non-empty.
- **`GET /explore/places`**: passes place dicts through unchanged (includes new fields on OSM fallback).
- **Frontend**: `ExplorePlaceRow` → `placeToSlot` → `ExploreSlot` / `ExploreSlotDetail` → **`ExploreDetailDrawer`** shows **Hours · OpenStreetMap** + raw string, or **Hours unknown**; place cards use **Hours listed** when OSM hours exist (not open-now).
- **`explore-availability-copy.ts`**: `sold_out` / `soldout` → **Sold out**; generic **Open** → **Check provider**; `hubListingBadge` normalizes Ticketmaster status for badges.
- **Tests**: `tests/test_explore_places_hours.py`; extended `explore-availability-copy.test.ts` (sold out, 24/7 drawer path).

### Verification

- `.venv\Scripts\python -m pytest tests/test_explore_places_hours.py -q`: **3 passed**.
- `npx vitest run app/(dashboard)/explore/__tests__`: **26 passed** (8 files).
- `npx tsc --noEmit`: **0 errors**.

### Status

- **F15 — Partial in code** (Scrum): Explore surfaces avoid invented open-now, walk-in, bookable, and capacity claims; verified **Ticketmaster sold out** and **OSM weekly hours** flow end-to-end on those rows.
- **Remaining gap**: Foursquare-primary place listings (when OSM rescue does not run) still have no verified hours string — drawer shows **Hours unknown** until the locked data-spine / Foursquare migration (out of scope for this pass).

### Scrum workbook

- **F15** row **Partial** (verified in workbook): OSM + Ticketmaster path documented in row notes; no separate workbook sidecar file.

### Product decision — verified hours only (Approach A)

- **2026-09-23:** Do **not** add category-default or “typical” standing hours (e.g. subway 7–8, restaurant 8–10). Estimated windows would read as inventory facts and undo F15 trust work.
- **Completion path for F15:** per-venue verified hours via the locked **Overture → Supabase hot index → R2 cold** data spine (and provider fields already wired). Until then, uncovered listings stay **Hours unknown** / **Check provider**.
- **Independent re-verification (same day):** backend F15 tests **3 passed**; Explore Vitest **26 passed**; `tsc` **0 errors**; graphify refresh **16,585 nodes / 41,356 edges**.
- **F15 code/docs:** leave unchanged until data-spine supplies verified per-venue hours.

## 2026-09-23 — G14 listing location display (Complete in code)

### Context

Suppress invalid listing locations and dangling separators (e.g. **· US** when city is missing) on Explore listing surfaces only — not hero, location search, or provider APIs.

### Goals addressed

- **`explore-listing-location.ts`**: `formatListingLocationDisplay`, `joinExploreMetaParts`, `formatEventListingSummary`, `formatEventListingBody`, `formatEventListingDescription`, `formatMapsSearchQuery`, `formatCategoryCardLocation`, `formatSlotListingArea`
- Applied to hub **`eventToSlot` / `placeToSlot`** (including drawer **`body`** / **`description`**), picks **`buildRanked`**, **`hubSlotToDetail`**, **`ExploreCategoryEventCard`**, **`ExploreDetailDrawer`**, **`/explore/event/[id]`** (maps query disabled when location empty)
- Raw **`stateLabel` / `countryLabel` / `city`** on slots unchanged for **`explore-location-scope`** filtering

### Verification

- `npx vitest run app/(dashboard)/explore/__tests__`: **42 passed** (10 files), including **`explore-listing-location.test.ts`** (body prose, maps query, regression scan)
- `npx tsc --noEmit`: **0 errors**
- `graphify update .` via `graphify-out/.graphify_python`

### Scrum workbook

- **G14** → **Complete in code**

## 2026-09-23 — G09 / F07 hub load states (Complete in code)

### Context

Main `/explore` hub must distinguish loading, true empty inventory, partial provider failure, and full failure without treating failed requests as zero results or mislabeling empty cache as an error.

### Goals addressed

- **`explore-hub-fetch-state.ts`**: per-source `ready` / `empty` / `failed`; hub `ready` / `partial` / `empty` / `failed` (failure not inferred from `freshness.unavailable`).
- **`fetchExploreHub`**: **`Promise.all`** concurrent per-source wrappers (same timeout); preserve rows from successful sources; failed sources excluded from **`sources`** list.
- **Partial vs inventory**: masonry/stats/picks only when **`data.slots.length > 0`**; partial warning (with Retry) even when zero slots survive — distinct copy for “Showing available results” vs “Available sources returned no listings”.
- **`useExploreHub`**: clears stale cards on reload; **`retry()`** uses **`buildExploreHubFetchInput`** (city, scope, coords, Tonight/Weekend date range); no `totalLive === 0` error string.
- **`page.tsx`**: loading status; partial warning + Retry; true empty copy; full failure alert + Retry; filter-zero and prompt-zero unchanged; removed “feed never comes back empty” copy.

### Verification

- `npx vitest run app/(dashboard)/explore/__tests__`: **61 passed** (12 files), including concurrent-fetch and partial-zero inventory cases in **`explore-hub-fetch-state.test.ts`**.
- `npx tsc --noEmit`: **0 errors**.
- `graphify update .` via `graphify-out/.graphify_python`.

### Scrum workbook

- **G09** and **F07** → **Complete in code** (hub only).
- **Limitation:** browser/provider QA not re-run; mock **`apiFetch`** covers fetch contract tests only.

## 2026-09-23 — G15 / F08 Explore hub count contract (Complete in code)

### Count definitions (main `/explore` hub only)

- **`loadedScopeCount`**: all successfully fetched, mapped listings after selected location and date scope (bounded client pool — not provider-wide totals).
- **`matchingCount`**: loaded-scope listings matching active category, vibe, and price filters.
- **`visibleCount`**: listings revealed in the masonry feed (`matchingSlots.slice(0, visibleLimit)`; initial limit **24**).
- **`pageSize`**: **24**; **`hasMore`**: `visibleCount < matchingCount`.
- **Pools**: card feed, Explore picks, and Wayra prompt planning use **visible** listings; saved-detail lookup uses the full **loaded-scope** pool.
- **Category stat counts**: for each stat chip, `filterHubSlotsByChips(loadedScope, activeChips + chip)` (no duplicate if already active). The number beside an inactive chip equals the result count after adding that chip; an active stat chip shows the current filtered count.
- **Free / Free tonight**: same predicate for stat count and filter (`isExploreFreeInWhenRange` — verified dated free events in the selected when range only; not generic price-free places or editorial rows).
- **Hero listing count** (`explore-hero-listing-count.ts`): `loading` → “Checking listings”; successful empty → “0 loaded listings”; ready/partial-with-rows → “{n} loaded listings”; failed / unexpected error / partial-with-zero → “Listing count unavailable”.

### Goals addressed

- **`explore-hub-counts.ts`**, **`explore-hub-listing-predicates.ts`**, **`explore-hub-chip-match.ts`**: shared predicates, stats builder, paging/copy helpers, deterministic round-robin merge.
- **`fetchExploreHub`**: maps full successful responses (no hidden `slice(0,12)` / `slice(0,24)` caps); **`totalLive`** removed.
- **`page.tsx`**: Load more (+24), pagination reset on city/scope/date/filters/reload; honest pulse/refine/hero copy; partial/G09 behavior unchanged.
- **`HeroLocationWidget`**: **`listingCountState`** distinguishes “Checking listings”, successful zero or loaded counts, and “Listing count unavailable” when provider coverage failed or partial coverage returned no rows.
- **Category stats**: Events / Food & drink / Live music / Outdoors / Landmarks / Free (or Free tonight); **Showing now** removed; Landmarks never `|| places.length`.

### Verification

- `npx vitest run app/(dashboard)/explore/__tests__`: **86 passed** (14 files) as of **2026-09-24** (includes calendar-safe date fixtures in **`explore-hub-counts.test.ts`**).
- `npx tsc --noEmit`: **0 errors**.
- `graphify update .` via `graphify-out/.graphify_python`.

### Scrum workbook

- **G15** and **F08** → **Complete in code**.
- **F27** stays **Partial** (client Load more only; no provider/backend pagination).
- **F09** stays **Partial** (broader date behavior unchanged).

## 2026-09-23 — G07 / F04 no AI in Explore inventory (Complete in code)

### Scope

Main Explore **verified event inventory** only: hub `/explore/events` feed, city `/explore/[city]/events`, and event detail. Editorial seasonal ideas are isolated on `/explore/seasonal-events-ai` and must not merge into provider feeds.

### Backend behavior

- **`search_events_extended`**: **`filter_verified_explore_event_rows`** on `db_events` and aggregated `all_events` **before** `_paginate_events`, `return_all`, and `pool_limit` so generated rows never consume page slots and **`total`** is verified-only across pages.
- **`GET /api/v1/explore/events`**: route-level defensive filter; **`view=list`** preserves `result["total"]` when nothing removed, otherwise subtracts removed rows (never `len(current_page)`).
- **`fetchExploreHub`**: **`filterVerifiedExploreApiEventRows`** on the combined events/trending/weekend/popular pool **before** `rawEventCount`, date filter, `eventToSlot`, sources, and event source status (editorial-only API → events source **empty**).
- **`GET /api/v1/explore/events/{event_id}`**: Ticketmaster/OSM/aggregated cache only; **`ai-ev-*`** and **`mock-*`** without DB rows → **404** (no fabricated “Local Experience”).
- **`GET /api/v1/explore/seasonal-events-ai`**: editorial only — `kind: "editorial_suggestions"`, `verified_inventory: false`, `suggestions[]` (title/emoji/summary/area_hint/season_hint); no `events` inventory shape.

### Frontend behavior

- **`explore/[city]/events/page.tsx`**: Ticketmaster + Google Events + Eventbrite only; honest empty when sparse/zero.
- **`explore-editorial-inventory.ts`**: single allowlisted helper for `ai_fallback` / `ai-ev-*` detection; hub maps editorial rows out of verified Events/Free counts via existing `editorial` flag + source/id guards.

### Verification

- `DATABASE_URL=sqlite:///./test.db pytest tests/test_explore_events_endpoint.py -q`: **16 passed** (pagination 45/20, pre-pagination strip, hub list totals)
- `npx vitest run app/(dashboard)/explore/__tests__`: **86 passed** (14 files), including **`fetchExploreHub`** editorial rejection tests and calendar-aligned date fixtures (**2026-09-24**)
- `npx tsc --noEmit`: **0 errors**
- `graphify update .` via `graphify-out/.graphify_python`

### 2026-09-25 — Explore Overture `lng` mapping fix

- **Bug:** `SPATIAL_PLACES_SQL` / `CITY_PLACES_SQL` selected `ST_X(...) AS lon` while `map_spine_row_to_explore_place()` read `lng`, so `/explore/places` returned `lng: null`.
- **Fix:** SQL aliases longitude as **`lng`**; mapper accepts `lng` with fallback **`lon`** for legacy rows.
- **Verification:** `pytest tests/test_explore_place_spine.py -q` (includes SQL-row regression for **-87.63** on city + spatial paths). **G18 / F02 not marked complete.**

### 2026-09-25 — Explore hub calendar strip (Phase A, F09 partial)

- **UI:** 14-day **Calendar** under the When row on main `/explore`; only days with **dated events** in the loaded pool appear; tap a day to filter the feed (events on that day + Overture places). Category stat chips hide when count is 0.
- **Data:** Same **3 hub APIs**; events fetch window widened client-side via `mergeWithCalendarFetchRange` (no new backend route).
- Verification: Explore Vitest **107 passed** (18 files), including `explore-hub-calendar.test.ts`.

### 2026-09-24 — G01 / G02 operational hardening (bounded SQL, ingest truth, R2 fail-closed)

- **Hot queries:** `explore_place_spine_service.py` applies `LIMIT :lim` and deterministic `ORDER BY` in SQL (no Python slice / `ROW_NUMBER` dedupe). Index: `migrations/007_places_city_category_explore_idx.sql`.
- **Migrations:** ingest metadata moved to `migrations/006_place_ingest_runs.sql` (replaces conflicting `003_*` number); `tests/test_migrations_unique.py` guards numeric prefixes.
- **Ingest:** `begin_ingest_run` before load/resync; failures mark run failed and exit **1**; succeeded-scope idempotency; `place_ingest_run_cities` for freshness coverage.
- **R2:** `06_publish_places_r2.py` validates Parquet via DuckDB, fail-closed remote checks, manifest uploaded last.
- Verification: focused backend pytest **43 passed**, **1 skipped** (`test_places_resync` DB); Explore Vitest **103/17**; `tsc` **0**.

### 2026-09-24 — G01 / G02 Overture places hot index + R2 contract

- **G01**: `GET /api/v1/explore/places` reads the Overture `places` Postgres hot index via `explore_place_spine_service.py` (city_slug or `ST_DWithin` on `geog`). No Foursquare/OSM fallback on this route. Hub frontend sends `lat`/`lon`/`radius_m`/`limit`; `gers_id` is slot identity and dedupe key; source label **Overture**.
- **G02**: `migrations/006_place_ingest_runs.sql` + `place_ingest_run_cities`; truthful ingest in `04_load.py` / `05_resync.py` (begin before mutate, fail closed); city-scoped freshness; `scripts/06_publish_places_r2.py` fail-closed R2 contract + DuckDB parquet row-count verify (no live upload in CI).
- Verification: `pytest tests/test_explore_place_spine.py tests/test_publish_places_r2.py tests/test_publish_places_r2_unit.py tests/test_place_spine.py tests/test_explore_places_hours.py -q` **23 passed**; Explore Vitest **103 passed** (17 files); `tsc --noEmit` **0 errors**.
- `05_resync.py` records ingest runs (start → resync → complete/fail). R2 publish skips upload when manifest sha256 matches (idempotent); conflicting remote hash exits **2**.
- Workbook **G01** row **9** and **G02** row **10** → **Complete in code**. **F15** / **F27** remain **Partial**. No production R2 upload performed in CI/tests.

### 2026-09-24 — G08 unified unknown states + F14 Explore ratings

- Context: inventory cards used generic Unsplash fallbacks and inconsistent missing-field copy (Listing photo, See pricing, dash ratings).
- Result: **`explore-listing-field-state.ts`** — shared price/photo/rating/hours/availability helpers; **`ExploreCardImage`** `fallbackMode="unknown"` for inventory; hub cards, drawer, category pages, event detail, and picks table aligned.
- Unknown copy: **Price unknown**, **Photo unavailable**, **Hours unknown**, **Check provider**, **Sold out**; drawer **View provider** when price unknown + verified URL.
- F14: removed **`pseudoRating`** from **`frontend/lib/explore-events.ts`** for Explore; **`frontend/app/(dashboard)/events`** unchanged (documented boundary).
- Verification: Explore Vitest **101 passed** (16 files), including **`explore-card-image-lifecycle.test.tsx`** (resets `loadFailed` on `imageUrl` / `placeId` / `fallbackMode` change); `npx tsc --noEmit` **0 errors**; no new API.
- Scrum workbook: **G08** row **16** D16/H16, **F14** row **40** D40/H40 → **Complete in code** (Explore scope). **F11**, **F13**, **F15** remain **Partial**.

### 2026-09-24 — Explore Vitest date fixtures (calendar-safe)

- Context: hub count, v6 map, and G07 fetch tests had hard-coded **2026-09-23** / fixed clocks while production **`dateRangeForWhen`** uses the real calendar → failures when the date rolled forward.
- Result: **`explore-test-date-fixtures.ts`** — `dateInWhenRange(when, offsetDays)` from live **`dateRangeForWhen(when).dateFrom`**; regression test **`expectFixturesAlignedWithTonightRange`**; verified Free events stay dated, **`priceKnown`**, non-editorial, **`exploreListingKind: "event"`**.
- Verification (2026-09-24): Explore Vitest **86 passed** (14 files); `tsc --noEmit` **0 errors**; `pytest tests/test_explore_events_endpoint.py -q` **16 passed**; graphify update **16834 nodes / 42093 edges**.
- Scrum workbook: **G07** row **H15** and **F04** row **H30** evidence updated; **D15** / **D30** remain **Complete in code**.

### Risks

- Editorial endpoint still calls Gemini when invoked directly; no Explore inventory page consumes it after this pass.
- Provider-empty UX is intentionally sparse until real inventory or editorial product surfaces are designed separately.

### Scrum workbook

- **G07** (row 15) and **F04** (row 30) → **Complete in code**

### 2026-09-23 follow-up — count contract alignment

- **Free filter parity**: `Free` / `Free tonight` use `slotMatchesCategoryStatChip`, not generic price-free matching.
- **Category stats**: counts use `chipsForCategoryStatCount` + `filterHubSlotsByChips` (full active filter set per chip).
- **Hero counts**: `ExploreHeroListingCountState` — unavailable vs true empty vs loaded count.

## 2026-09-23 — G16 unsupported group fixtures hidden (Complete in code)

### Context

Keep production Explore honest while invitations, friend attendance, group-chat delivery, and expense splitting are not connected from the hub.

### Verified result

- Removed the hub invite sheet and every entry point to it from the saved bar and detail drawer.
- Removed the disabled split placeholder, friend-attendance pill/copy, friend-search prompt, and invitation masonry card.
- Removed the related fixture types and guest arrays; provider deposit copy no longer claims Rovvy splits it.
- Preserved local Save, provider-link handoff, and the event-detail poll/share flows because those perform real API or browser operations and report success only after completion.
- Added `explore-no-unsupported-group-fixtures.test.ts` to keep unsupported controls and attendance copy out of the production hub.

### Verification

- `npx vitest run app/(dashboard)/explore/__tests__`: **44 passed** (11 files).
- `npx tsc --noEmit`: **0 errors**.
- `graphify update .` via `graphify-out/.graphify_python`.

### Scrum workbook

- **G16** → **Complete in code**.
- **F37–F39** remain **Pending**: hiding unsupported UI does not implement invitations or group-message delivery.
- **F17** remains **Partial** pending the wider product-claim audit.

## 2026-09-23 — G17 / F6 cache freshness on `/explore` hub (Complete in code)

### Context

Replace browser-load “updated just now” with Postgres cache **`fetched_at`** metadata for hub events and place lists. F15 hours logic untouched.

### Goals addressed

- **`explore_cache_freshness.py`** + **`_get_cached_list_with_meta`** / **`get_places_cached_with_meta`**
- **`search_events_extended`** returns **`freshness`** (fresh cache, provider refresh, stale fallback, empty, unavailable)
- **`GET /explore/events`** and **`GET /explore/places`** include **`freshness`** in JSON
- **`fetchExploreHub`**: **`sourceFreshness`** `{ events, attractions, restaurants }`; **`loadedAt`** diagnostic only
- **`explore-freshness-copy.ts`** + pulse bar: **Explore listings**, **Listing sources**, **Cache refreshed …** / **Data age · …** / **Older cached data · events … · attractions …** / unavailable
- Removed **Live inventory**, **`fetchedAt`** display, and hard-coded **Ticketmaster · OpenStreetMap** source fallback (**Sources unavailable** when empty)

### Verification

- `.venv\Scripts\python -m pytest tests/test_explore_cache_freshness.py -q`: **4 passed**
- `npx vitest run app/(dashboard)/explore/__tests__`: **34 passed** (9 files)
- `npx tsc --noEmit`: **0 errors**
- `graphify update .` via `graphify-out/.graphify_python`

### Scrum workbook

- **G17** and **F06** → **Complete in code** (same evidence string in row notes)

### Follow-up (not blocking G17/F6)

- Category pages and non-hub Explore routes may still omit freshness metadata
- Mock/test Ticketmaster path on `/explore/events` returns **`unavailable`** freshness

## 2026-09-23 — Next Explore task: G17 / F6 (freshness, not hours) — superseded

### Context

Product agreed **Approach A** for hours (F15 Partial, frozen). Next independent work is **G17** (gate) and **F6** (capability audit ID 6): **Freshness and live status** — same acceptance criteria.

### Problem (current)

- Hub sets `fetchedAt: new Date().toISOString()` in `explore-hub-data.ts` after parallel fetches; UI `formatFetchedAgo(data?.fetchedAt)` on `/explore` reflects **browser fetch time**, not provider/cache age.
- Backend Explore caches already store **`fetched_at`** and TTL in `explore_city_extended_service.py` (`_get_cached_list` / `ExploreContent` rows) but that metadata is **not** returned on `/explore/events`, `/explore/places`, or aggregated hub responses.

### Intended scope (when implemented)

- Propagate **last provider refresh** (and optionally cache hit vs live fetch, stale vs within TTL) from backend → API → hub mapper → chrome copy.
- **Out of scope for this task:** F15 hours/open-now, category-default hours, Overture spine (G01–G02) except reusing existing Postgres cache timestamps where available.

### Workbook

- **G17** / **F6** remain **Not started** / **Partial** until implementation evidence; do not conflate with F15.

## 2026-09-22 — F15 availability & hours copy (frontend baseline)

### Context

Audit hours/availability strings under `app/(dashboard)/explore` without new APIs.

### Goals addressed

- **`explore-availability-copy.ts`**: `categoryCardScheduleLine`, `normalizeListingAvailability`, `hubListingBadge`.
- **`ExploreCategoryEventCard`**: **Hours unknown** / event datetime from `date`/`start_date`; previews → **Preview · hours unknown** and **Preview · coming soon**.
- **Hub**: places/events default to **Check provider**; card badges only for explicit provider status (not “Open”); neutral badge styling; **Bookable now** / **Walk-in OK** filters removed from refine panel.
- **Fixtures**: dropped fake capacity/walk-in badges and “slots match right now” ask copy.

### Verification (superseded by 2026-09-23 entry for F15 status)

- Prior run: **24 passed** Explore Vitest; **0** tsc errors.

## 2026-09-22 — G10 remove synthetic ratings across `/explore`

### Context

Complete scrum **G10** for the Explore tab only: drop `pseudoRating` stars/review counts on all category listing cards, fix event detail hard-coded scores and “highly rated” copy, and stop popularity-implying sorts/headings on Events / Activities / Sports.

### Goals addressed

- Shared **`ExploreCategoryEventCard`** (no star row) on Events, Activities, Sports, Food, Parks, Shopping, Landmarks, Gaming, Nightlife, Amusement, Trekking.
- **`stableEventFeed`** preserves provider/filter order; section titles → **Local listings** / **National listings** (no “Trending / most popular”).
- **`/explore/event/[id]`**: removed star rating UI, fake 4.5 snapshot score, similar-event stars, and “highly rated / premium … star” recommendation block.
- Main hub cards already hide `—` via **`cardRatingDisplay`**; design fixtures neutralized to `—`.
- Regression: **`explore-no-synthetic-ratings.test.ts`** (no `pseudoRating` imports under `app/(dashboard)/explore`).

### Verification

- `npx vitest run app/(dashboard)/explore/__tests__`: **19 passed** (6 files).
- `npx tsc --noEmit`: **0 errors**.
- Scrum **G10** → **Complete in code** in `Rovvy_Explorer_Scrum_Book.xlsx`.

### Follow-up (out of scope)

- Global dashboard **`/events`** (`frontend/app/(dashboard)/events/page.tsx`) still defines its own **`pseudoRating`** — not part of this Explore-tab task.

## 2026-09-22 — G13 card title dedupe + hide unverified card ratings

### Context

Verify G13 (“listing name appears twice”) on `/explore` cards with/without photos; remove visible `—` rating on main feed cards when no verified score exists.

### Findings

- `ExploreSlotCard` renders the listing title in **either** the photo overlay **or** the body, not both (mutually exclusive branches).
- Duplicate copy came from **data**: when `event.venue` equals `event.name`, the name appeared in meta/summary and again as the title. Fixed in `eventToSlot` plus `normalizeCardSummary` in `hubSlotToCard`.
- Local browser check: `http://localhost:3000/explore?city=Chicago` remained on “Loading listings…” during spot-check (API/inventory), so live card screenshot verification was not obtained; regression coverage is via unit tests below.

### Goals addressed

- **G13** → Scrum **Complete in code** (workbook row updated).
- Main cards: `cardRatingDisplay` + conditional footer — no em-dash rating placeholder when providers supply no score (see **G10** entry above for full Explore-tab rating removal).

### Verification

- `npx vitest run app/(dashboard)/explore/__tests__`: **16 passed** (5 files), including `explore-card-copy.test.ts`.
- `npx tsc --noEmit`: **0 errors**.

## 2026-09-22 — Explore picks table (audit F32 / G11, UI only)

### Context

User asked to fix the main `/explore` ranking table without API or provider changes: remove highest-rated copy, rating/distance columns, all-in heading, and browser-fetch “updated” line; show six feed-order rows as **Explore picks in [city]**.

### Goals addressed

- `hubSlotsToRanking`: first six `feedSlots` in existing order; place, price, neutral availability (`Check provider` when unknown/editorial/generic).
- `ExploreRankingRow` + `explore.module.css`: three-column layout; row click unchanged; mobile hides price column only.
- `page.tsx`: title **Explore picks in {displayCity}**; no rank numbers or verification claims in this block.
- Scrum book: **G11** → Complete in code (heading); **F32** → Partial (honest table UI; verified relevance ranking and site-wide ratings still open).

### Verification

- `npx vitest run app/(dashboard)/explore/__tests__`: **13 passed** (4 files), including new `hubSlotsToRanking` / `rankingAvailabilityLabel` test.
- `npx tsc --noEmit`: **0 errors**.

### Risks / next action

- **G10** (remove pseudoRating on category pages) and full data-spine ranking remain **not** marked complete.
- Optional: align legacy `explore-hub-data.ts` `buildRanked` payload if any consumer still reads `ranked` tuples.

## 2026-09-22 — Critical batch 1 (truth + discovery wiring)

### Context

Implement first audit Critical items: hide fake success/social fixtures, honest filters/prices, provider handoff, OSM fallback repair, `when` → API dates, zero-match filters, stale-request guard (already in hook).

### Goals addressed

- Truth: removed drawer social fixtures, fake invite/share/split/plan success; invite sheet is explicit “coming soon”; hero pill copy softened; live shortcut no longer claims “starting soon”.
- Discovery: `useExploreHub(when)` passes date range; price chips use numeric `priceKnown` + amount; zero filter match shows empty state (no silent fallback to all slots); ranking by distance not synthetic stars.
- Handoff: `sourceUrl` on places/events → drawer/saved bar `openExploreListingUrl`.
- Backend: `_fetch_osm_places` fixed Overpass tag + httpx client scope; Foursquare/OSM rows include `source` + `url`.

### Verified result

- `npx vitest run app/(dashboard)/explore/__tests__`: 12 passed.
- `npx tsc --noEmit`: 0 errors (post batch).

### Risks / still open (Critical)

- Collection persistence for saves; GPS vs `CITY_COORDS` distance; partial provider failure surfacing; cache timestamp on UI; practical keyword filters; Wayra real planning; keyboard traps on drawer/invite.

### Next action

Critical batch 2: pass hero GPS into fetch scope, propagate cache age, wire Collection save, improve empty/partial error states.

### Later same-day clarification: selected city and remembered location

The working tree gained scoped location selection and a request-sequence guard for hub results after the audit snapshot. [The audit's follow-up section](Explore_Feature_Priority_Audit.md#2026-09-22-follow-up--selected-location-discussion) corrects feature 1 and defines selection precedence, persistence/privacy, URL behavior, hero/feed consistency, and acceptance scenarios. This was read-only analysis plus documentation; the other feature statuses were not re-audited.

## 2026-09-11 — Explore v6 HTML port + global forest-green tokens

### Context

User approved porting `Rovvy Explore v6.dc.html` into production code with global (not page-scoped) forest-green tokens, Instrument Serif + Schibsted Grotesk + JetBrains Mono on all pages, fixture data from the HTML `SLOTS` object, and larger `RovvyLogo` on Explore.

### Goals addressed

- Promote Explore v6 palette to global `:root` tokens (`#0E6E5C` primary, `#FBFAF7` app background, warm muted labels).
- Replace Inter/Outfit/Playfair with Schibsted Grotesk / Instrument Serif / JetBrains Mono site-wide.
- Port full page interactions: chips, Wayra plans, masonry feed, ranking table, city reel, detail drawer, invite sheet, saved bar with party stepper.
- Use HTML fixture inventory (128 Chicago slots, 9 listing cards, 6 ranking rows) for visual verification.

### Verified result

- Global: `frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/tailwind.config.ts`, `frontend/lib/design-tokens.ts`, `frontend/lib/brand.ts`.
- Explore: `page.tsx`, `explore.module.css`, `explore-fixtures.ts`, `components/*` (8 shared components).
- `npx tsc --noEmit`: 0 errors. `vitest run lib/__tests__/design-tokens.test.ts`: 2 passed.

### Risks / limitations

- Fixture data is intentional mock Chicago content from the design file — not live DB inventory.
- `explore-hub-data.ts` / `use-explore-hub.ts` remain in repo but are not wired to the v6 page after this port.

### Next action

When DB caches populate, merge fixture shapes with live API responses while preserving empty/loading honesty.

## 2026-09-22 — Explore v6 hub wired to live events + places APIs

### Context

User requested real data on `/explore` instead of Chicago fixture inventory only (hero location was already live via `/api/hero`).

### Goals addressed

- Reconnect `useExploreHub` + `fetchExploreHub` to the v6 page layout.
- Feed, stats, ranking, Wayra plan matches, and location slot counts from `/explore/events` + `/explore/places` (Ticketmaster cache + OSM venues).
- Remove fake social pulse/friend/broadcast copy; show honest inventory + provider source line.
- Preserve v6 ask/live/invite masonry inserts; destination reel remains editorial until city-scores API is merged.

### Verified result

- `explore-hub-v6-map.ts` maps API slots → v6 cards, ranking rows, Wayra plans, chip filters.
- `page.tsx` uses live payload; `ExploreSavedBar` resolves saved rows from hub lookup.
- `ExploreSlotCard` renders provider `imageUrl` when present.
- `npx tsc --noEmit`: 0 errors.
- `npx vitest run app/(dashboard)/explore/__tests__`: 7 passed.

### Risks / next action

- Friend activity and invite sheet remain UX stubs until social APIs exist.
- Wire destination reel to `nearby_cities` / city-scores; optional auth merge from `/api/v2/explorer/*`.
- Drawer checkout should deep-link to `ticket_url` from event detail endpoint.

## 2026-09-22 — Destination regions (Americas, Europe, Oceania)

### Context

User requested European and Australian/Oceania destinations on the Explore hub, working region pills, carousel scroll arrows, and an all-countries page.

### Verified result

- `explore-destinations.ts` — USA, Canada, Mexico, Europe (10 cities), Oceania (6 cities incl. Australia & NZ).
- `ExploreDestinationsSection` — region tabs, left/right reel controls, Surprise me per region.
- `/explore/destinations` — full directory; city picks navigate to `/explore?city=…`.
- Hub reads `?city=` query to reload inventory; `CITY_COORDS` extended for geo event search.
- Tests: `explore-destinations.test.ts` (2) + existing Explore suite (9 total).

## 2026-09-11 — Explorer v6 design implementation

### Context

Rebuilt the local `/explore` page to match the supplied `Rovvy Explore v6.dc.html` reference. The reference was treated as a visual and interaction specification; its embedded template directives were not executed or copied as application logic.

### Goals addressed

- Establish the warm cream, ink, and emerald visual system from the reference.
- Replace the carousel-led hub with a prompt-first discovery flow focused on tonight, social availability, price clarity, and group coordination.
- Preserve usable Rovvy navigation, authentication gates, detail exploration, and responsive behavior.

### Verified result

- Added a custom responsive Explorer header and removed the shared desktop dashboard header only on the exact `/explore` route.
- Added the prompt composer, date choices, live activity strip, selectable count and vibe chips, expandable filters, Wayra plan response, friend activity, four-column discovery feed, ranking table, destination rail, and group-plan call to action.
- Activity and ranking cards open the existing `ExplorerItemDetailDrawer`.
- Login-gated group actions route authenticated users and show a sign-in message to guests.
- Files affected: `frontend/app/(dashboard)/explore/page.tsx`, `frontend/app/(dashboard)/explore/explore.module.css`, and `frontend/app/(dashboard)/layout.tsx`.

### Verification

- `node node_modules/typescript/bin/tsc --noEmit`: passed with zero errors.
- Focused ESLint on the Explorer page and dashboard layout: zero errors; ten existing warnings remain in the shared layout.
- Live browser QA at `http://localhost:3000/explore`: page rendered, responsive header wrapped at the narrow in-app viewport, full content was exposed to the accessibility tree, `Plan it` opened three Wayra plan options, and `Refine` opened all filter groups.

### Data environment and limitations

The v6 reference contains explicitly mocked Chicago slot counts, social activity, rankings, availability, reviews, and price examples. This implementation preserves that supplied presentation data to match the requested design. It must not be described as live provider inventory. The prior hub-level API-fed carousels were replaced; the dedicated `/explore/events` route remains the path to the existing event experience.

### Next action

Connect the v6 slot, ranking, friend-activity, and Wayra plan shapes to verified Explorer API responses while retaining honest loading, empty, freshness, and provider states. Replace the reference image placeholders only when approved assets or provider images are available.

## 2026-09-11 — Explore hub wired to per-city database APIs

### Context

User rejected mock Chicago slot data on `/explore`. The page must read live inventory from the connected per-city database cache (events + places), not hardcoded template rows.

### Goals addressed

- Remove fake slot, stats, ranking, and social-activity data from the v6 Explore hub.
- Load city-scoped listings from existing backend endpoints.
- Keep v6 visual layout; show honest loading, empty, and source states.

### Verified result

- Added `frontend/app/(dashboard)/explore/explore-hub-data.ts` — fetches `/explore/events`, `/explore/places` (attractions + restaurants), maps to v6 card/table shapes, computes category stats from real rows.
- Added `frontend/app/(dashboard)/explore/use-explore-hub.ts` — city state via `rovvy_explore_city`, reload on city change.
- Updated `frontend/app/(dashboard)/explore/page.tsx` — removed hardcoded slots/stats/ranked/social copy; grid, stats, ranking, and Plan-it matches use API payload; empty state when DB returns zero rows.
- Removed fake pulse/friend/broadcast social rows; data-source bar shows provider labels from response.

### Verification

- `npx tsc --noEmit`: passed with zero errors on explore modules.

### Risks / limitations

- Browse-first `/explore/events` and `/explore/places` depend on backend cache population per city; empty cities show an honest empty state (not placeholders).
- v2 PostGIS `/api/v2/explorer/*` (auth-required) is not yet merged into the v6 hub grid — current feed uses v1 explore cache + places DB.
- Wayra plan panel shows top DB matches by prompt filter, not a full multi-provider stitch yet.

### Next action

Optionally add authenticated v2 nearby/events merge for logged-in users; wire friend-activity only when a real social API exists.

## 2026-09-11 — Responsive navigation correction

### Context

At narrow viewport widths, the Explorer-specific top header and the shared dashboard bottom tab bar were both visible. This duplicated the Explore, Live, and Trips destinations and reduced the usable content area.

### Verified result

- Synchronized the Explorer breakpoint with the dashboard `md` boundary at 768 CSS pixels.
- Below 768px, the Explorer-specific header is hidden and the shared bottom tab bar is the sole primary navigation.
- At 768px and above, the Explorer-specific header remains visible while the shared bottom tab bar remains hidden.

### Verification

- Live browser QA at `http://localhost:3000/explore` in the existing narrow viewport confirmed the page begins with the Explorer hero and exposes only the shared bottom navigation in the accessibility tree.

### Remaining risk

Responsive switching follows the effective CSS viewport, so browser zoom or operating-system scaling can cause a physically large window to use the mobile layout. This is expected responsive-browser behavior.

## 2026-09-15 — Explore auto-location + zip/PIN/city override

### Context

User reported the Explore location sheet felt like it required manual city entry. They wanted automatic exact location on load, with optional worldwide postal code or alternate city search (not limited to US/India).

### Goals addressed

- Auto-request browser geolocation on Explore hero mount; fall back to IP `/api/hero` when GPS is denied or unavailable.
- Replace hardcoded city picker with worldwide backend geocoding search (postcode, city, neighbourhood).
- Global address formatting (state/region/province/country) and search bias from current GPS when available.
- Remove sign-in gate for manual location override; keep optional remember copy for signed-in users.

### Verified result

- `HeroLocationWidget.tsx`: auto GPS → hero, geocoding search via `liveGeocodingSearch`, updated sheet copy/placeholder.
- `explore-hero-location.ts` + vitest (3 tests).
- `npx vitest run app/(dashboard)/explore/__tests__/explore-hero-location.test.ts`: passed.
- `npx tsc --noEmit`: 0 errors.

### Risks / next action

- Geocoding search requires backend on `/api/v1/geocoding/search` (same as Live tab).
- Browser must grant location permission for exact auto-pick; otherwise IP approximate remains.

## 2026-09-11 — Live location hero

### Context

The Explore hero needed location-aware presentation without retaining a user's coordinates or blocking the page's first paint.

### Goals addressed

- Resolve browser coordinates when explicitly supplied, otherwise use an approximate request-IP location.
- Keep Nominatim, Open-Meteo, Wikimedia Commons, and optional Flickr calls on the server.
- Accept only source-geotagged photos within five kilometres, with minimum-width and title filters.
- Keep the location guess visible and correctable through a location sheet.

### Verified result

- Added `GET /api/hero`, which always returns a nullable response shape with a neutral colour fallback and HTTP 200 degradation.
- Added a one-hour in-memory cache shared by normalized city and local hour bucket. The application does not write coordinates, history, or images to the database, filesystem, or object storage.
- Nominatim calls are serialized to one request per second and use `RovvyExploreHero/1.0 (+https://rovvy.app; contact: contact@rovvy.app)`.
- Wikimedia Commons is tried first; `FLICKR_API_KEY` enables the optional server-side fallback.
- The Explore hero now paints a colour immediately, fades in a geo-verified photo, preserves the fixed contrast scrim, displays required attribution, and exposes a glass location card.
- The location sheet allows exact browser geolocation without authentication, treats denied GPS as an approximate IP choice, gates city browsing behind sign-in, and displays the promised location-retention reassurance.

### Verification

- TypeScript: passed with zero errors.
- Focused ESLint: passed with zero errors or warnings.
- Vitest: 10 tests passed across distance-band boundaries, IP fallback, GPS denial, Nominatim failure, rejected photo candidates, unknown location, and a 300-mile no-city case.
- Live API QA: an explicit Uptown coordinate resolved to `Uptown, Chicago`, current weather, and a Wikimedia photo whose source coordinates were inside the five-kilometre radius.
- Live browser QA: the IP fallback resolved to `Mundelein · approximate`; the location card opened the sheet with an unauthenticated disabled city field, inline sign-in prompt, exact-location action, and retention statement.

### Risks and next action

- IP location is approximate and, in local development, reflects the outward-facing development network address.
- Wikimedia quality varies even after geographic, dimension, aspect, and title filtering. Configure Flickr when higher-volume neighbourhood imagery is needed.
- The location card currently receives the Explore page's existing slot count. Replace that input when the broader feed gains a radius-aware live-count contract using `suggestedRadiusMiles`.


## 2026-09-25 — Workbook/code reconciliation audit

Read-only product/code audit requested by the user; no application code or workbook statuses changed.

Workbook snapshot: 76 task rows = 18 gates + 58 capabilities. Complete in code 33, Partial 23, Pending 15, Not started 5 (43 unfinished). Gates: 12 complete / 1 partial / 5 not started. Capabilities: 21 complete / 22 partial / 15 pending. Gate and capability rows overlap; these are task counts, not unique-feature or engineering-effort percentages.

Recorded complete gates: G01 G02 G07 G08 G09 G10 G11 G13 G14 G15 G16 G17.
Recorded complete capabilities: F04 F06 F07 F08 F12 F14 F18 F19 F20 F21 F22 F26 F30 F31 F33 F35 F42 F43 F44 F45 F54.
Partial: G18; F01 F02 F03 F05 F09 F10 F11 F13 F15 F16 F17 F23 F24 F27 F28 F32 F34 F36 F41 F46 F55 F56.
Pending: F25 F29 F37 F38 F39 F40 F47 F48 F49 F50 F51 F52 F53 F57 F58.
Not started: G03 G04 G05 G06 G12.

Reconciliation findings:
- G04 and G05 are stale for the main hub: app/routes/explore.py /places uses ExplorePlaceSpineService, and Overture gers_id reaches slot/card identity through explore-hub-places-overture.ts. These support Complete in code for that scope, not a claim that all other discovery services removed Foursquare.
- F47 is stale: hubSlotToDetail passes imageUrl and ExploreDetailDrawer displays it. Missing URLs show Photo unavailable. Broken remote image handling/browser QA remain distinct checks. This supports code completion for the row's image-URL mapping criterion.
- Counting those three narrow reconciliations gives 36 complete / 40 remaining, a proposed code-review count; workbook remains 33 / 43 until statuses are reconciled. This is not full production certification.
- G06 has GERS-based deduplication implemented; cross-provider crosswalk coverage is not established, so Not started is stale but complete is not established.
- F03/F05 and F15 evidence still refers to the old Foursquare-primary/absent-spine path. Update evidence to Overture hot-index coverage. F15 remains Partial: the current spine mapper does not supply verified hours.

Confirmed defect: both spine SQL SELECTs alias longitude as lon, while map_spine_row_to_explore_place reads lng. A direct mapper reproduction with lat=41.88 and lon=-87.63 returns lng=None. Existing mocked mapping test supplies lng and misses the SQL-to-mapper mismatch. Fix alias/mapping and add a service-result contract regression. Database-computed distance_m is separate and this finding does not imply that distance_m itself is lost.

Other review findings: places query always requests a 100 km radius when coordinates exist; drawer map remains area text plus a dot; drawer dialog has no focus-trap/Escape implementation; savedIds is component state. Drawer uses a CSS background image without load-error fallback. Remaining priorities include location scope/persistence and units (G18/F01/F02/F41), price/currency/group-total semantics (F11/F13/F36), provider paging (F27), verified hours (F15), cold R2 consumer path (G03), z17 map fallback (G12), saved collections/day plans (F34/F25), structured practical filters (F29), and real group functions (F37-F39/F49-F53). Hiding group fixtures does not implement those functions.

Verification this audit: Explore Vitest 107 passed in 18 files; npx tsc --noEmit exited 0. Focused backend invocation covering test_explore_place_spine.py, test_explore_places_hours.py, test_explore_events_endpoint.py and test_explore_cache_freshness.py: 23 passed, 11 failed; failed cases are in the event endpoint file and encountered blocked Supabase access. These are unresolved verification failures, not proven product regressions. No live browser/provider, deployed migration, populated hot index, or R2 runtime verification in this audit. Next action: fix longitude contract first, reconcile stale workbook rows, then complete live location/price/save QA before taking on group features.

## 2026-09-26 — Independent places availability / editorial review

Checked the places route, source-state classification, event inventory filters, masonry mapping and rendered ask-card copy. No application changes or workbook promotion.

Verified in code: unsupported database and spine query failures raise 503; successful queries expose ready/empty; freshness exceptions preserve fetched places. Events survive places failure. Invalid category uses AppException.bad_request (400, not the previously reported 422).

Editorial finding: known generated event markers are filtered before hub mapping/counts; fixture slot rows are replaced with real slots by buildMasonryFeed. Non-slot ask/live templates still enter the masonry. A confirmed misleading fixture remains: ask-rain subtitle is hardcoded to "70% chance at 2 PM · 12 indoor swaps" and ExploreAskCard renders it verbatim. Replace with neutral prompt copy or verified data. This is unsupported promotional copy, not proof of generated event inventory leakage. The reported browser phrase "Overture + editorial cards" cannot itself establish inventory contamination.

Independent checks: tests/test_explore_place_spine.py: 17 passed, 1 skipped (sqlite-only route regression skipped on current Postgres configuration). Frontend explore-hub-fetch-state and explore-g07-f04-no-ai-inventory: 26 passed across 2 files. No live browser proof, full-suite rerun or TypeScript rerun in this review. F34 remains Partial pending its save/refresh/account-isolation/failure-retry browser gates. Next action: remove unsupported ask-rain metrics, then run F34 browser QA.
