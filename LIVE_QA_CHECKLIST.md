# Rovvy Live — QA Checklist

Use this before merging Live map changes or syncing to `main` for frontend deploy.

**Environments**

| Where | URL | Best for |
|---|---|---|
| Local dev | `http://localhost:3000/live` | Fast UI iteration, layer toggles, route preview |
| Production | `https://rovvy.app/live` | Real GPS, phone driving test, HTTPS geolocation |

**Debug helpers (local only)**

Add to `frontend/.env.local` (do not commit):

```env
NEXT_PUBLIC_ROVVY_MAP_DEBUG=true
```

Restart `npm run dev`. Shows GPS status, accuracy (m), lat/lng, and age on the map.

**Automated tests**

```powershell
# Frontend — GPS / route-origin logic
cd frontend
npm test

# Backend — Live routing, taxonomy, Wikipedia
cd ..
.venv\Scripts\python -m pytest tests/test_live_routing.py tests/test_live_search_taxonomy.py tests/test_place_wikipedia.py -q
```

---

## 1. GPS & location

| # | Step | Pass criteria |
|---|---|---|
| 1.1 | Allow location on first visit | Blue GPS dot appears; status `active` or `approximate` in debug HUD |
| 1.2 | Block location in browser settings, reload | Badge shows "Location off" or "Location unavailable"; manual pick sheet available |
| 1.3 | Desktop localhost with location allowed | If accuracy > 150m, route panel shows **"Low GPS accuracy — go outdoors for a better fix."** |
| 1.4 | Accuracy ≤ 150m (phone or DevTools Sensors) | No low-accuracy warning; status `active` |
| 1.5 | Accuracy > 500m | Toast: "Your location may be approximate." (once per session) |
| 1.6 | Click locate when GPS failed | Manual location sheet opens with "Set as starting point" / "Set as destination" |
| 1.7 | **Change start** → pick on map | Route recalculates; low-GPS warning disappears (origin no longer `gps`) |
| 1.8 | Uncertainty ring on map | Visible when accuracy > 20m; capped visually at ~120m radius |

**Chrome DevTools simulation:** DevTools → ⋮ → More tools → **Sensors** → Location → custom lat/lng or preset.

---

## 2. Search & place selection

| # | Step | Pass criteria |
|---|---|---|
| 2.1 | Type in top search bar | Suggestions appear quickly |
| 2.2 | Select a suggestion | Map flies to place; destination pin (coral teardrop ★) with label |
| 2.3 | Category search (e.g. waterfalls) | POI pins appear on map |
| 2.4 | Click map → pick location | Context card + actions (starting point, destination, add stop) |
| 2.5 | Paste Google Maps link | Resolves to correct place |
| 2.6 | Wikipedia / About section | City and summary match the picked location (not a distant name match) |

---

## 3. Route preview

| # | Step | Pass criteria |
|---|---|---|
| 3.1 | Select destination with GPS on | Green/teal **drive** line from start to nearest road |
| 3.1b | Remote trail / forest pin (not on a road) | **Amber dashed foot/hike line** from road end to destination; notice explains drive + walk |
| 3.1c | Foot routing unavailable | Dashed **approximate** walk line still shown (verify on map) |
| 3.2 | Route panel shows ETA bracket | e.g. "West Altgeld Street (3 min)" |
| 3.3 | **From:** line | Shows "Current location" or chosen start |
| 3.4 | Cross-border route (if applicable) | Amber border notice in panel |
| 3.5 | Route fails (bad coords / API down) | Clear error message + retry option |
| 3.6 | **Change destination** | Clears old route; new preview loads |

---

## 4. Go / Solo Live navigation

| # | Step | Pass criteria |
|---|---|---|
| 4.1 | Tap **Go** or **Start Solo Live** | Enters 3D navigation view (pitch ~60°) |
| 4.2 | Route line | **Stays visible** on map (does not disappear after Go) |
| 4.3 | Destination pin | **Stays visible** (coral meet-up marker with label) |
| 4.4 | Navigation overlay | Turn instruction card, ETA bar, END button |
| 4.5 | GPS follow | Map centers on user position during navigation |
| 4.6 | **END** | Returns to 2D; navigation overlay closes |
| 4.7 | Add stop during live | Stop appears in route; preview updates |

---

## 5. Map layers & view

| # | Step | Pass criteria |
|---|---|---|
| 5.1 | Clean Map | Default light style; readable labels |
| 5.2 | Dark | Dark basemap; street labels legible at z15+ |
| 5.3 | Satellite / Terrain / Hybrid | Imagery or hillshade loads |
| 5.4 | **Travel layer** toggle (separate from base layer) | Highways, main roads, rail overlay visible |
| 5.5 | Travel layer OFF | Overlay removed; base layer unchanged |
| 5.6 | Switch layers with active route | Route line **persists** across layer changes |
| 5.7 | Max zoom per layer | Dark ~17.5; Satellite/Terrain ~16.5; Hybrid ~16; Clean+Travel ~16; Clean alone ~14 |
| 5.8 | 2D / 3D toggle (when not navigating) | Pitch changes; route still visible |
| 5.9 | Compass + zoom rocker | Orient and zoom smoothly |
| 5.10 | Fullscreen | Map fills viewport; controls still usable |

---

## 6. Chrome & layout

| # | Step | Pass criteria |
|---|---|---|
| 6.1 | `/live` header | Frosted/translucent; logo + nav readable |
| 6.2 | Search bar | Centered at top; does not overlap nav card |
| 6.3 | Mobile width (~390px) | Panels stack; no horizontal scroll |
| 6.4 | GPS badge bottom-left | Readable; helper popover on failure |

---

## 7. Regression smoke (5 min)

Run after any Live change:

1. Open `/live` → allow location  
2. Search a nearby place → route preview  
3. **Go** → confirm route + destination pin in 3D  
4. Toggle Travel layer ON/OFF  
5. **END** navigation  
6. Block location → confirm manual fallback works  

---

## Sign-off

| Field | Value |
|---|---|
| Tester | |
| Date | |
| Branch / commit | |
| Environment | local / rovvy.app |
| Device | desktop / iPhone / Android |
| Result | Pass / Fail |
| Notes | |
