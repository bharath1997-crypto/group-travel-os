# Rovvy Data Spine — build guide (Overture-first)

Layer 1 of the Wayra answer pipeline: base place rows, free, commercially licensed,
no account required.

**Decision:** Overture Places is the primary and only required source for v1.
Foursquare OS Places is demoted to an optional later enrichment pass.
Rationale in §7.

---

## 1. Get data running today

No account. No token. No approval queue.

### Easiest — the CLI

```bash
pip install overturemaps

overturemaps download \
  --bbox=-87.94,41.64,-87.52,42.03 \
  -f geojson \
  --type=place \
  -o chicago-places.geojson
```

Swap the bbox for your launch city. Format `minlon,minlat,maxlon,maxlat`.
Handles anonymous S3 access for you — this is the path to use if DuckDB
complains about credentials.

### Or DuckDB, if you want SQL

```sql
INSTALL httpfs; INSTALL spatial;
LOAD httpfs; LOAD spatial;
SET s3_region = 'us-west-2';

CREATE TABLE raw AS
SELECT id,
       names.primary        AS name,
       confidence,
       categories.primary   AS category,
       categories.alternate AS alt_categories,
       websites, socials, phones, emails, brand,
       addresses,
       ST_X(ST_GeomFromWKB(geometry)) AS lon,
       ST_Y(ST_GeomFromWKB(geometry)) AS lat
FROM read_parquet(
  's3://overturemaps-us-west-2/release/<version>/theme=places/type=place/*',
  hive_partitioning = 1)
WHERE bbox.xmin BETWEEN -87.94 AND -87.52
  AND bbox.ymin BETWEEN  41.64 AND  42.03;
```

`<version>` is a dated release string (e.g. `2026-03-18.0`).
Get the current one from overturemaps.org/download.

**License:** CDLA Permissive 2.0 + Apache 2.0. Commercial use fine.
The Places theme contains no OpenStreetMap data, so none of ODbL's
share-alike obligations apply. Attribution only — see §9.

---

## 2. Pipeline — three stages

Was five with Foursquare. Conflation and token rotation both disappear.

### Stage 1 — pull bbox
Above. ~40k rows for a major metro.

### Stage 2 — filter to going-out categories

The single most important step. Turns a data dump into a product.

```sql
CREATE TABLE places AS SELECT * FROM raw
WHERE category SIMILAR TO
  '%(restaurant|bar|cafe|coffee|brewery|winery|pub|music_venue'
  || '|park|museum|gallery|bowling|karaoke|night_club|theatre'
  || '|arcade|mini_golf|beach|comedy)%'
AND confidence >= 0.5;
```

Expect ~8k rows. Tune the `confidence` floor against your real distribution
(see §3) — 0.5 is a starting guess, not a finding.

### Stage 3 — land in Postgres

```sql
CREATE EXTENSION postgis;
CREATE EXTENSION pg_trgm;

CREATE TABLE places (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gers_id         text UNIQUE,          -- Overture id. Join key for re-sync.
  name            text NOT NULL,
  geog            geography(Point,4326) NOT NULL,
  basic_category  text,
  confidence      real,
  website         text,
  phone           text,
  instagram       text,                 -- extracted from socials[]
  address         jsonb,

  -- Rovvy-only. No dataset on earth carries these.
  group_capacity  int,
  price_per_head  numeric,
  split_friendly  boolean,
  notice_needed   interval,
  fit_confirmed   int DEFAULT 0,
  booking_url     text,
  photos          text[],
  enriched_at     timestamptz,
  claimed_by      uuid
);

CREATE INDEX ON places USING GIST (geog);
CREATE INDEX ON places USING GIN (name gin_trgm_ops);
CREATE INDEX ON places (basic_category);
CREATE INDEX ON places (group_capacity) WHERE group_capacity IS NOT NULL;
CREATE INDEX ON places (instagram) WHERE instagram IS NOT NULL;
```

Keep `gers_id` forever. GERS is the reference system Meta, TomTom and Esri all
key off, so next month's release refreshes names and coordinates without
touching a single hand-enriched field:

```sql
UPDATE places p SET name = n.name, geog = n.geog, confidence = n.confidence
FROM new_release n WHERE p.gers_id = n.id;
-- enriched_at, group_capacity, price_per_head etc. untouched
```

---

## 3. Verify against real numbers before finalising

Run these four on your local extract. They decide the schema, not guesses.

```sql
-- 1. socials fill rate — decides whether IG pre-linking is viable
SELECT count(*) FILTER (WHERE socials IS NOT NULL) * 100.0 / count(*)
  AS pct_with_socials FROM places;

-- 2. confidence distribution — sets the real cutoff
SELECT width_bucket(confidence,0,1,10) AS bucket, count(*)
FROM raw GROUP BY 1 ORDER BY 1;

-- 3. row count after category filter — is one city enough
SELECT count(*) FROM places;

-- 4. phone fill rate — decides operator-claim verification method
SELECT count(*) FILTER (WHERE phones IS NOT NULL) * 100.0 / count(*)
  AS pct_with_phone FROM places;
```

Thresholds to act on:

| Check | If low | Do this |
|---|---|---|
| `socials` < 20% | IG pre-link weak | paste-in stays fully manual match |
| rows < 4,000 | city too thin | widen bbox or add a second metro |
| `phones` < 50% | claim verify breaks | add email fallback to claim flow |

---

## 4. The Instagram advantage

Overture carries a `socials` array. Foursquare does not. This directly serves
Rovvy's acquisition wedge.

Extract at import:

```sql
UPDATE places SET instagram = (
  SELECT s FROM unnest(socials) s WHERE s LIKE '%instagram.com%' LIMIT 1
);
```

Effect: when a user pastes an Instagram link, you match on the handle instead of
fuzzy-matching a caption to a place name. Paste resolves instantly and correctly.

### Hard boundary — do not cross

**Safe:**
- User pastes a link they chose → resolve public embed data for that **single**
  URL → extract tagged location → match to an existing row. User-initiated,
  human-volume.
- Instagram Graph API for accounts that **authorize** Rovvy (venues, creators).
- LLM parses caption text → place name + cues. Parsing only, never fetching.

**Never:**
- A background crawler, at any volume, in any form.

Reason is commercial as much as legal: automated scraping violates Meta ToS,
gets IPs and accounts banned, and produces a dataset you cannot prove rights
to — which means you cannot raise money on it.

---

## 5. Fields no free dataset carries

| Field | Source | Cost |
|---|---|---|
| Accurate hours | operator claim page | $0, slow |
| Price per head | manual for top 300, then user receipts | your time |
| Group capacity | post-trip "did 6 fit?" tap | $0 — **the moat** |
| Split-friendly | post-trip tap | $0 — **the moat** |
| Notice needed | operator claim | $0 |
| Booking availability | affiliate API (OpenTable / Resy) | rev-share |
| Photos | user uploads + paste-in resolves | $0 |
| Wait times | deferred — needs density you won't have year one | later |

### Enrich the top 300 by hand

```sql
SELECT id, name, phone, website, instagram
FROM places
WHERE enriched_at IS NULL
ORDER BY search_demand DESC   -- from your own query logs
LIMIT 300;
```

~10 min each, ~50 hours total. No shortcut exists. This is the step that makes
the product feel alive. Nobody notices a thin tail in month one; everybody
notices a wrong closing time.

### Freshness contract

Stale fields are **hidden**, not shown. Wayra says nothing rather than
something wrong.

| Field | Window |
|---|---|
| `hours` | 90 days |
| `price_per_head` | 180 days |
| `group_capacity` | never expires |
| `name`, `geog`, `confidence` | monthly re-sync |

---

## 6. Operator claim — four fields, not forty

1. **They find themselves.** Venue searches its own name, sees an unclaimed
   listing with a quiet "is this you?" line. No cold outreach.
2. **One-tap proof.** Verify against the `phone` already on the row — call or
   SMS code. Email fallback if phone fill rate is low (§3).
3. **Four fields only:** hours, largest table that seats together, whether they
   split the check, how much notice for a group. Every one is something Wayra
   will say out loud.
4. **Show the payoff.** After claiming: how many groups viewed them, average
   party size, how many were turned away by a blank capacity field. That number
   brings them back to keep it current.

Forty fields never get filled in. Four do.

---

## 7. Why Overture over Foursquare

| | Overture Places | Foursquare OS |
|---|---|---|
| Rows | 61M | 100M |
| Auth | **none** | portal token |
| License | CDLA Perm 2.0 | Apache 2.0 |
| Ship obligation | attribution line | full NOTICE.txt in bundle |
| Per-row confidence | **yes** | no |
| Socials / Instagram | **yes** | no |
| Closure signal | via confidence | `date_closed` |
| Category precision | ~2,300 OPC | check-in-derived, sharper |
| Stable join ID | **GERS** (industry standard) | fsq_place_id |

Four reasons:

1. **`socials` carries Instagram handles.** Serves the acquisition wedge
   directly. Foursquare has no equivalent. This alone decides it.
2. **Per-row confidence makes single-source viable.** Two-source conflation was
   the most fragile stage in the pipeline — it disappears entirely.
3. **Foursquare already changed access once** (public S3 deprecated → portal).
   Done with notice, but it proves access terms are theirs to tighten. Overture
   is a Linux Foundation consortium whose own members consume it in production.
4. **GERS is the ID everyone else uses.** Any commercial data you license later
   joins on it.

**For an unincorporated developer specifically:** Overture has no counterparty.
No portal, no account, no terms accepted in your personal name, nothing to
migrate when you do incorporate. Fewer agreements signed personally = less
personal exposure.

### Foursquare as an optional later pass

Keep the registration. Its real edges — check-in-derived category precision and
a clean `date_closed` flag — matter at 50,000 rows across 20 cities, not 8,000
in one. You are hand-verifying the top 300, so for every place that matters you
*are* the category corrector and the closure detector.

Revisit at 3+ cities, when hand-enrichment stops scaling.

**If you want to fix the Foursquare connection anyway:** the public S3 bucket is
dead, so `read_parquet` against it silently returns nothing. The portal route is
an **Iceberg catalog** and needs PyIceberg, Spark, or DuckDB *with the iceberg
extension* — use the connection snippet the portal itself provides, verbatim.
The Hugging Face route is separately gated and may still be pending approval.
Stuck: os-places@foursquare.com.

---

## 8. Map stack + cost

| Role | Pick | Why |
|---|---|---|
| Tiles | Protomaps PMTiles on R2/S3 | one file, no per-load billing |
| Renderer | MapLibre GL (BSD) | forked pre-proprietary, no fees |
| Search | own Postgres + trigram | 8k rows beats any hosted API |
| Geocode | trigram on `name` | typo tolerance free |
| Routing | hand off to OS maps | deferred per Status Report |

| Item | Monthly (budget) |
|---|---|
| Overture Places | $0 |
| Postgres + PostGIS (Supabase; incl. **database size / compute tier** bumps for spine) | **within approved cap** |
| Map tiles (PMTiles on R2 — spine overlay only, no planet VM) | **within approved cap** |
| Object storage, photos | defer or fold into same cap at launch |
| Dedicated OpenFreeMap http-host VM (~300 GB) | **$0 until revenue** — out of cap |
| Routing | deferred |
| **Approved monthly ceiling (hosting + DB resize)** | **USD $15–20** |

**Product decision (2026-09-19):** $15–20/month is approved for **hosting footprint + Postgres storage/compute modifications** for the data spine. Stay on **public/dev vector basemap** + **regional PMTiles** from `places`; do **not** provision `tiles.rovvy.app` planet http-host while under this cap.

**Global scale (same date):** Full-planet `gers_id` via **regional overlay PMTiles on R2** is the approved scale path (~**$35–80/mo**, ~**3–5 weeks** pipeline after metro pilot). **Planet basemap mutation** is rejected (~**$120–300+/mo**, ~**8–14 weeks**). Detail: `Scram Book/Live Tab/Rovvy_Global_Spine_Map_Strategy.md`.

Plus ~50 hours one-time manual enrichment (labor, not infra).

---

## 9. Attribution to ship

In app credits / `/legal/data`:

```
Place data © Overture Maps Foundation, overturemaps.org,
licensed under CDLA Permissive 2.0.
```

That's the whole obligation. If you later add Foursquare, you must additionally
ship the Apache 2.0 License text and preserve their `NOTICE.txt` verbatim in
the repo and the built bundle.

---

## 10. Three things that void the dataset

1. A background Instagram crawler — any volume, any form.
2. Mixing Overture's **Transportation** theme into `places`. That theme is
   OSM-derived and ODbL; its share-alike obligations would spread to your whole
   database. The **Places** theme is clean — that is why it's safe.
3. Adding Foursquare later and dropping its `NOTICE.txt`.

Each one individually turns shippable data into data you cannot raise money on.

---

## The one-line version

Base rows are free and commoditised. Three hundred places enriched by hand, and
one field — *did six actually fit* — is the entire difference between Rovvy and
a worse Google Maps.
