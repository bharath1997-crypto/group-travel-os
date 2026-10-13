# Photo sources inventory (read-only audit)

**Date:** 2026-10-12  
**Scope:** Supabase Postgres, cloud object storage, repo files, legacy scripts, Explore UI.  
**Rules:** AGENTS.md §4 + Scram Book G08 — no stock/Pexels/Unsplash on inventory; free-licence Wikimedia + credited partner hot-links + moderated user uploads only.

---

## Executive summary

Rovvy **does not** have a large unused **place photo dataset** sitting in another database table. The live Overture `places` table (~1.88M rows) has **no** `photos[]`, **no** `photo_url`, and **no** legacy backup table on this Supabase project. The **only** approved place-photo store in production use is **`public.place_media`** (465 rows: Wikimedia + Ticketmaster hot-links). There **is** legacy **event** imagery in `public.explore_events` (~10k rows, almost all **Unsplash** — **not** usable for places under §4). **`unified_experiences`** holds **203 SeatGeek** image URLs (product decision: SeatGeek not used; licence/terms **needs-check**). Cloud: **Supabase Storage** is empty; **GCS** buckets are CI/deploy only; **R2** credentials incomplete in `.env` (could not list `rovvy-place-media`). **`app/scripts/enrich_photos.py`** targets an **obsolete OSM-era `places` schema** and must not be run on current Postgres.

---

## 1. Supabase (SELECT-only)

Connection: project Postgres via `DATABASE_URL` (credentials not recorded here). Queries used `SET statement_timeout = '300s'` where needed.

### 1a. Tables/views with photo-like columns (public / ingest / storage / extensions)

| Table | Rows | Column | Non-null | Notes |
|--------|------|--------|----------|--------|
| `public.places` | 1,883,344 | `photos` (text[]) | 0 | Overture spine; no embedded photo URLs |
| `public.places` | | `booking_url` | 0 | |
| `public.place_media` | 465 | `thumbnail_url`, `storage_url` | 465 each | **Primary place photo index** |
| `public.events` (Scaper) | 4,548 | `image_url` | 4,548 | **Event** posters, not place spine |
| `public.events` | | `ticket_url` | 4,548 | |
| `public.explore_events` | 10,128 | `image_url` | 10,128 | Legacy editorial table |
| `public.explore_events` | | `booking_url` | 10,128 | |
| `public.explore_contents` | 275 | `image_url`, `ticket_url` | 0 | |
| `public.unified_experiences` | 2,246 | `image_url` | 203 | Mostly SeatGeek hosts |
| `public.destinations` | 0 | `image_url` | 0 | |
| `public.imported_shorts` | 0 | `thumbnail_url`, `url` | 0 | |
| `public.users` | 70 | `avatar_url`, `cover_url`, `profile_picture` | 2 / 1 / 2 | Profile only |
| `public.event_providers` | 2,310 | `provider_url` | 2,310 | Not place photos |
| `ingest.*` | — | — | — | **No** columns matching photo/image/thumb/media in `ingest` schema |
| `storage.buckets` | 0 buckets | — | — | Supabase Storage unused |
| `storage.objects` | 0 objects | — | — | |

*(Other public tables matched the regex only for generic `*_url` fields — booking, receipts, cart — not place inventory.)*

### 1b. Legacy OSM / backup tables

| Object | Present? | Notes |
|--------|----------|--------|
| `places_legacy_explorer` | **No** | `scripts/04_load.py` can rename pre-Overture table at load time; not on this DB |
| `places_old`, `places_osm`, `places_backup` | **No** | |
| Any table with `photo_url` column | **No** | `enrich_photos.py` target columns **do not exist** on current `places` |
| `places.osm_id` | **No** | Current `places` is Overture (`gers_id`), not OSM row shape |

### 1c. Overture `places.photos`

| Metric | Value |
|--------|--------|
| Rows with non-empty `photos` | **0** |
| Sample | *(none)* |

### 1d. `place_media`

| source | moderation_status | count |
|--------|-------------------|------:|
| `open_license` | approved | 455 |
| `licensed_partner` | approved | 10 |
| `rovvy_user` | — | 0 |
| pending | — | 0 |

Thumbnail URL hosts (top): `thumb.wikimedia.org` (406), `upload.wikimedia.org` (49), `s1.ticketm.net` (10).

### 1e. Other candidates — image URLs and hosts

| Table | Non-null `image_url` | Top hosts | Usable for Explore places (§4) |
|--------|----------------------|-----------|--------------------------------|
| `public.events` | 4,548 | `s1.ticketm.net`, `i.ticketweb.com`, `images.universe.com`, `img.evbuc.com` | **Events only** (provider hot-links); not place spine |
| `public.explore_events` | 10,128 | **`images.unsplash.com` (10,080)**, `encrypted-tbn0.gstatic.com` (47) | **No** — stock/editorial legacy; not place-specific |
| `public.unified_experiences` | 203 | **`seatgeekimages.com` (203)** | **No / needs-check** — SeatGeek not approved (AGENTS.md §4); do not surface without legal review |
| `public.explore_contents` | 0 | — | — |
| `public.destinations` | 0 | — | — |
| `public.place_registry` | 0 rows | No image columns | Empty registry |

### 1f. Supabase `storage` schema

| Finding | Detail |
|---------|--------|
| Schema exists | Yes |
| Buckets | **0** |
| Objects | **0** |
| Usable photo archive | **No** |

---

## 2. Cloud storage (list-only)

### Google Cloud (`project: group-travel-os`)

| Bucket | Purpose | Place photos? |
|--------|---------|----------------|
| `group-travel-os_cloudbuild` | Cloud Build source tarballs | **No** |
| `run-sources-group-travel-os-asia-south1` | Cloud Run source staging | **No** |
| `run-sources-group-travel-os-us-west1` | Cloud Run source staging (Scaper job region) | **No** |

No user-media or photo-dataset buckets found.

### Cloudflare R2

| Check | Result |
|--------|--------|
| `R2_ACCOUNT_ID` | **NOT SET** in root `.env` |
| `R2_BUCKET_NAME` / `R2_PUBLIC_BASE_URL` | **NOT SET** |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | SET (values not printed) |
| List `rovvy-place-media` | **Skipped** — incomplete R2 endpoint config in this checkout |

Production user-upload path is designed for R2 (`place_photo_upload_service`); **no objects verified** from this audit.

### Firebase Storage

| Item | Value |
|------|--------|
| `firebase-credentials.json` `project_id` | `group-travel-os` |
| Storage bucket in service account JSON | *(not set in file)* |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | **NOT SET** in root `.env` |
| Firebase used for | RTDB (Live/ephemeral), not verified as photo store |

Object listing not attempted (no bucket name in env / credentials).

---

## 3. Repo / local files

| Location | Content | Photo dataset? |
|----------|---------|----------------|
| `data/enrich/wikidata_*.csv` | Wikidata entity metadata (QID, labels, coords) | **No** — enrichment input, not images |
| `data/enrich/unmatched_*.csv` | Match reject logs | **No** |
| `data/airports.csv`, `data/wayra_knowledge_seed.json`, `data/live_search_taxonomy.json` | Non-photo product data | **No** |
| `data/place_media_uploads/` | Dev upload staging (`place_photo_upload_service`) | **Missing** in this checkout |
| `outputs/`, `handoff/` | No photo dumps found | **No** |
| `brand/`, `frontend/public/brand/` | Official PNG logos | **Brand only**, not place inventory |

No csv/json/parquet/zip photo corpora found in repo roots searched.

---

## 4. `app/scripts/enrich_photos.py` (legacy)

| Aspect | Detail |
|--------|--------|
| Intent | Waterfall: Wikimedia → Mapillary → **Pexels** → **Unsplash** → writes `places.photo_url` / `photo_source` |
| Target schema | OSM-era `places` (`osm_id`, `tags->wikidata`, `category`, `photo_url`) |
| Exists on Supabase today? | **No** — `photo_url`, `photo_source`, `osm_id` absent; tier SQL would fail or no-op |
| API keys (names only) | `PEXELS_API_KEY`: **SET**; `MAPILLARY_TOKEN`: **SET**; `UNSPLASH_ACCESS_KEY`: **NOT SET** |
| Usable under §4? | **No** — Pexels/Unsplash tiers violate G08; use `scripts/07_enrich_wikimedia_photos.py` + `place_media` instead |

---

## 5. Frontend stock images (`explore-place-images.ts` / `ExploreCardImage`)

| Surface | Uses `getPlaceImage` / Unsplash lists? | Behavior |
|---------|----------------------------------------|----------|
| **Main `/explore` hub** (`ExploreSlotCard`) | **No** | Shows `slot.imageUrl` only; text card if missing |
| **Explore detail drawer** | **No** | Real `imageUrl` + credit; no stock fallback |
| **`/explore/event/[id]`** | `ExploreCardImage` with `fallbackMode="unknown"` | Provider event image or **“Photo unavailable”** — **not** Unsplash |
| **Category subpages** (`/explore/food`, `/explore/events`, …) | `ExploreCategoryEventCard` | Real events: `fallbackMode="unknown"`. **Placeholders only:** `fallbackMode="category"` → **Unsplash** via `getPlaceImage` |
| **Production `/explore` browser check (2026-10-12)** | Page load observed | Hub uses slot cards; no stock module on main feed path in code |

**Conclusion:** Stock Unsplash art is **confined to category-carousel placeholders**, not the main Explore listings feed or drawer. It must stay off inventory surfaces (G08).

---

## 6. Other photo-related assets

| Finding | Where | Usable §4? |
|---------|--------|------------|
| Scaper `public.events.image_url` | Ticketmaster/Eventbrite CDN | **Yes for events** (hot-link, provider terms) |
| Ticketmaster **venue** images in ingest payloads | Resolved into `place_media` (`licensed_partner`) | **Yes** (hot-link, attribution) |
| Wikimedia via `place_media` | `open_license` | **Yes** (author + licence) |
| `explore_events` Unsplash URLs | DB only | **No** for product display |
| SeatGeek images in `unified_experiences` | DB | **No** until policy/licence cleared |
| Mapillary / Pexels keys present | `.env` | **Not approved** for Explore inventory without separate product decision |

---

## Recommendations

1. **Do not hunt a “second place photo database”** — it is not on Supabase. Invest in **`place_media` + Wikidata/Commons pipeline** (`05`/`07`) and **Ticketmaster venue** hot-links for linked venues.
2. **Treat `explore_events` and `unified_experiences` image columns as legacy/toxic for places** — especially 10k Unsplash URLs; do not wire them into Explore place cards without a purge and legal review.
3. **Keep `enrich_photos.py` retired** or gate it behind an explicit migration; it does not match the Overture schema and violates §4 on tiers 3–4.
4. **Configure R2 in production** (`R2_ACCOUNT_ID`, bucket name, public base URL) before user uploads; Supabase Storage is not in use.
5. **Coverage gap is volume, not hidden storage:** ~465 place photos vs ~1.88M `gers_id` rows — continue metro Wikidata/Commons enrichment and Scaper venue backfill; avoid stock fill-ins.

---

## F47 status

Explore place photo work remains **Partial** until browser QA confirms Milwaukee/Chicago feed credits after enrichment (separate from this inventory).
