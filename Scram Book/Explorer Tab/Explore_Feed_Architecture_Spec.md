# Explore feed — architecture spec (one location, one server pipeline)

Status: **approved for design by owner 2026-10-09; implementation not started.** Supersedes
the per-section location patches in `Explore_Feed_Phase1_Spec.md` items 1–2 (Phase 1
ranking/label rules stay valid but move server-side). Rules: `AGENTS.md`.

## 1. Problem (as found 2026-10-09)

Explore is a dynamic page — content differs per person and per location — but today each
section decides "where am I" on its own, in the browser:

| Section (`page.tsx`) | Location it uses today |
|---|---|
| Hero badge | GPS, else IP guess (`explore-hero-location.ts`) |
| Places (Overture) | hero coordinates, else hard-coded `CITY_COORDS[city]` (`explore-hub-data.ts`) |
| Events (Scaper) | nearest hard-coded "Scaper metro" by city name (`explore-scaper-metro.ts`) |
| Destination carousel | sets its own scope on click (`scopeFromCatalogSelection`) |
| Headings / counts | two different fallback chains: `explore-hub-data.ts:587` vs `page.tsx:180` |

Results: header and sections disagree (owner saw "Explore picks in Austin" above Chicago
events), city names are hard-coded, the browser makes 4+ requests and merges/ranks
~140 rows itself, and every fix so far patched one section.

## 2. Principles

1. **One location per visit**, resolved once, shared by every section.
2. **Server builds the feed** from the database; the browser only renders.
3. **The server returns the label it used**; all text on the page comes from that label.
4. **Geography, not city names**: queries use coordinates + radius, never hard-coded city
   lists (no `CITY_COORDS`, no metro mapping).
5. **Honest empty**: if an area has no data, say so for that area (F15) — never silently
   show another city.

## 3. Location resolution

Browser collects only the raw signal and sends it; it never invents a label.

| Priority | Source (`source=`) | What the browser sends |
|---|---|---|
| 1 | `pick` — user searched or picked a place/destination | lat, lng (+ the place's display name as `label_hint`) |
| 2 | `gps` — permission granted | lat, lng, accuracy |
| 3 | `ip` — approximate | nothing (server derives from request IP) or the existing IP lookup result |
| 4 | `default` | nothing → server default area |

A `pick` wins until the user clears it (stored per device, existing preference rules).

Server resolves: `{lat, lng, radius_m, label, source, precision}`. `label` = `label_hint` for
picks; otherwise the dominant locality of nearby Overture places (no extra geocoding call),
cached per ~1 km cell.

## 4. Endpoint contract

`GET /api/v1/explore/feed` (auth optional — browse-first; signed-in users get saved/plan
signals in Phase 2)

Query: `lat`, `lng`, `source`, `label_hint?`, `radius_m?` (default and max set server-side),
`date_from?`, `date_to?`, `category?`, `vibe?`, `cursor?`, `limit` (default 24, max 48).

Response (sketch):

```json
{
  "location": {"lat": 41.77, "lng": -88.15, "label": "Naperville", "source": "ip",
               "precision": "approximate", "radius_m": 40000},
  "counts": {"total": 137, "events": 41, "places": 96,
             "by_day": {"2026-10-09": 31}, "by_category": {"Food & drink": 51}},
  "items": [{"kind": "event", "id": "scaper:…", "title": "…", "start": "…",
             "venue": {"name": "…", "address": "…", "lat": 0, "lng": 0},
             "distance_m": 2100, "image": {"url": "…", "credit": null},
             "price": {"label": "Price on provider site", "is_free": false},
             "reason": "Tonight", "provider_link": {"label": "Tickets via Ticketmaster", "url": "…"}}],
  "next_cursor": "opaque",
  "sources": ["Ticketmaster", "Eventbrite", "Overture"],
  "freshness": {"events_fetched_at": "…"}
}
```

Every user-visible fact in an item must map to a stored field (F15); `reason` only from
real data (Phase 1 rules).

## 5. Server pipeline (`app/services/explore_feed_service.py`, route stays thin)

1. Resolve location (§3).
2. **Places**: Overture KNN within radius (existing fast query in
   `explore_place_spine_service.py`) + approved `place_media`.
3. **Events**: `public.events` by **geometry** within radius (`ST_DWithin(geom, point, r)`,
   existing `idx_events_geom`) using the shared visibility CTE
   (`scaper_event_visibility.py`: status, expiry, one row per dedup group). No city slug.
4. Merge → quality filter (chains, misfiled categories, city-centroid rows) → photo-first →
   provider interleave per day (F27) → reason labels → keyset/opaque cursor.
5. Counts computed on the same filtered set (so header numbers match the grid).
6. Cache per (≈1 km cell, date window, filters) for 5 minutes.

Targets: one request per page load; server p95 < 1.5 s for a cold cell, < 200 ms cached.

## 6. Frontend

- One hook `useExploreFeed(location)`; every section in `page.tsx` (hero badge, stats,
  vibes, masonry, ranking, Wayra answer, empty/error states) renders from its result.
- Destination carousel and location search only **set the location** (source `pick`) →
  refetch; they never fetch data themselves.
- Remove `CITY_COORDS`, `explore-scaper-metro.ts`, and client-side merge/rank/scope
  filtering once the endpoint is live.

## 7. Migration (no big-bang)

1. Build the endpoint + service + tests; old `/explore/events` and `/explore/places` stay.
2. Frontend behind a flag: new hook renders the same sections.
3. Owner browser check (GPS, IP, picked city, a city with no data); then remove old paths.

## 8. Acceptance

- Header, headings, counts and cards always show the same area label.
- A Naperville user (by coordinates) gets Chicago-area events because they are within the
  radius — with no city mapping table.
- Picking Austin shows Austin data, or an honest "no listings near Austin yet".
- Exactly one feed request per load/scroll page; no client-side ranking.
- Tests: service unit tests (mocked DB), rolled-back Postgres test for the geo queries,
  route tests (200/401-optional/422), Vitest for the hook, browser check.

## 9. Open decisions (owner)

1. Default radius: events and places the same (proposed 40 km) or places tighter (15 km)?
2. Unsigned users: store a `pick` on the device only (proposed), or not at all?
