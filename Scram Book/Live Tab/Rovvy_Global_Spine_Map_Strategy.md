# Global POI coverage with `gers_id` — infrastructure & economics

**Date:** 2026-09-19  
**Status:** Approved direction (scale path); launch still **metro-first** under **$15–20/mo** cap.

Global coverage changes cost and build effort depending on **Overlay PMTiles** vs **Basemap mutation**. Rovvy rejects planet basemap mutation at current budget.

---

## Strategy 1 — Global overlay PMTiles (recommended at scale)

Extract Overture / `places` spine into **country or regional** `.pmtiles` on **Cloudflare R2**. Do **not** mutate OpenFreeMap planet tiles. Basemap stays **public OpenFreeMap CDN** ($0).

### Monthly run-rate: ~$35–80 / month

| Component | Sizing | Monthly |
| --- | --- | --- |
| **R2 storage** | ~60M POIs, minimal schema (`gers_id`, `name`, `category`) → ~15–25 GB vector tiles @ $0.015/GB | **< $0.50** (10 GB free tier helps early) |
| **R2 requests / egress** | Egress $0; Class B reads ~$0.36/M | **~$0–5** |
| **Supabase Postgres** | **If** full ~60M enriched rows live in PG: ~30–50 GB disk, Pro + extra disk + compute (Small/Medium) | **~$35–75** |
| **Basemap** | Public OpenFreeMap | **$0** |
| **Total** | | **~$35–80** |

**Cost lever (engineering):** Map-facing global POIs can live **only in PMTiles** (pick → `gers_id` → spine API). Postgres can hold **enriched subset** (launch cities, `depth_tier > 0`) until budget allows a global warehouse—or use a separate cold store for bulk spine rows. That split can lower PG line item vs loading all 60M enriched columns in Supabase.

### Build & pipeline: ~3–5 weeks (after metro pilot)

| Workstream | Effort |
| --- | --- |
| Overture global Parquet extraction (DuckDB/Spark on S3/Azure; per-country GeoJSON/FlatGeobuf) | 4–6 days |
| Tippecanoe cluster build (z12–z16 global slice; one-time VM ~$15–30) | 3–5 days |
| Live MapLibre **viewport regional PMTiles** selector (not one 25 GB file) | 3–5 days |
| Monthly Overture resync → R2 (Actions or batch) | 3–5 days |

**Already shipped (app):** `readSpineGersId` on feature tags; `GET /places/spine/{gers_id}`; **nearest-spine** ~50 m when tiles lack id.

---

## Strategy 2 — Mutating global basemap (planet POI enrichment)

Self-host planet OpenFreeMap/OSM tiles and conflate every POI with `gers_id` in the basemap.

### Monthly run-rate: ~$120–300+ / month

- Planet tile host VM: 500 GB–1 TB NVMe, ~$80–150/mo  
- Large PostGIS warehouse for OSM ↔ Overture conflation: $100+/mo  
- CDN / cache for basemap bandwidth  

### Build: ~8–14 weeks

Conflation engine, custom Planetiler/Tilemaker, high churn on OSM/schema updates.

**Decision:** **Out of scope** until revenue and dedicated infra owner.

---

## Budget tiers (Rovvy)

| Phase | Monthly cap | Scope |
| --- | --- | --- |
| **Launch** | **$15–20** | One metro in Postgres + optional regional PMTiles; public basemap; nearest-spine; **no** tile VM |
| **Global map picks** | **$35–80** | Strategy 1 — regional/country PMTiles on R2 + Supabase tier sized to chosen PG strategy |
| **Planet basemap** | **$120+** | Strategy 2 — not planned |

---

## Recommended transition

1. **Chicago (or launch bbox)** — validate overlay + spine + panel under **$15–20**.  
2. **Country-by-country PMTiles** — DuckDB extract → tippecanoe → R2 when budget moves to **$35–80**.  
3. **Viewport tile loader** on `/live` before loading multiple country files.  
4. Keep **nearest-spine** as fallback for non-spine OSM taps.

---

## References

- `data-spine.md` §8 (launch budget)  
- `Rovvy_OpenFreeMap_Self_Host.md` (http-host deferred under launch cap)  
- Nearest spine: `PlaceSpineService.get_nearest`, `GET /places/spine/near`
