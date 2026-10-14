# Explore place facts: OpenStreetMap tags + Wikipedia/Wikidata descriptions (spec)

Status: **spec only (2026-10-14)**. Cursor builds it. Owner approval recorded in chat 2026-10-14 ("ok").
Rule base: `AGENTS.md` §4 (provider-stated facts only, F15; per-feed approval; budget cap).

## 1. Why

Google's Explore results combine many kinds of sources; we cannot crawl or buy most of them.
Two free, openly licensed sources fill the biggest visible gap (bare place cards with no
description, hours or contact facts) without any crawler, key or cost.

## 2. Current state (read-only DB check 2026-10-14)

- `public.places`: 1,883,615 rows (Overture); Chicago 38,242.
- Already present: `website` 1,396,309, `phone` 1,546,315, `wikidata_qid` 6,796, `short_description` column exists.
- Missing: opening hours, wheelchair access, a real description for most places.
- Photos from Wikimedia Commons already use `wikidata_qid` (`scripts/07_enrich_wikimedia_photos.py`).

## 3. Source A: Wikipedia / Wikidata / Wikivoyage descriptions

- Input: the 6,796 places that already have `wikidata_qid` (landmarks, museums, parks).
- Fetch: Wikidata `wbgetentities` (label, `description`, sitelinks) then the Wikipedia REST
  `page/summary/{title}` extract (first paragraph, plain text). Wikivoyage extract optional.
- License: Wikipedia text is **CC BY-SA 4.0**. Store the extract, the article URL, the license
  name and "Wikipedia" credit. Show "From Wikipedia" with a link on the drawer. Never present as Rovvy-written.
- Store: a new `place_facts` table (no change to `places`), see §5.
- Cache/refresh: re-fetch a place at most every 90 days; honor Wikimedia's User-Agent policy
  (contact `rovvy230@gmail.com`), max 5 requests/second, serial.
- Truncate display to the first paragraph; keep the full stored extract.

## 4. Source B: OpenStreetMap tags (opening hours, wheelchair, website, phone)

- Source: OSM data via a **bounded extract** (Geofabrik regional PBF or Overpass for a city bbox),
  never per-place live calls from the UI.
- License: **ODbL**. Show "© OpenStreetMap contributors" on any card/drawer that shows an OSM fact;
  keep derived data in its own table (ODbL share-alike applies to the database, not the app).
  Do not merge OSM rows into the Overture `places` rows.
- Matching: only link when an OSM object is within 50 m and its normalized name equals the place name
  (or shares a wikidata/website tag). No fuzzy guesses; unknown stays unknown.
- Facts kept: `opening_hours` (raw string, parsed only if valid with a tested parser; otherwise show nothing),
  `wheelchair` (yes/limited/no), `website`, `phone`, `cuisine`. Show the **raw provider value**; do not infer
  "open now" unless the parsed hours are valid and the timezone is known.
- Pilot: Chicago only first, then report match rate before any other city.

## 5. Data model (needs owner approval to apply: production DB)

Migration `NNN_place_facts.sql` (next free number; applied manually after approval):

```
public.place_facts(
  id uuid pk default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  source text not null check (source in ('wikipedia','osm')),
  key text not null,            -- 'extract','opening_hours','wheelchair',...
  value text not null,
  source_url text,
  license text not null,        -- 'CC BY-SA 4.0' | 'ODbL'
  attribution text not null,    -- 'Wikipedia' | '© OpenStreetMap contributors'
  fetched_at timestamptz not null default now(),
  unique (place_id, source, key)
)
```

Not destructive. Add an index on `place_id`.

## 6. API and UI

- Place detail endpoint adds `facts: [{key, value, source, source_url, license, attribution}]`.
- Drawer shows description (with "From Wikipedia" + link), hours, wheelchair, and the OSM credit line.
- Cards show nothing new. No ratings, no "open now" unless §4 conditions hold.
- `frontend/lib/api.ts` and `auth.ts` are not modified.
- `/legal/data` page lists Wikipedia and OpenStreetMap with licenses.

## 7. Tests

- Mock all HTTP. Wikipedia: extract mapping, missing page, disambiguation page skipped, attribution stored.
- OSM: match accepted at 30 m + equal name; rejected at 80 m or different name; invalid `opening_hours`
  stored raw but not parsed; ODbL credit present in the API output.
- Endpoint: success, unknown place, facts empty when none (no invented text).
- DB tests inside rolled-back transactions (`SCAPER_PG_TEST_URL`).

## 8. Rollout

1. Cursor builds with `--dry-run` that prints counts and 20 samples, writing nothing.
2. Owner approves the migration and a Chicago run (production write).
3. Report: places with a description, places with hours, match rate, any rejected rows.
4. Next cities only after the Chicago report.

## 9. Cost

Zero API cost. One-time download for OSM (a regional extract, a few hundred MB) and a few minutes of compute.
Storage is small (about 7k descriptions plus OSM facts for matched places).

## 10. Open owner decisions

- Region source for OSM: Geofabrik extract (recommended) or Overpass.
- Whether Wikipedia text may replace `places.short_description` (recommended: no; keep in `place_facts` with credit).

## 11. Cursor prompt (copy as is)

```
TASK F50 — Place facts: Wikipedia descriptions + OSM hours (Chicago pilot)
Read first: AGENTS.md, Scram Book/Explorer Tab/Explore_Place_Facts_Spec.md and README.md.
Run `graphify query "place detail endpoint"` before grepping.
Build only what the spec says: migration file (do NOT apply it), a fetch script with --dry-run
(Wikipedia/Wikidata for places with wikidata_qid; OSM extract matching per §4), the facts field on the
place detail endpoint, the drawer display with credits, /legal/data entries, and tests per §7.
Do not touch frontend/lib/api.ts or auth.ts. Do not write to the production DB. Do not push.
Provider-stated facts only; unknown stays unknown. Stage only your own hunks.
Record per AGENTS.md §1 (workbook F50 row, Context Log, README entry, graphify update .).
```
