# Rovvy — OpenFreeMap light self-host

**Decision:** Use OpenFreeMap **http-host** (not tile-gen) for Live basemap control — vector Clean/Detailed maps, travel overlay, foot routes.

**Date:** 2026-09-14

---

## Why this path

| Problem | Self-host fix |
|---------|----------------|
| CARTO **API KEY REQUIRED** watermark | No CARTO for street/clean when `NEXT_PUBLIC_OPENFREEMAP_BASE_URL` is set |
| Third-party rate limits | Your nginx + CDN serves tiles |
| Mixed tile vendors | One vector stack for Clean, Detailed, Travel, Foot overlays |

**Still external (unchanged):** Esri satellite/terrain/hybrid, OpenRailwayMap travel raster, CARTO Dark (optional, needs `NEXT_PUBLIC_CARTO_API_KEY`).

---

## Server requirements (OpenFreeMap http-host)

Per [OpenFreeMap self-hosting docs](https://github.com/hyperknot/openfreemap/blob/main/docs/self_hosting.md):

| Item | Requirement |
|------|-------------|
| Role | **http-host** only (do not run tile-gen) |
| Disk | ~**300 GB** SSD for full planet Btrfs image |
| OS | Clean **Ubuntu 22+** VM (not Cloud Run) |
| DNS | e.g. `tiles.rovvy.app` → server IP |
| Deploy | Run `./init-server.py http-host-static HOSTNAME` from OpenFreeMap repo (SSH/Fabric) |
| Updates | Weekly planet sync from OpenFreeMap releases (manual or autoupdate cron) |

**Do not** use Cloud Run for tile serving — use a dedicated VM + **Cloud CDN** or nginx cache in front.

---

## Frontend env (Vercel / `frontend/.env.local`)

Set in **frontend** env only (Next.js):

```bash
# Self-hosted OpenFreeMap origin (no trailing slash)
NEXT_PUBLIC_OPENFREEMAP_BASE_URL=https://tiles.rovvy.app

# Optional style names (defaults: liberty = clean, bright = detailed)
# NEXT_PUBLIC_OPENFREEMAP_CLEAN_STYLE=liberty
# NEXT_PUBLIC_OPENFREEMAP_STREET_STYLE=bright

# Force vector basemap without self-host URL (uses public tiles.openfreemap.org)
# NEXT_PUBLIC_LIVE_BASEMAP=openfreemap

# Optional — only if you keep CARTO Dark / raster Detailed
# NEXT_PUBLIC_CARTO_API_KEY=your_carto_free_key
```

When `NEXT_PUBLIC_OPENFREEMAP_BASE_URL` is set:

- **Clean Map** → `{base}/styles/liberty`
- **Detailed Map** → `{base}/styles/bright`
- **Travel / Foot overlays** → `{base}/planet/{z}/{x}/{y}.pbf`
- **Dark** → falls back to Clean unless `NEXT_PUBLIC_CARTO_API_KEY` is set
- **Night auto-dark** → disabled without CARTO key

---

## Deploy checklist

1. Provision Ubuntu VM (GCP Compute Engine e2-standard-2 or larger + 300 GB disk).
2. Point DNS `tiles.rovvy.app` to VM.
3. Clone [hyperknot/openfreemap](https://github.com/hyperknot/openfreemap); follow `docs/self_hosting.md`.
4. First run with `SKIP_PLANET=true` (Monaco test), verify `https://tiles.rovvy.app/styles/liberty` in browser.
5. Full deploy `SKIP_PLANET=false` (planet download — hours).
6. Enable HTTPS (Let's Encrypt via their nginx setup).
7. Set Vercel env `NEXT_PUBLIC_OPENFREEMAP_BASE_URL=https://tiles.rovvy.app`.
8. Redeploy frontend; open `/live` → Layers → Clean Map → confirm no CARTO watermark.

---

## Code touchpoints

| File | Role |
|------|------|
| `frontend/lib/map-providers.ts` | URL resolvers, basemap mode, CARTO key append |
| `frontend/lib/live-foot-routes.ts` | Vector tile URL |
| `frontend/app/(dashboard)/live/live-map-layer-preference.ts` | Safe night default |
| `frontend/app/(dashboard)/live/live-map-attribution.ts` | Credits when vector primary |

Tests: `frontend/lib/__tests__/map-providers-openfreemap.test.ts`, `live-map-layer-preference.test.ts`.

---

## Risks

- **300 GB + ops** — not zero-cost; cheaper than full tile-gen, heavier than CARTO free key.
- **Style JSON** from self-host must reference your domain (OpenFreeMap http-host handles this).
- **Satellite/hybrid** still Esri — commercial terms review before scale.
- **Public OpenFreeMap** remains valid fallback when env unset.

---

## Next action

1. Provision VM + run http-host quick test (`SKIP_PLANET=true`).
2. Set Vercel env and redeploy frontend.
3. Browser QA `/live` all layers + travel/foot overlays against self-hosted origin.
