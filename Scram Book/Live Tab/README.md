# Live Tab — Scram Book

Authoritative planning and activity record for the Rovvy Live tab (`/live`).

## Artifacts

| File | Description |
|------|-------------|
| [Rovvy_Live_Scrum_Book.xlsx](./Rovvy_Live_Scrum_Book.xlsx) | Live feature, UI and graphics inventory in the Explorer tracker format; status, importance, difficulty, evidence, criticality rationale and acceptance actions |
| [Rovvy_Live_Tab_Technical_Documentation.md](./Rovvy_Live_Tab_Technical_Documentation.md) | Full technical reference (~1,400 lines): architecture, UI panels, state machine, APIs, file inventory |
| [Rovvy_Live_v2_Design_Review.md](./Rovvy_Live_v2_Design_Review.md) | Claude v2 mockup review, gap analysis, phased integration plan |
| [Rovvy_Live_v3_Design_Review.md](./Rovvy_Live_v3_Design_Review.md) | **Approved** v3 target + Phase A implementation notes |
| [Rovvy_OpenFreeMap_Self_Host.md](./Rovvy_OpenFreeMap_Self_Host.md) | Light self-host plan — OpenFreeMap http-host + frontend env wiring |
| [Rovvy_Global_Spine_Map_Strategy.md](./Rovvy_Global_Spine_Map_Strategy.md) | Global `gers_id` economics — overlay PMTiles vs basemap mutation; budget tiers |
| [design/Rovvy_Live_v2_reference.html](./design/Rovvy_Live_v2_reference.html) | Interactive design reference (Setup · Vote · Converge · Arrival · Reports) |

## Activity log

### 2026-09-25 — Live gap audit and first Critical navigation fix

- **Context:** The user challenged the first inventory's completeness and authorized starting Critical fixes after a gap check. The existing 312-item workbook and current Live source were reviewed without resetting other worktree changes.
- **Goals addressed:** Add separately assessable controls omitted from the Live inventory; remove misleading navigation claims seen in the sampled Solo Live session.
- **Result:** Added 20 distinct rows for the map-point popup, local clock and timezone fallback, compact trip HUD, and cross-border notices. The workbook now has **332 unique items**: **109 Critical, 174 Important, 49 Later**; **129 Complete in code, 194 Partial, 9 Pending**. Existing filters, table, dropdowns and summary formulas were extended. The Review tab and navigation row evidence now reflect the partial fix.
- **Navigation change:** The Solo overlay and active panel use route-provider duration and distance when a route exists. The overlay labels distance as the full route, identifies the turn banner as a route preview, and no longer fabricates a 0.1-mile next-turn distance or lane arrows. The first maneuver is explicitly labelled as the first route step, not the current live turn. This addresses the contradictory `0 m LEFT`/`0.1 MI` presentation; it does **not** implement moving GPS progress or a live arrival estimate.
- **Verification:** Targeted navigation Vitest suite: **4 passed**. Frontend `tsc --noEmit`: passed. Workbook reopened with 332 unique IDs, table range `A6:K338`, extended validation ranges, and no error cells. Graphify update completed after code changes. No post-fix moving-GPS or device browser scenario was performed.
- **Unresolved risks:** Turn-by-turn progress, next-maneuver distance, and remaining-time recalculation still require route-matched GPS. Discovery overlay reliability and toast-only parking/arrival/nudge outcomes remain Critical. The initial sample also lacked authenticated multi-user and provider verification.
- **Next action:** Implement GPS-linked route progress and truthful action persistence; reproduce and fix discovery-layer failure with an explicit retry/empty state. Verify these in browser and mobile devices before marking their Partial rows complete.

### 2026-09-24 — Live feature inventory and criticality review

- **Context:** User requested inspection of `http://localhost:3000/live` and an Excel inventory following the Explorer-page review approach. The first 104-row pass grouped too many controls together; user requested at least 250 feature-level items, so the workbook was rebuilt at finer granularity.
- **Goals addressed:** Catalogue visible features, UI extensions and graphical functions; distinguish implementation status from importance and difficulty; provide evidence and actionable feedback in the actual Live Scram Book workbook.
- **Result:** `Rovvy_Live_Scrum_Book.xlsx` contains **312 unique review items** in `Live Tasks` and a `Review` tab with scope, rating definitions, findings and next actions. Importance: **103 Critical, 162 Important, 47 Later**. Status: **118 Complete in code, 185 Partial, 9 Pending**. Each row has a distinct control, display, action or behavior with its own acceptance check. Rows can be parts of the same user journey; counts are review items, not effort or production readiness percentages. Complete in code does not imply production QA. Explorer-style filters, status/importance/difficulty dropdowns and color conventions are included.
- **Browser verification:** Map rendered; setup and layers menus inspected; 15 discovery category options observed; Coffee nearby returned 12 list results and matching numbered pins; selected place opened Guide/About/Info tabs; Drive route reached ready state; Start directions entered Solo Live and END returned to destination state; report modal displayed its six choices. No report, invitation, nudge, seat join or payment was submitted, and no credentials or precise GPS permission were provided.
- **Important findings:** Parks & capitals showed `layer unavailable · try again`; Solo Live displayed `0 m LEFT` with a `0.1 MI` turn distance and a one-minute ETA; navigation code uses distance estimates and generated lane hints. Parking, nudge and arrival actions include toast-only callbacks. Place-details Put to vote / Invite remain coming-soon callbacks despite separate trip-aware group integrations. Setup sign-in copy and the route-start entry behaved differently. Place enrichment changed the sampled title while a category field retained its preview value. These are review findings, not fixes.
- **Workbook verification:** Recalculated and inspected summary formulas; counts matched independently read rows; no formula errors found in the artifact scan. Saved XLSX reopened with 312 unique, fully populated inventory IDs, two sheets, a filtered table, three dropdown validations, frozen headers and expected cached counts. Rendered task, evidence and review ranges visually checked for readable layout. Source paths were checked for every detailed row; two Wayra rows reference `frontend/components/ai/AIAssistantSidecar.tsx` outside the Live folder.
- **Unresolved risks:** Real moving-GPS navigation, full responsive/accessibility coverage, every layer rendering, authenticated multi-user group/convoy behavior, provider freshness and durable expense operations remain unverified. No unit/integration suite or production deployment was performed. No application code changed; graph update was not needed for this documentation-only review.
- **Next action:** Fix navigation accuracy and truthful action outcomes first, investigate the discovery-layer failure, then verify authenticated group/seat workflows and responsive accessibility before expanding graphical features.

### 2026-09-20 — Zoom-tier capitals (national → province → district)

- **Context:** User asked for capital identification like state capitals, then province/district capitals as map zoom increases.
- **Goals:** OSM `capital=*` levels; filter discovery pins by zoom; place preview labels (National / State / Province / District / Municipality capital).
- **Result:** `live_capital_level.py` + `live-capital-level.ts`; layer filter + cache bucket by zoom; taxonomy queries for `capital=2|4|6|8`; Nominatim `extratags.capital` merged into preview tags.
- **Zoom tiers:** z&lt;10 national only; z10–11 + state/province; z12–13 + district; z14+ municipality + town halls/capitol buildings.
- **Verification:** pytest `test_live_capital_level` + taxonomy mirror; vitest `live-capital-level.test.ts` (2026-09-20).

### 2026-09-20 — Discovery layer: national parks + capitals defaults

- **Context:** User could not see parks/capitols on rural US viewport; asked to add **parks** and **capital buildings** to the discovery layer.
- **Goals:** Taxonomy `capitals` OSM queries; default layer cats include `national_parks` + `capitals`; pin labels/icons for government seats.
- **Result:** `capitals` key in `live_search_taxonomy.json` (town halls, `building=government`, `capital=yes`, admin cities); `LIVE_LAYER_DEFAULT_CATS` / frontend `DEFAULT_CATS` → `parks,national_parks,capitals,historic_sites,monuments,viewpoints`; normalize_tags for Capitol / State capital / Government building; layers chip label **Parks & capitals**.
- **Verification:** pytest taxonomy mirror + live_search_taxonomy + live_map_layer — passed (2026-09-20 session).
- **Risks:** Rural centers still sparse in OSM; capitol pins appear when within Overpass radius (~viewport), not whole-state at low zoom.
- **Next action:** Pan to Topeka/Lincoln/Denver at z≥8 with layer on; confirm teal circles + toast count.

### 2026-09-20 — Historic / scenic taxonomy + Parks & landmarks map layer

- **Context:** User prompt — Google-style category tagging via taxonomy (A) and viewport layer toggle (B); no basemap mutation; Wikipedia Pass 2 deferred until Wikidata enrich lands.
- **Goals:** New taxonomy keys; `landmarks` union alias; server Overpass proxy; MapLibre discovery pins with spine merge; session toggle z≥14.
- **Result:** `historic_sites`, `monuments`, `scenic_drives` in `live_search_taxonomy.json` (mirrored to `data/` + `test_taxonomy_mirror.py`); `GET /api/v1/live/layer`; `LiveMapLayerService` (snapped bbox cache 7d, 120 cap, spine nearest 50 m); Live layers panel **Parks & landmarks** toggle; cluster + symbol layer under vote pins.
- **Verification:** pytest taxonomy mirror + live_search_taxonomy + live_map_layer — 16 passed; vitest bbox — 2 passed; `npx tsc --noEmit` — 0 errors (2026-09-20).
- **Next action:** Browser QA at z15 — toggle, pan, tap spine vs OSM-only pin; confirm `historic` / `ruins` / `overlook` search.

### 2026-09-19 — Global spine map strategy (overlay vs planet basemap)

- **Context:** User documented global POI + `gers_id` infrastructure options and cost bands.
- **Goals:** Lock scale path; keep $15–20 launch cap; defer planet tile VM.
- **Result:** `Rovvy_Global_Spine_Map_Strategy.md` — Strategy 1 overlay **~$35–80/mo**, **3–5 weeks**; Strategy 2 basemap mutation **~$120–300+/mo**, **8–14 weeks**, rejected; transition = metro pilot → country PMTiles on R2; optional split (global ids in tiles, enriched rows subset in Postgres).
- **Next action:** Implement Chicago/regional overlay pilot under launch cap when requested.

### 2026-09-19 — Spine + map hosting budget ($15–20 / month)

- **Context:** User approved a monthly cap for **hosting + Postgres database size / tier modifications** while building Overture spine + map `gers_id` strategy.
- **Goals:** Align cost docs and tile strategy with budget; avoid silent spend on planet tile VM.
- **Result:** `data-spine.md` §8 updated — **USD $15–20** ceiling; **PMTiles overlay + Supabase spine** in cap; **300 GB OpenFreeMap http-host deferred**; `Rovvy_OpenFreeMap_Self_Host.md` budget gate note added.
- **Implication for engineering:** Prefer **nearest-spine API** (shipped) + **regional PMTiles from `places`** over basemap planet enrichment or dedicated `tiles.rovvy.app` VM until budget grows.
- **Next action:** Size Supabase disk/compute against row count; quote R2 PMTiles for launch bbox; keep tile VM out of scope.

### 2026-09-19 — Postgres `places` spine not visible on Live map (diagnosis)

- **Context:** User loaded Overture / country / detailed fields into Postgres (`places` data spine) and expected them on the Live map and Info/Guide/About tabs.
- **Goals:** Explain why enriched rows do not appear as map features or panel content.
- **Result (code review, no product change yet):**
  - Live basemap is **OpenFreeMap/OSM vector tiles** — it does **not** plot Postgres `places` rows. There is **no** “all DB places” GeoJSON layer on `/live`.
  - Enriched content loads only via **`GET /api/v1/places/spine/{gers_id}`** when the pick carries a **hex Overture `gers_id`** (16+ hex). Dev/public tiles usually **lack `gers_id` on POI features**, so picks get `local:…` ids and **`LivePlacePanelHost` skips the spine fetch**.
  - Map tap calls `selectDestination(..., { showPlacePanel: false })` — user sees the **route summary bar** first; **Guide/About/Info** (including **Country** in Info) appear only after **Open details** or the dock **Place** stage (`showPlaceDetailsPanel`).
  - **Info tab country/state** comes from **Nominatim reverse geocode** on `selectedPlace` (`getPlaceLocationFields`), not from Postgres. The spine schema/API has **no separate country column** — only `address` jsonb, `city_slug`, descriptions, photos, etc.
- **Verification:** Confirmed wiring in `LivePageClient.tsx`, `live-place-spine-seed.ts`, `LivePlacePanelHost.tsx`, `PlacePanelLiveChrome.tsx`, `place_spine_service.py`, `migrations/001_places.sql`.
- **Risks:** Custom Rovvy vector tiles with `gers_id` on POI layers are still required for tap-to-spine without a nearest-place lookup.
- **Next action (pick one):** (2) re-open PlacePanel on POI tap; (3) viewport map layer for `depth_tier > 0`; (4) Overture-enriched tile worker.

### 2026-09-19 — Nearest spine lookup (~50 m) for map picks without gers_id

- **Context:** Postgres `places` rows only loaded when tap carried hex Overture `gers_id`; public/dev tiles use OSM picks with `local:…` ids.
- **Goals:** Bind map lat/lng to nearest spine row within ~50 m when tile `gers_id` is missing.
- **Result:** `PlaceSpineService.get_nearest` + `GET /api/v1/places/spine/near?lat=&lng=&radius_meters=` (default 50, max 500); `fetchPlaceSpineNear` + `LivePlacePanelHost` falls back after non-hex seed ids.
- **Verification:** `pytest tests/test_place_spine.py` — 7 passed; vitest `live-place-spine.test.ts` — 3 passed (2026-09-19).
- **Risks:** Wrong POI if two spine rows within 50 m (nearest wins); 404 is silent (no enriched panel). User still must open **Place details** after tap.
- **Next action:** Browser QA — tap POI near a known DB row, Open details, confirm photos/description load.

### 2026-09-19 — Localhost vector basemap fallback (Clean / Detailed white screen)

- **Context:** On `localhost:3000/live`, selecting **Clean** or **Detailed Map** showed a white canvas or left the previous **Hybrid** imagery visible while the layer chip showed Clean. Console: `Failed to fetch https://tiles.rovvy.app/styles/liberty` (Rovvy worker DNS unreachable on dev machine).
- **Goals:** Vector basemaps and `.pbf` overlays must load on local dev; layer switch must match rendered tiles; fix Hybrid road overlay MapLibre `line-width` zoom expression errors.
- **Result:** `resolveOpenFreeMap*ForLiveMap()` + `rewriteRovvyTileWorkerRequestUrl()` in `map-providers.ts` (public `tiles.openfreemap.org` on localhost when default is Rovvy worker); Live map `transformRequest` rewrite; hybrid casing widths use `casingZoomWidth` stops; foot routes use live vector URL resolver.
- **Verification:** vitest `map-providers-localhost-tiles`, `map-providers-openfreemap`, `live-openfreemap-tile-fallback` — 9 passed; `npx tsc --noEmit` — 0 errors (2026-09-19).
- **Risks:** Production `rovvy.app` still uses `tiles.rovvy.app` when env unset; explicit `NEXT_PUBLIC_OPENFREEMAP_BASE_URL` on localhost pointing at Rovvy still falls back to public CDN via rewrite.
- **Next action:** Hard refresh `/live`, switch Clean ↔ Hybrid ↔ Detailed and confirm vector labels render within ~2s.

### 2026-09-19 — Dark basemap disabled (product gate)

- **Context:** User requested Dark layer off until needed — harsh chrome/tiles and auto-night selection caused confusion.
- **Goals:** Hide Dark from map picker; no auto-night dark; migrate saved `dark` preference to Detailed Map.
- **Result:** `LIVE_MAP_DARK_LAYER_ENABLED = false` in `live-map-layer-preference.ts`; `LiveMapLayerControl` filters options; `coerceSelectableLiveMapLayer` on load/save/change.
- **Verification:** vitest `live-map-layer-preference.test.ts` updated; run frontend tests before ship.
- **Next action:** Set `LIVE_MAP_DARK_LAYER_ENABLED = true` when product re-enables Dark.

### 2026-09-19 — Dev vector map 15–25s load (LAN / Tailscale hosts)

- **Context:** Clean/Detailed still took 15–25s; dev server often opened via LAN IP (e.g. `100.x`) not `localhost`, so Rovvy worker DNS still timed out before fallback.
- **Goals:** Never wait on `tiles.rovvy.app` in `next dev`; prefetch OpenFreeMap styles; faster layer switch timers.
- **Result:** `shouldUsePublicOpenFreeMapTileFallback()` when `NODE_ENV === 'development'`; `live-map-style-prefetch.ts` + preconnect from `live-page-loader`; style switch verify 400ms / force-finish 1400ms (was 1200/2800).
- **Verification:** vitest map-providers-localhost-tiles + live-map-style-prefetch + style-switch — 7 passed; `npx tsc --noEmit` — 0 errors (2026-09-19).
- **Risks:** First `/live` visit still pays webpack compile for large Live chunk (separate from tile DNS).
- **Next action:** Time Clean layer after hard refresh on both `localhost:3000` and LAN URL; expect vector paint &lt;5s after map mounts.

### 2026-09-17 — PlacePanel design alignment (1c tier 2 + mobile phone sheet)

- **Context:** User supplied tier-2 Estereo mock (1c) and mobile Jaisalmer thin-preview sheet as the authoritative PlacePanel designs.
- **Goals:** Match tier-2 panel chrome (section labels, category · neighborhood, bookmark Add to plan, review layout, white surface, photo grid); restore mobile thin-preview sheet (empty photo hero, Put to vote, Who's going, Guide/About/Info tabs, travel footer) inside PlacePanel when map-crop / no group data.
- **Result:** `PlacePanelLiveChrome.tsx` + `use-place-wiki-summary.ts`; `buildCategorySubtitle` / `shouldShowLivePreviewChrome` in `place-panel-display.ts`; tier-2 fixture updated to Estereo acceptance case; LivePageClient passes live chrome props through `LivePlacePanelHost`.
- **Verification:** vitest live folder — 196 passed; `npx tsc --noEmit` — 0 errors (2026-09-17).
- **Risks:** Mobile sheet re-combines setup actions hidden from left dock while preview is open — intentional per design; tier-1 rows with description still use Estereo scroll layout on mobile (not phone sheet).
- **Next action:** Browser diff against supplied PNGs on 390px + 384px desktop.

### 2026-09-17 — PlacePanel correction pass (replace PlacePreviewCard)

- **Context:** `/live` still rendered `PlacePreviewCard` for OSM picks; map taps selected roads (`highway=secondary`); card mixed route-setup UI with place preview.
- **Goals:** POI-only map picks; every pick → `PlacePanel`; delete `PlacePreviewCard`; hoist travel mode / who's going / start-direction to setup dock; desktop scroll + pinned CTA/footer; Rovvy tile worker basemap attribution.
- **Result:** `live-map-poi-pick.ts` filters interactive layers; street tap closes panel; `placePreviewToPlaceSeed()` for all picks (spine fetch only when hex `gers_id`); deleted `PlacePreviewCard.tsx`, `PlacePreviewMedia.tsx`, `LivePlacePreviewV3Sections.tsx`; `LiveSetupPanel` owns vehicle preference + route footer actions; `PlacePanel` desktop `max-height` + middle scroll; default vector basemap origin `https://tiles.rovvy.app` (OSM attribution only when self-hosted).
- **Verification:** `vitest` live folder — 193 passed; `vitest` map-providers-openfreemap — 4 passed; `npx tsc --noEmit` — 0 errors (2026-09-17).
- **Risks:** Rovvy tile worker must serve vector styles + raster `/t/{z}/{x}/{y}` in dev; POI layer ids vary by style — `getPlacePickLayerIds` may need tuning per style JSON.
- **Next action:** Browser QA — tap street vs POI vs tier-0/2 places; diff 384px panel against `export/place-panel-1*.png`.

### 2026-09-17 — PlacePanel + spine detail API + Live wiring

- **Context:** Handoff option 1c — one depth-aware panel; map crop must use Rovvy tile Worker (not OSM); rendering driven by field presence, `depth_tier` only for footer provenance.
- **Goals:** Fix tile source; `GET /api/v1/places/spine/{gers_id}`; wire `/live` when map feature carries `gers_id`; two-pass seed + detail fetch.
- **Result:** `place-panel-map-tile.ts` → `https://tiles.rovvy.app/t/{z}/{x}/{y}` (override via `NEXT_PUBLIC_ROVVY_TILE_URL`); `place-panel-display.ts` inverted to presence-based sections/CTAs; backend `PlaceSpineService` + route; `LivePlacePanelHost` swaps in when `extractPlaceSpineSeed(selectedPlace)` is non-null; legacy `PlacePreviewCard` kept for OSM-only picks.
- **Verification:** `pytest tests/test_place_spine.py` — 4 passed; vitest place-panel + spine-seed + map-tile — 14 passed; `npx tsc --noEmit` — 0 errors (2026-09-17).
- **Risks:** Overture map layer must emit `tags.gers_id` on tap for panel to activate; hours/group_tags/reviews/booking fields not in Postgres yet (API returns nulls); tile Worker must serve raster `/t/{z}/{x}/{y}` with `cache-control: max-age=604800`.
- **Next action:** Overture pin layer on Live map; export 1c PNG for visual diff; set `NEXT_PUBLIC_ROVVY_TILE_URL` + `NEXT_PUBLIC_PHOTOS_BASE_URL` in Vercel when R2 buckets live.

### 2026-09-16 — Greenland / remote land reverse geocode hardening

- **Context:** User tapped Greenland (~65.44°N, 44.69°W); search bar showed stale **Arctic Ocean** while the preview card stayed **Dropped pin** with coordinates only.
- **Root cause:** Nominatim reverse was rate-limited (HTTP 429) → backend returned `{}`; stale session tap cache skipped re-geocode; ocean basin map labels mislabeled land before reverse completed.
- **Goals:** Resolve Greenland with country/territory hierarchy; never cache ocean basin names for land taps; recover when geocoder is down.
- **Result:** Backend retry on 429/503 + short failure cache TTL; reject ocean labels in tap cache; search bar resets to coordinates on tap; `live-coarse-land-fallback.ts` offline bbox for Greenland/Iceland/Faroe/Svalbard when reverse fails; zoom-12→zoom-3 country fallback retained.
- **Verification:** `pytest tests/test_geocoding.py` — 9 passed; `vitest` live-coarse-land-fallback + live-tap-geocode-cache; `npx tsc --noEmit` — 0 errors.
- **Risks:** Coarse fallback is bbox-only (no municipality); Nominatim quota still applies under heavy use.
- **Next action:** Hard refresh `/live`, restart backend on :8000, re-tap Greenland — expect **Greenland · Territory** in card and search bar.

### 2026-09-16 — Open-ocean map picks show real ocean names

- **Context:** User tapped the South Pacific on the globe; preview card showed useless labels `Place`, `Ocean`, `Location · Ocean` instead of honest open-water context.
- **Goals:** Detect water/ocean map picks; name basin from coordinates (e.g. South Pacific Ocean); show coordinates + open-water copy; skip venue-style wiki/photos.
- **Result:** `live-open-water-place.ts` wired through map click resolver, reverse geocode, and `PlacePreviewCard`.
- **Verification:** `vitest` live-open-water-place (5); `npx tsc --noEmit` — 0 errors.

### 2026-09-15 — Live map long-press popup + worldwide local time

- **Context:** User asked for a hold-to-open map popup (web + touch) at cursor/tap point, with accurate local AM/PM time for any country on the globe view.
- **Goals:** ~0.9s long-press opens menu; show IANA timezone local clock; keep quick tap for place preview.
- **Result:** `bindMapLongPress` in `LiveMapComponent`; `LiveMapClickPopup` wired in `LivePageClient` with Open-Meteo `timezone=auto` lookup + solar fallback; actions: Pick location / Pin coordinates.
- **Verification:** `vitest` live-map-local-time (4) + live-map-attribution (6); `npx tsc --noEmit` — 0 errors.
- **Risks:** Open-Meteo network required for exact timezone; offline uses longitude estimate only.
- **Next action:** Browser QA on globe + street zoom; optional live clock tick in popup.

### 2026-09-15 — Shared Explore header on Live (fonts + chrome)

- **Context:** Explore is the cached chrome. Live used a different top bar (giant header search, Connect vs Split Activities, avatar) and a left dock that sat too low because it added extra offset on top of `--rovvy-header-h`. User: page tab bars can differ; font and header must not.
- **Goals:** Same 64px Explore pill header on every dashboard page; Live dock under that bar; map search stays Live-only.
- **Result:** `RovvyAppHeader` is the dashboard header (Explore/Live/Trips/Split Activities, Profile, My trips). HeaderSearchBar removed from the shell. Live auto-hide header removed. Dock rail/panel `top-2`. Compass/zoom track `--rovvy-header-h`. Light-map hero search uses cream `LIVE_SEARCH_PILL` + Schibsted, not dark glass.
- **Verification:** `npx tsc --noEmit` — 0 errors. Browser on localhost: `/explore` and `/live` share the same header (no destination search in the bar). `/trips` keeps page sub-nav (Overview/People/Flights/Money) under that header. Live dock sits just below the bar; map search is cream top-right.
- **Risks:** Dead sidebar helper functions remain in `layout.tsx`. Map tiles in the automation browser did not paint; local Live still has OSM attribution.
- **Next action:** Optional cleanup of unused layout sidebar helpers; commit when asked.

### 2026-09-15 — Wayra orb same on every tab, draggable

- **Context:** User wanted the Live left-corner Wayra mark to match the neat teal sparkle on Trips/Explore, and to drag it anywhere — including Live.
- **Goals:** One global orb; no Live-only pin; drag + tap-to-talk everywhere; cleaner disc (no dashed ring).
- **Result:** `AIAssistantSidecar` uses one `fabAnchorStyle` for all routes. Live no longer uses `LIVE_MAP_CHAT_FAB_POSITION`. Drag/tap works on Live. `WayraMark` is a solid teal disc + sparkle.
- **Verification:** On localhost, Live and Trips both show the teal sparkle orb at bottom-right (Live measured 21px from the right edge). Drag is enabled on Live; position is stored in `rovvy_ai_btn_pos`. The bottom-left black **N** is the Next.js dev badge, not Wayra.
- **Next action:** Confirm drag persists across tabs (`rovvy_ai_btn_pos`).

### 2026-09-14 — Wayra DeepSeek cost cut (voice + nearby)

- **Context:** Founder asked to reduce DeepSeek bill without adding a paid live-audio product or switching providers.
- **Goals:** Keep `deepseek-v4-flash`; one completion for spoken and nearby answers; shrink voice prompts; skip Gemini routing hop.
- **Result:** Voice/nearby use a single DeepSeek call (no orchestrator JSON). Voice system prompt drops the app encyclopedia and action schema. Voice payload skips route dumps and weather/events. Spoken cap is ~180 tokens / 360 chars. Text discovery/plan still uses the DeepSeek router.
- **Verification:** `pytest tests/test_wayra_voice_mode.py tests/test_wayra_llm_providers.py tests/test_wayra_output_budget.py tests/test_wayra_prompt.py tests/test_wayra_answer.py` — 43 passed (2026-09-14).
- **Risks:** Compact nearby answers no longer escalate to Gemini; spoken replies stay short by design.
- **Next action:** Watch usage logs for `wayra_*_deepseek_direct` vs orchestrator after a day of real turns.

### 2026-09-14 — Wayra chat template UI polish

- **Context:** User asked to fix the global Wayra chatting template — one shell on every tab, same as the launcher mark.
- **Goals:** Unified glass panel, header, bubbles, composer; remove per-tab visual forks.
- **Result:** `frontend/lib/wayra/wayra-chat-tokens.ts`, `WayraAssistantMessage.tsx`; `AIAssistantSidecar` refactored to single template (teal accent bar, avatar, Text|Voice row, card-style replies, rounded composer + send icon).
- **Verification:** `npx tsc --noEmit` — 0 errors on changed files (2026-09-14).
- **Next action:** Browser QA on `/live` and `/flights` for panel drag/resize + voice mode.

### 2026-09-14 — Wayra Live voice mode (Phase 1)

- **Context:** User approved Siri-like voice for Wayra on Live — tap to listen, spoken replies, DeepSeek brain unchanged.
- **Goals:** STT → existing `/ai/assistant` with `voice_mode` → browser TTS; compact spoken answers; DeepSeek-only (no Gemini escalation on voice).
- **Result:** Backend `voice_mode` on `AIAssistantRequest`, voice output budget (~480 chars), voice system prompt rules; frontend `wayra-speech.ts`, `use-wayra-voice.ts`; Live FAB + panel mic with Listening / Thinking / Speaking states on `WayraLauncherButton`.
- **Verification:** `pytest tests/test_wayra_voice_mode.py tests/test_wayra_output_budget.py` — 6 passed; `vitest run lib/wayra/__tests__/wayra-speech.test.ts` — 2 passed (2026-09-14).
- **Risks:** Browser Web Speech API varies by device/browser; branded cloud TTS not yet wired; mic permission UX on first use.
- **Next action:** Manual QA on `/live` (Chrome + mobile Safari); optional ElevenLabs/Azure TTS for fixed “Wayra voice”.

### 2026-09-14 — OpenFreeMap light self-host wiring

- **Context:** User chose OpenFreeMap http-host over full tile-gen or CARTO-only fix.
- **Goals:** Env-driven self-hosted tile base URL; vector Clean/Detailed basemaps; shared planet tiles for travel/foot overlays; safe night default without CARTO key.
- **Result:** `map-providers.ts` resolvers (`NEXT_PUBLIC_OPENFREEMAP_BASE_URL`, style overrides, `NEXT_PUBLIC_LIVE_BASEMAP`); CARTO key append; dark fallback to Clean; Scram Book deploy guide `Rovvy_OpenFreeMap_Self_Host.md`.
- **Verification:** `npx vitest run` map-providers + layer-preference tests; `npx tsc --noEmit` (pending this session).
- **Risks:** Requires ~300 GB Ubuntu VM + DNS before production cutover; satellite/hybrid still Esri.
- **Next action:** Provision http-host VM (`SKIP_PLANET=true` smoke), set Vercel `NEXT_PUBLIC_OPENFREEMAP_BASE_URL`, browser QA `/live`.

### 2026-09-12 — Live tab technical documentation

- **Context:** Live tab redevelopment; user requested comprehensive markdown documentation of `/live` page and how each section connects.
- **Goals:** Document screenshot UI (setup panel, travel mode, workflow, destination), map layers, search, routing, navigation, Wayra/Travel integrations, and all 118 live-folder modules.
- **Result:** Created `Rovvy_Live_Tab_Technical_Documentation.md` (1,441 lines). Generator script at `scripts/generate_live_tab_doc.py` for future regen.
- **Verification:** Doc generated from codebase inspection of `frontend/app/(dashboard)/live/` and backend live routes/services. Not live-tested in browser this session.
- **Risks:** Some legacy paths documented as unused (`solo_drive_command`, `FarAwayPlacePanel` disabled) — confirm during redevelopment.
- **Next action:** Review doc against redevelopment branch; update sections as UI changes land.

### 2026-09-12 — Live v2 design reference (Claude mockup)

- **Context:** User shared `Rovvy Live v2.dc.html` Claude design for Live tab redevelopment.
- **Goals:** Review mockup, fix misalignments with Rovvy rules, reference in Scram Book for implementation.
- **Result:** Copied HTML to `design/Rovvy_Live_v2_reference.html`; wrote `Rovvy_Live_v2_Design_Review.md` with gap analysis and Phase A–D plan.
- **Verification:** Compared mockup JS state machine + 5 dock stages against `page.tsx` / `live-types.ts` by code inspection.
- **Key findings:** Adopt left-dock layout + setup panel restyle (Phase A); Reports/Vote/Converge are L2/L6 net-new; fonts/colors already match `brand.ts`.
- **Risks:** Mock uses fake CSS map and DC framework — not drop-in; `support.js` may be needed for full interactivity in browser.
- **Next action:** Product sign-off on Phase A (left dock shell); then implement `LiveLeftDock.tsx` + setup panel migration.

### 2026-09-12 — Live v3 Phase A (left dock shell)

- **Context:** User approved v3 mocks; requested Scram Book update + Phase A implementation.
- **Goals:** Left dock setup panel, top-right search, v3 workflow cards, cream tokens, stage tabs (setup only active).
- **Result:** Added `LiveLeftDock.tsx`, `LiveSetupPanel.tsx`; refactored `page.tsx` layout; updated `live-design-tokens.ts`, `TravelModeChip.tsx`.
- **Verification:** `npx tsc --noEmit` — 0 errors (2026-09-12).
- **Risks:** Left dock hides when place preview opens; Vote/Converge/Arrival tabs show toast only until L6.
- **Next action:** Phase B — place preview v3 layout + empty state cards; manual UI check at `/live`.

### 2026-09-12 — Live v3 Phase B (place preview + empty states)

- **Context:** User requested Phase B after Phase A left dock shell.
- **Goals:** v3 place preview hero, Put to vote / Who's going stubs, coffee nearby list polish, inline empty-state cards.
- **Result:** Added `LivePlacePreviewV3Sections.tsx`, `LiveNearbyList.tsx`, `LiveEmptyStateCard.tsx`; updated `PlacePreviewCard.tsx`, `page.tsx`.
- **Verification:** `npx tsc --noEmit` — 0 errors (2026-09-12).
- **Risks:** Group stubs toast only until L6; empty states stack when multiple conditions apply (offline + approximate GPS).
- **Next action:** Phase C — solo navigation reskin; manual UI check at `/live`.

### 2026-09-12 — Live v3 Phase C (solo navigation reskin)

- **Context:** User requested Phase C after Phase B place preview work.
- **Goals:** v3 dark turn banner, cream bottom ETA bar, maneuver helper extraction.
- **Result:** Reskinned `SoloLiveNavigationOverlay.tsx`; added `live-navigation-maneuver.ts`, nav tokens.
- **Verification:** `npx tsc --noEmit` — 0 errors; Live vitest — 103 passed (2026-09-12).
- **Risks:** Maneuver distance still estimated when step distance unavailable; trip status controls removed from overlay (were unused).
- **Next action:** Phase E — L6 Vote / Converge / Arrival; manual reports check at `/live`.

### 2026-09-13 — Live v3 dock rail (prototype slide pattern)

- **Context:** User preferred v3 prototype left rail + sliding panel over horizontal stage tabs.
- **Goals:** Slim icon rail; cream panel slides beside rail; tap active icon to collapse.
- **Result:** Added `LiveDockRail.tsx`, refactored `LiveLeftDock.tsx`, `live-dock-stages.ts`; removed Setup/Vote/Converge tab bar.
- **Verification:** `npx tsc --noEmit` — 0 errors; `live-dock-stages.test.ts` — 2 passed (2026-09-13).
- **Next action:** Wire Converge/Vote rail icons in Phase E; browser check slide toggle at `/live`.

### 2026-09-14 — Live v3 Phase F finish (Seat Share + Night Finished notices)

- **Context:** User continued Live v3 after E3; Seat Share / Settle panels existed but lacked v3-style map notices and real convoy had mock vehicle flash.
- **Goals:** Dismissible seat/settle notices; Firebase convoy error toast; real trip shows self ride only until RTDB offers arrive; empty seat panel state.
- **Result:** `buildSeatShareOpenedNotice()`, `buildSettleOpenedNotice()`; `convoyPayloadToRecord()` + self-only fallback in `use-live-seat-share.ts`; empty vehicle state in `LiveSeatSharePanel.tsx`.
- **Verification:** `npx tsc --noEmit` — 0 errors; seat share + night finished vitest — 9 passed (2026-09-14). Browser smoke not run.
- **Risks:** Real convoy still requires Firebase + `trip_id`; settle total falls back to mock $186 without expense API data.
- **Next action:** Browser QA Seat Share on `/live?trip_id=...`; Group Travel → Night finished → settle deep link.

### 2026-09-14 — Live v3 Phase E3 finish (Real converge path + dynamic notices)

- **Context:** User continued Live v3 after E2 vote polish; Firebase converge existed but still fell back to mock members/notices when roster loaded late.
- **Goals:** Use RTDB members when connected; Wayra/late-member status notice instead of hardcoded Tomas toast; surface Firebase errors; trip roster count in setup panel.
- **Result:** `buildConvergeStatusNotice()` + roster-from-locations fallback in `live-group-converge.ts`; connected converge uses live members/Wayra only; setup panel shows actual `{n} in` from trip group.
- **Verification:** `npx tsc --noEmit` — 0 errors; `live-group-converge.test.ts` — 8 passed (2026-09-14). Browser smoke not run.
- **Risks:** Requires Firebase auth + `/live?trip_id=` + signed-in users for full real path; mock converge still used until RTDB connects.
- **Next action:** Browser QA with two trip members on same `trip_id`; Phase F/H seat share browser check.

### 2026-09-14 — Live v3 Phase E2 finish (Vote notice + add option + pin coords)

- **Context:** User continued Live v3 after E1 converge polish; vote panel existed but lacked v3 notice copy and add-option search flow.
- **Goals:** Dismissible vote-opened notice; real lat/lng on vote map pins; “Add option” search adds place to mock poll without leaving vote.
- **Result:** `buildVoteOpenedNotice()`; vote alert in `LivePageClient.tsx`; `GroupVoteOption.lat/lng` + pin placement; `pendingVoteOptionAdd` intercept in `selectDestination`.
- **Verification:** `npx tsc --noEmit` — 0 errors; `live-group-vote-mock.test.ts` + `live-group-vote.test.ts` + `live-dock-stages.test.ts` — 8 passed (2026-09-14). Browser smoke not run.
- **Risks:** Add-option from search is mock-only without trip poll API extension; real poll options still lack map coordinates from backend.
- **Next action:** Browser smoke Put to vote → vote pins → Add option search; Phase E3/E4 browser QA with `trip_id`.

### 2026-09-14 — Live v3 Phase E1 finish (Converge rail + map routes)

- **Context:** User continued Phase E1 after dock rail refactor; converge panel existed but rail icon was blocked by `LIVE_DOCK_STAGE_ENABLED.converge: false`.
- **Goals:** Enable Converge rail after Start Group Live; dashed friend→destination route lines on map; v3 traffic status toast.
- **Result:** `converge: true` in `live-dock-stages.ts`; availability-first click handling in `LiveDockRail.tsx`; `live-group-routes-sync.ts` + map overlay; dismissible “Tomas hit traffic on the 90” notice in `LivePageClient.tsx`.
- **Verification:** `npx tsc --noEmit` — 0 errors; `live-dock-stages.test.ts` + `live-group-routes-sync.test.ts` + `live-group-converge-mock.test.ts` — 5 passed (2026-09-14). Browser smoke not run.
- **Risks:** Route lines are straight segments (not road geometry); traffic toast is mock copy until Wayra live-context drives it.
- **Next action:** Browser smoke Group Travel → destination → Start Group Live → converge panel + friend routes; E2 vote rail QA.

### 2026-09-13 — Live page ChunkLoadError fix (page.js split)

- **Context:** `/live` failed in dev with `ChunkLoadError` loading `app/(dashboard)/live/page.js` (timeout); chunk was ~7.6 MB.
- **Goals:** Reduce initial route chunk size so webpack dev can compile/serve within browser timeout.
- **Result:** Thin `page.tsx` dynamically loads `LivePageClient.tsx`; dock panels + heavy overlays also lazy-loaded. Initial `page.js` ~0.1 MB in dev after fix.
- **Verification:** `npx tsc --noEmit` — 0 errors; `npx next build` — success (2026-09-13).
- **Risks:** Stale dev server on port 3000 can still serve old chunks — restart dev + hard refresh required.
- **Next action:** Kill duplicate `next dev` processes; `Remove-Item -Recurse .next`; `npm run dev`.

### 2026-09-13 — Live v3 seat join + pickup decrement

- **Context:** User continued Live v3 after convoy map pins; join/add-pickup were toast-only stubs.
- **Goals:** Real seat join decrements `seatsOpen` and adds rider pickup in RTDB; drivers add pickup stops from map/search; periodic GPS publish must not wipe joins.
- **Result:** Added `live-convoy-actions.ts`; RTDB transactions in `live-convoy-sync.ts`; `useLiveSeatShare.joinVehicle` / `addPickup`; mock local state; pickup capture via place select; panel shows **Seat requested**.
- **Verification:** `live-convoy-actions.test.ts` — 6 passed; `npx tsc --noEmit` — 0 errors (2026-09-13). Browser smoke not run.
- **Risks:** Join uses pickup label from selected place or destination fallback; Firebase rules must allow convoy transactions.
- **Next action:** Browser QA on `/live?trip_id=...` Seat Share with two signed-in users.

### 2026-09-13 — Live v3 convoy map pins (Seat Share drivers on map)

- **Context:** User continued Live v3 after Phase I; convoy RTDB (Phase H) fed the panel but not the map.
- **Goals:** Show Seat Share drivers as map pins when the seat dock is open; real GPS from RTDB convoy offers; mock fallback without coordinates.
- **Result:** Added `live-convoy-map-pins.ts`, `live-convoy-marker-elements.ts`, `live-convoy-pins-sync.ts`; `useLiveSeatShare` exposes `offers`; wired `page.tsx` + `LiveMapComponent` (pin click opens seat panel).
- **Verification:** `live-convoy-map-pins.test.ts` — 3 passed; `live-seat-share-convoy.test.ts` — 3 passed; `npx tsc --noEmit` — 0 errors (2026-09-13). Browser smoke not run.
- **Risks:** Pins visible only on seat dock stage (matches vote pin pattern); drivers without lat/lng in RTDB fall back to mock offsets.
- **Next action:** Seat join / pickup decrement; browser check at `/live?trip_id=...` Seat Share workflow.

### 2026-09-13 — Live v3 Phase I (Arrival automation + split deep link)

- **Context:** User continued Live v3 rollout after Phase H; Phase I planned GPS-based partial arrival to improve Night Finished / settle flow.
- **Goals:** Detect group members within arrival radius (GPS + RTDB); suggest wrap-night when majority arrived; wire Night Finished counts from real arrivals; open Split Activities on the correct trip from Live.
- **Result:** Added `live-group-arrival.ts`, `live-arrival-sync.ts`, `use-live-group-arrival.ts`; RTDB path `trips/{tripId}/arrivals/{userId}`; converge panel arrival banner + settle CTA; `split-activities/page.tsx` reads `?trip_id=` and selects group/trip.
- **Verification:** `live-group-arrival.test.ts` — 5 passed; `live-night-finished.test.ts` — 3 passed; `npx tsc --noEmit` — 0 errors (2026-09-13). Browser smoke not run this session.
- **Risks:** Arrival publish requires Firebase like E3/H; mock converge still falls back to ETA ≤ 8 min when no GPS; auto-settle is suggest-only (toast + banner, not forced dock switch).
- **Next action:** Convoy map pins; seat join / pickup decrement; browser check at `/live?trip_id=...` with group converge.

### 2026-09-13 — Live v3 Phase H (Convoy RTDB — real Seat Share)

- **Context:** User typed `ext` (next) after Phase G; Seat Share vehicles were still mock from Phase F.
- **Goals:** Firebase RTDB convoy offers at `trips/{tripId}/convoy/{userId}`; live Seat Share panel from trip drivers.
- **Result:** `live-convoy-sync.ts`, `live-seat-share-convoy.ts`, `useLiveSeatShare`; publish on Start Seat Share when `trip_id` present.
- **Verification:** `live-seat-share-convoy.test.ts` — 3 passed; `npx tsc --noEmit` — 0 errors (2026-09-13).
- **Risks:** Requires Firebase auth like E3; pickup join/decrement still toast-only.
- **Next action:** Arrival automation; split-activities `trip_id` deep link.

### 2026-09-13 — Live v3 Phase G (Real group vote API)

- **Context:** User said `next` after Phase F; E2 vote panel was still mock-only.
- **Goals:** Wire Live vote panel to existing trip polls API — create poll, fetch panel, cast vote.
- **Result:** `/live/trips/{id}/vote-panel` GET/POST, `/live/polls/{id}/vote`; `useLiveGroupVote` hook; Put to vote creates Postgres poll when `trip_id` present.
- **Verification:** `pytest tests/test_live_group.py` — 7 passed; `live-group-vote.test.ts` — 2 passed; `npx tsc --noEmit` — 0 errors (2026-09-13).
- **Risks:** One vote per user per poll (API rule); changing vote shows conflict toast.
- **Next action:** L7 convoy RTDB for real Seat Share vehicles; arrival automation.

### 2026-09-13 — Live v3 Phase F (Seat Share + Night Finished → Splits)

- **Context:** User approved Phase F after E3 Firebase converge shipped.
- **Goals:** Seat Share panel (cars, seats, pickups, cost per head); Night Finished settle card with running total + Open split to Connect.
- **Result:** `LiveSeatSharePanel.tsx`, `LiveNightFinishedPanel.tsx`; seat/settle rail icons; Group Live “Night finished” → settle panel; trip expense total fetch when `trip_id` present.
- **Verification:** `npx tsc --noEmit` — 0 errors; night-finished + seat-share + dock-stages vitest — 6 passed (2026-09-13).
- **Risks:** Seat Share uses mock vehicles until L7 convoy RTDB; expense total requires logged-in trip with expenses.
- **Next action:** Browser smoke Seat Share start + Group Live night finished → Open split.

### 2026-09-13 — Live v3 Phase E3 (Firebase friend ETAs + real converge)

- **Context:** User requested `e3` after Phase E2 Vote panel shipped.
- **Goals:** Firebase RTDB location sharing, real member ETAs on converge panel, group Live session start, Wayra live-context alert.
- **Result:** Backend `/live/firebase-token` + `/live/group/converge/start`; frontend RTDB subscribe/publish, `useLiveGroupConverge` hook, route-based member ETAs.
- **Verification:** `pytest tests/test_live_group.py` — 4 passed; `live-group-converge.test.ts` — 5 passed; `npx tsc --noEmit` — 0 errors (2026-09-13).
- **Risks:** Requires Firebase env on backend + frontend; trip must be opened via `/live?trip_id=...`; member ETAs throttle route-preview calls every 30s.
- **Next action:** Browser smoke with two logged-in members on same trip; Phase F Seat Share + Night Finished.

### 2026-09-13 — Live v3 Phase E2 (Vote panel)

- **Context:** User requested `e2` after Phase E1 Converge shipped.
- **Goals:** Red “Vote open” panel, option bars, quick actions, map vote pins, Put to vote from place preview.
- **Result:** `LiveGroupVotePanel.tsx`, `live-group-vote-mock.ts`, `live-vote-pins-sync.ts`; vote rail icon when Group Travel vote active; mock pins on map at vote stage.
- **Verification:** `npx tsc --noEmit` — 0 errors; `live-group-vote-mock.test.ts` + `live-dock-stages.test.ts` — 4 passed (2026-09-13).
- **Risks:** Mock vote only — no Postgres poll API or Firebase sync yet.
- **Next action:** Phase E3 Firebase ETAs; browser smoke Group Travel → Put to vote → vote pins.

### 2026-09-13 — Live v3 Phase E1 (Converge panel)

- **Context:** User approved moving to next phase after dock rail refactor; Converge mock from v3.
- **Goals:** Converge panel UI, mock member ETAs, Wayra noticed card, Start Group Live flow.
- **Result:** `LiveGroupConvergePanel.tsx`; Group Live start opens converge stage + mock friends on map.
- **Verification:** `npx tsc --noEmit` — 0 errors; converge mock vitest — 1 passed (2026-09-13).
- **Next action:** Phase E2 Vote panel; E3 Firebase ETAs.

### 2026-09-12 — Live v3 Phase D (L2 Reports)

- **Context:** User requested next phase after Phase C nav reskin.
- **Goals:** Place vibe reports (6 types), 2-hour TTL, 3-match confirmation, v3 modal, map overlay toggle.
- **Result:** Backend `live_place_reports` table + `/api/v1/live/place-reports` endpoints; frontend `LiveReportModal.tsx`, report button on right rail, Reports layer in map tools.
- **Verification:** `npx tsc --noEmit` — 0 errors; Live vitest — 104 passed (21 files); `pytest tests/test_live_place_reports.py` — 5 passed (2026-09-12).
- **Risks:** Requires Alembic migration `20260912_live_place_reports` on deploy; submit needs logged-in user.
- **Next action:** Phase E — L6 group panels; browser smoke test report flow with API on `:8001`.

### 2026-09-12 — Live v3 smoke test (browser)

- **URL:** `http://localhost:3000/live` (frontend) + `http://127.0.0.1:8001` (API)
- **Phase A:** Pass — left dock, cream setup panel, stage tabs, top-right search pill.
- **Phase B:** Pass (with API) — Coffee nearby returns **50 results** with map pins; place preview shows hero, **Put to vote / Reserve / Who's going**, route ETA (**2 min · 0.7 mi**), left dock hides on preview.
- **Phase B (no API):** Partial — UI shells render; nearby/search fail when `localhost:8001` unreachable.
- **Phase C nav:** Pass (logged-in retry) — dark turn banner, speed pill, Parking/Share/Add stop, cream ETA bar with End; left dock hidden.
- **Retry (2026-09-12):** Backend on **8001**; Phase A+B verified; Phase C verified after sign-in + Tasa Coffee Roasters + Start directions.
