# Scaper — Ticketmaster bulk Discovery Feed connector (build spec)

Status: **spec only; owner decision 2026-10-12: no 47-state search rollout, build this instead.**
Assigned to Cursor (do not build in the Claude tab unless the owner says so). Rules: `AGENTS.md`.
Replaces the 47-state plan in `Scaper_Ticketmaster_National_Spec.md` (that file's state mode stays
for the AK/TX/CA sources until this connector replaces them).

## 1. Why

One daily file download replaces thousands of search calls. Search-based national coverage meant
~50+ state sources, hours of runtime, and the "scheduled crawl not tied to user actions"
throttling risk in Ticketmaster's terms. The bulk feed is Ticketmaster's own export product:
1 API call to list files, then one S3 download.

## 2. Facts verified (owner 2026-10-12; Claude re-verified the same day with our key)

- Index: `GET https://app.ticketmaster.com/discovery-feed/v2/events?apikey=…` → `countries.{CC}.{JSON,CSV,XML}`; 32 countries.
- US JSON entry: `uri` (S3 `.gz`), `compressed_md5_checksum`, `compressed_size_bytes` (82,164,217 = 82 MB), `num_events` (105,051), `last_updated` (2026-10-12T09:02:52Z). The S3 object supports HTTP range requests; it is gzip, top-level `{"events":[ … ]}`.
- **Own schema, not Discovery v2.** Per event (≈9 KB raw JSON, 105k events ≈ 950 MB uncompressed): `eventId`, `legacyEventId`, `eventName`, `eventInfo`, `pleaseNote`, `eventStatus`, `eventStartDateTime` (UTC), `eventStartLocalDate/Time`, `eventEndDateTime`, `eventImageUrl`, `images[]`, `primaryEventUrl`, `resaleEventUrl`, `officialSeller`, `source`, `classificationSegment/Genre/…`, `attractions[]`, `promoters[]`, `presales[]`, and a flat `venue` object: `venueId`, `venueName`, `venueStreet`, `venueCity`, `venueStateCode`, `venueZipCode`, `venueCountryCode`, `venueLatitude`, `venueLongitude`, `venueTimezone`, `venueUrl`, ADA fields.
- **No price field of any kind** in the feed.
- Sample (first 34,747 events): `eventStatus` onsale 96%, offsale, cancelled, rescheduled, postponed; `source` ticketmaster / ticketweb / universe / tmr / frontgate / other; every event has an image; ~50% have an end time; ~4.5% have no start time (TBD).
- **IDs are shared with Discovery v2:** in the next 60 days, 1,003 of 1,469 sampled feed events in states we already ingest (IL, FL, TX, CA, AK) already exist with the same `eventId` = our `events.external_id`. The 32% unmatched are events outside today's reach (e.g. Skokie, Peoria, Schaumburg). name+start and legacy-id keys added no extra matches. **Cutover will not duplicate events.**
- The feed also carries events far into the future (≈ half the sample starts after 60 days).
- Quota: one index call per run (count it against the 5,000/day).

## 3. Compliance gates (Perplexity review of the Discovery Feed terms, 2026-10-12)

Findings (quotes not re-fetched by Claude):
- **Eligibility is unclear.** Ticketmaster's pages disagree: the Discovery Feed page says "open to the public" with any developer API key; the Developer FAQ says "for our approved partners"; an older Data Feeds page says "authorized clients only". Our key works technically.
- **No feed-specific terms exist.** The General Terms of Use (last updated 2023-06-27) very likely apply, since the Feed is "sourced from the Discovery API" and the FAQ says feed users agree to the Terms of Use.
- **Storing:** only "for reasonable periods in order to provide the service" (undefined). Deleting at event end and re-syncing from each file fits the purpose. No required refresh or deletion schedule; the only deadline is **owner removal within 24 h**. Events dropped from the feed should be hidden or deleted (the feed deliberately excludes events, e.g. release note 2025-10-07), which is what the expiry step in §4.3 does.
- **Refresh:** no limit is stated on how often the file may be downloaded; files refresh about hourly. One download is one request, which fits the terms' rate-limiting language. A file can be up to a day old, so the provider's page is the source of truth for status.
- **Attribution:** none required. Plain-text "Tickets via Ticketmaster" plus the URL is likely fine. **No Ticketmaster logo** (trademarks are not licensed). **Keep feed URLs unchanged**: if we become an affiliate, the feed URLs carry the affiliate tracking.
- **Images:** hot-linking an event's own image is not expressly allowed or banned (only "generic image hosting" is banned). Keep hot-linking; never copy the files.
- **Commercial use:** deriving revenue from the API is barred "except as set forth below", and nothing follows in the published text. The route that permits earning is the **Ticketmaster Affiliate Program on Impact** (affiliates use the Discovery API and Feed). Impact holds the legal agreements and payments, so join once the business is registered or ready to receive payments.
- **Written confirmation:** use the **"Partner with Us"** form (developer.ticketmaster.com/support/contact-us); Ticketmaster says "Do not use the developer support form for partnership inquiries". Typical reply: within 48 hours. The earlier owner email appears to have gone to the wrong channel (no reply).

Gates before the first **live** run: (1) the dry run (no data written) may happen at any time; (2) owner sends the Partner with Us message below and decides whether to wait for the reply or proceed on the "open to the public" page; (3) revenue of any kind from Ticketmaster data waits for Affiliate Program approval.
Same rules as today (`AGENTS.md` §4): hot-link images only; "Tickets via Ticketmaster" text link; purge at event end (+6 h when no end time); 24 h removal with `ingest.blocklist`.

**Partner with Us message (owner pastes into the form):**
```
We are building Rovvy (rovvy.app), a group-planning app that shows local events and sends
users to Ticketmaster to buy tickets. We use the Discovery API today and want to switch to
the Discovery Feed (US JSON, one download per day) instead of thousands of search calls.
Please confirm in writing: (1) our developer account is approved for the Discovery Feed;
(2) we may store events until they end (plus 6 hours when there is no end time), refreshed
from each file, and delete them at the latest 24 hours after an owner removal request;
(3) we may show each event's feed image by linking to Ticketmaster's image URL;
(4) a plain-text "Tickets via Ticketmaster" credit with the unchanged event URL is
acceptable, with no logo; (5) whether joining the Affiliate Program on Impact is the only
route to earn revenue from these listings. We have no ads or subscriptions today.
```

## 4. Design

New connector name `ticketmaster_feed` (kept separate from the per-item pipeline because the unit of work is a file, not an event). Entry point: `python -m scaper feed-load --provider ticketmaster [--country US] [--dry-run] [--force]`, also called from `run-due` (source row `ticketmaster:feed:us`, 24 h interval).

### 4.1 Skip when unchanged
New table `ingest.feed_state(provider, country, last_md5, last_updated, num_events, loaded_at, status)`. After the index call, if `compressed_md5_checksum` and `last_updated` equal the last successful load, record "unchanged" and exit (no download).

### 4.2 Stream, never buffer
HTTP stream → incremental MD5 over the **compressed** bytes → `zlib.decompressobj(16 + MAX_WBITS)` → incremental JSON object parser (the stdlib `JSONDecoder.raw_decode` loop used in Claude's feasibility check; no new dependency) → slim records. No temp file: Cloud Run's writable disk counts against memory (512 Mi). Memory stays bounded to one buffer window.
All database writes happen in **one transaction**, committed only after the MD5 of the full download matches the index. Mismatch or any parse error → rollback, run `failed`, nothing changes.

### 4.3 Staging and set-based load
1. `COPY` slim records into `ingest.tm_feed_staging` (UNLOGGED, truncated at the start of each run): `event_id, legacy_id, title, description, category, start_time, end_time, timezone, status, url, image_url, venue_id, venue_name, venue_street, venue_city, venue_state, venue_zip, lat, lng`. Drop everything else (attractions, presales, ADA, long text beyond 2,000 chars). No raw payload is stored per event: the feed is re-downloadable in one call, which is enough to re-extract.
2. **Reject** (counted per reason, like today): no start time, no coordinates, unmapped status, blocklisted id (`ingest.blocklist` provider `ticketmaster`).
3. **Venues → places**, reusing the existing tiers:
   - set-based join of staging venues to `ingest.place_links (connector='ticketmaster', external_id=venue_id)` (the bulk of rows after the first load);
   - for venues with no link, run the existing tiered matcher (`_match_place`: A1 100 m trigram, A2 250 m name, A3 500 m name+street+postcode, else create a place with `gers_id NULL`) in batches of 500 venues. Expect ~25k distinct venues on the first load, few afterwards.
4. **Upsert events** from staging with `INSERT … ON CONFLICT (provider, external_id) DO UPDATE … WHERE (changed columns) IS DISTINCT FROM …` so unchanged rows are not rewritten. Field mapping (existing `events` columns):

   | events column | feed field |
   |---|---|
   | provider / external_id | `'ticketmaster'` / `eventId` |
   | title / description | `eventName` / `eventInfo` or `pleaseNote` (≤ 2,000 chars) |
   | category | slug of `classificationSegment` (same map as today) |
   | start_time / end_time / timezone | `eventStartDateTime` / `eventEndDateTime` / `venueTimezone` |
   | status | onsale, offsale, rescheduled → `scheduled`; postponed → `postponed`; cancelled → `cancelled` |
   | ticket_url / image_url | `primaryEventUrl` / `eventImageUrl` (hot-linked) |
   | venue_name / venue_place_id / lat / lng / geom | `venueName` / resolved place / `venueLatitude` / `venueLongitude` |
   | city_slug / state_code | `slug(venueCity)` (`scaper/slug.py`) / `venueStateCode` |
   | price_min / price_max / currency / is_free | **NULL** (the feed has no prices; see §9 decision 2) |
   | source_id | the feed source row |
   | expires_at | `COALESCE(end_time, start_time + 6 h)` |

5. **Expire unseen:** after the verified commit conditions, `UPDATE events SET expires_at = now()` for `provider='ticketmaster'` rows not present in staging. **Safety guard:** skip expiry (and flag the run `partial`) if `num_events` fell more than 30% versus the previous successful load.
6. **Purge** past events at event end (+6 h when no end time), same rule as Eventbrite (owner decision 2026-10-12; being implemented in `purge_past_events` by another session, uncommitted at the time of writing).
7. **Dedup:** keep `dedupe_city` (Python) but run it only for cities that had inserted/changed rows, queued in `ingest.dedup_queue(city_slug, queued_at)` and processed after the load commits. If a first load cannot finish within the job timeout, the remaining cities continue on the next hourly execution; duplicates may show briefly in cities not yet processed. Record `deduped` in `ingest.runs`.
8. **Horizon:** config `horizon_days` (default **365**) bounds how far ahead events are loaded; the feed holds ≥ 2 years. Owner can raise it. Estimated DB growth: 105k events × ≈ 2–3 KB with indexes ≈ **+250–350 MB** (DB now 1.48 GB; Supabase Pro includes 8 GB).

### 4.4 Runtime budget (estimates, to be measured in the dry run)
Download 82 MB ≈ 1 min; parse ≈ 1–2 min; COPY ≈ 20 s; venue matching ≈ 3–6 min on the first load; upsert ≈ 1–2 min; dedup first load 10–30 min. Target: a nightly run in minutes and the first load inside the existing 1 h job timeout; if the dry run says otherwise, report before anyone raises the timeout (owner decision).

## 5. Source registry (owner decision 2026-10-12, item 3)

Additive migration `migrations/012_provider_registry.sql` (separate from the feed tables in `013_tm_feed.sql`):

```sql
CREATE TABLE IF NOT EXISTS ingest.provider_registry (
  provider            text PRIMARY KEY,           -- 'ticketmaster', 'eventbrite', …
  display_name        text NOT NULL,
  enabled             boolean NOT NULL DEFAULT false,
  commercial_use      text NOT NULL CHECK (commercial_use IN ('allowed','conditional','not_allowed','unknown')),
  storage_rule        text NOT NULL,              -- human-readable max storage period / purge rule
  retention_after_end interval,                   -- NULL = no rule; '0' = delete at event end
  attribution_text    text,                       -- required label, e.g. 'Tickets via Ticketmaster'
  link_required       boolean NOT NULL DEFAULT false,
  terms_url           text,
  terms_checked_on    date,
  account_owner       text NOT NULL DEFAULT 'owner (personal)',
  notes               text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

Seed (from `AGENTS.md` §4; idempotent `INSERT … ON CONFLICT DO NOTHING`): ticketmaster (enabled, `conditional`: revenue needs written approval, delete at event end + 24 h owner removal, "Tickets via Ticketmaster", link required, terms checked 2026-10-05); eventbrite (enabled, `conditional`: future events only, "View on Eventbrite", crawlable link, no logo); overture (enabled, `allowed`, CDLA Permissive 2.0 credit); wikimedia_commons (enabled, `allowed` per-file license, author + license credit); user_upload (enabled, `allowed`, "Rovvy community photo"); yelp, seatgeek, meetup, bandsintown, instagram (venue-connect only, later), google_places (all `enabled = false`, `not_allowed`/`conditional` with the reason in `notes`). `account_owner` never stores a personal email address (repo is public).
Use in code: the pipeline refuses to run a connector whose provider row is missing or `enabled = false`; `retention_after_end` drives the purge SQL instead of hard-coded intervals.

## 6. Removal and blocklist

`scaper remove --provider ticketmaster --external-id <eventId>` keeps working (event row + blocklist). The feed loader reads `ingest.blocklist` and drops those ids in step 2, so a removed event never returns. Test it.

## 7. Cutover plan

1. Build and test (below). 2. `feed-load --dry-run` (downloads, parses, stages inside a transaction, rolls back) and report: events per state, rejections by reason, match rate against existing IDs, new venues, new places, estimated DB growth, timings. 3. **Owner approval**, then one supervised live run. 4. Verify hub counts and `explore/events` for Chicago, Austin, Anchorage, one new state. 5. Only then disable `ticketmaster:chicago`, `ticketmaster:orlando` and the `ticketmaster:state:*` sources. Their events keep their rows (same `eventId`) and the next feed load re-stamps `source_id`.

## 8. Tests (AGENTS.md §7)

Unit (mock HTTP, no network): index parsing; unchanged → skip; MD5 mismatch aborts without writes; streaming parser over chunk boundaries and gzip splits; field mapping and rejections; status map. Rolled-back Postgres (`SCAPER_PG_TEST_URL`, pattern of `tests/test_scaper_postgres.py`): staging → upsert idempotent (second run updates 0); blocklisted id skipped; expiry guard (−30% → no expiry); expiry restores a reappearing event; purge at end; migrations 012 and 013 apply twice. CI suite stays green (`requirements-ci` environment).

## 9. Open decisions for the owner

1. `horizon_days` default: 365 (proposed) or all?
2. Prices: the feed has none. Proposed: store NULL and show "Price on provider site". (Alternative: keep old Discovery prices until the event ends; they were pre-fee and exist for only ~15% of events, so not recommended.)
3. First-load timeout: accept a first load that may continue over two hourly executions, or raise the job timeout (e.g. 3 h) before the first run?

## 10. Out of scope

Other countries (the index lists 32; only `US` now), search-based state sources (kept until cutover), Eventbrite, frontend changes, pushing to `Production-main`.

## 11. Cursor prompt

```
Read AGENTS.md, then Scram Book/Explorer Tab/Scaper_Ticketmaster_BulkFeed_Spec.md and
implement it. Rules: no production DB write, no push, no new Cloud resources without asking
me; stage only your own hunks (another session may be editing scaper/store.py purge code —
check git status first). Deliver in this order, one commit each: (1) migrations 012 + 013 and
the registry seed; (2) streaming download/MD5/parse + staging + set-based upsert + expiry
guard + feed_state; (3) venue matching batches + dedup queue; (4) CLI feed-load with
--dry-run; (5) tests (unit + rolled-back Postgres) and the dry-run report against the real
feed (the dry run rolls back; ask me before any commit of data). Then apply AGENTS.md §1.
```

## 12. Perplexity prompt (done 2026-10-12 — see §3; kept for reference)

```
Ticketmaster "Discovery Feed" (developer.ticketmaster.com, discovery-feed/v2/events): who
is eligible, and what do the terms say about storing the downloaded event data in our
own database, refresh frequency, how long we may keep it, attribution, commercial use and
removal requests? Does it differ from the Discovery API v2 terms? Quote clauses with links.
```
