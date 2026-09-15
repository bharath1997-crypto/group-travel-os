"""Generate Rovvy Live Tab technical documentation."""
from __future__ import annotations

from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIVE_DIR = ROOT / "frontend/app/(dashboard)/live"
OUT = ROOT / "Scram Book/Live Tab/Rovvy_Live_Tab_Technical_Documentation.md"

FILE_DESCRIPTIONS: dict[str, str] = {
    "page.tsx": "Main Live page orchestrator (~4,236 lines). Owns all session state, search, route preview, panel visibility, and map props.",
    "LiveMapComponent.tsx": "MapLibre map controller. GPS watch, route layers, overlay sync delegation, navigation camera. No business logic.",
    "PlacePreviewCard.tsx": "Primary place preview panel with Guide/About/Info tabs, route alternatives, Wayra suggestions, action buttons.",
    "FarAwayPlacePanel.tsx": "Alternative panel for far destinations (implemented but disabled via showFarAwayPanel=false).",
    "LiveRouteSummaryBar.tsx": "Compact bottom route summary with duration, Go button, open details.",
    "LiveRouteOriginSetup.tsx": "Modal for choosing route origin: GPS, map center, map pick, search.",
    "SoloLiveActivePanel.tsx": "Pre-navigation Solo command panel (shown when liveStage=solo_drive_command — rarely reached).",
    "SoloLiveNavigationOverlay.tsx": "Full-screen Waze-style turn-by-turn navigation overlay during active nav.",
    "SoloRoutePreviewPanel.tsx": "Legacy/orphan route preview panel — not imported by page.tsx.",
    "RoviRouteIntelligencePanel.tsx": "Long-distance multi-modal route options UI (flights, trains, etc.).",
    "SavedPlacePanel.tsx": "Detail panel for a locally saved place.",
    "LiveMapRightControls.tsx": "Right dock: compass, locate, layers panel, 2D/3D toggle, sound/notifications.",
    "LiveMapLayerControl.tsx": "Base map layer picker sub-component.",
    "LiveMapToolsControl.tsx": "Map tools sub-control.",
    "LiveMapDock.tsx": "Legacy simplified dock (layers, fullscreen, GPS).",
    "LiveMapCompass.tsx": "Compass widget.",
    "LiveMapZoomControl.tsx": "Zoom buttons.",
    "LiveStripZoomScale.tsx": "Right-edge zoom slider.",
    "LiveMapAttributionStrip.tsx": "Bottom strip: coordinates, attribution, zoom, immersive toggle.",
    "LiveMapNoticeStack.tsx": "Toast messages, status pill, cross-border notices.",
    "LiveMapLocationSheet.tsx": "Bottom sheet on map tap: set origin/destination, add stop, copy coords.",
    "LiveMapClickPopup.tsx": "Click popup UI for map interactions.",
    "LiveImmersiveChrome.tsx": "Decorative space/globe chrome for immersive mode.",
    "LiveMiniHud.tsx": "Top-left HUD during active live session (mode, speed, ETA).",
    "TravelModeChip.tsx": "Hero search left chip showing travel mode + workflow.",
    "InlineSignInModal.tsx": "Inline login modal for Start Live auth gate.",
    "LiveAiSuggestionsBlock.tsx": "Wayra AI suggestion chips in place preview.",
    "LiveDataTrustBadge.tsx": "Verified / Area info / AI estimate trust labels.",
    "RoviPlaceExplanationBlock.tsx": "Rovi AI place explanation block.",
    "PlacePreviewMedia.tsx": "Place photo/media gallery in preview card.",
    "PlaceWikiAboutBlock.tsx": "Wikipedia about content block.",
    "PlaceWikiAboutSection.tsx": "About tab section wrapper with entity-match disclosure.",
    "live-types.ts": "Core TypeScript types: LiveStage, RouteLine, RouteAlternative, travel modes, formatters.",
    "live-design-tokens.ts": "Tailwind class tokens for search pill, dropdown, section labels.",
    "live-layout.ts": "Layout constants: control positions, 2D/3D pitch values, map view mode type.",
    "live-immersive-chrome.ts": "Immersive fullscreen state + custom event dispatch for dashboard layout.",
    "live-gps.ts": "GPS state types, logging, status labels, freshness checks.",
    "live-gps-marker.ts": "GPS dot DOM factory, pulse animations, heading cone, globe scale.",
    "live-marker-elements.ts": "DOM factories for destination, start, clicked pin, border checkpoint markers.",
    "live-meetup-marker.ts": "Meetup pin marker element factory.",
    "live-map-globe.ts": "Globe projection at max zoom out, sun lighting, locate zoom resolution.",
    "live-globe-sun.ts": "Sun position calculation for globe lighting.",
    "live-map-zoom-limits.ts": "Min/max zoom caps, red/green limit button colors.",
    "live-map-style-switch.ts": "Safe MapLibre style switching with overlay restore.",
    "live-maplibre-tile-abort-fix.ts": "Patch for MapLibre 5.x tile abort race crash.",
    "live-map-labels.ts": "Search visible map labels for autocomplete merge.",
    "live-map-tap-coords.ts": "Resolve tap lng/lat from map event.",
    "live-map-attribution.ts": "Attribution focus types and formatting.",
    "live-map-pick-context.ts": "Coordinate formatting for map pick UI.",
    "live-map-right-controls.ts": "Pure helpers for right controls layout.",
    "live-clean-map-housenumbers.ts": "Clean map house number label styling.",
    "live-dark-map-labels.ts": "Dark layer street label sync.",
    "live-strip-zoom-scale.ts": "Zoom scale slider math and snapping.",
    "live-routing.ts": "fetchLiveRoute → POST /live/route-preview; routeLineFromAlternative.",
    "live-route-origin.ts": "Build route origins from GPS, map pick, map center, search.",
    "live-route-style.ts": "Route line width/color tokens for MapLibre layers.",
    "live-route-bearing.ts": "Bearing along route for navigation camera.",
    "live-route-validation.ts": "Land-connected route checks, solo live block reasons.",
    "live-geocoding.ts": "Autocomplete, forward/reverse geocoding, debounce, caching.",
    "live-search-categories.ts": "Category taxonomy resolution from live_search_taxonomy.json.",
    "live-search-suggestions.ts": "Instant suggestion filtering from recent searches.",
    "live-search-merge.ts": "Merge API autocomplete with map label search results.",
    "live-recent-searches.ts": "Recent search localStorage persistence.",
    "live-pasted-location.ts": "Parse Google Maps URLs and coordinate strings.",
    "live-place-key.ts": "Stable placeKey builder for dedup and media lookup.",
    "live-place-display.ts": "Place name/address display formatting.",
    "live-place-enrich.ts": "Enrich places with travel-relevant metadata.",
    "live-place-transliteration.ts": "Transliteration helpers for non-Latin names.",
    "live-place-name-i18n.ts": "Latin spelling enrichment via /geocoding/display-name.",
    "live-osm-address.ts": "OSM address parsing helpers.",
    "live-poi-icons.ts": "POI category icon and color resolution.",
    "live-tap-geocode-cache.ts": "In-memory cache for map tap reverse geocode.",
    "live-location-context.ts": "buildLocationContext, shouldShowAskRoviAi, distance tiers.",
    "live-ai-suggestions.ts": "buildRoutePreviewAiSuggestions for Wayra chips.",
    "live-rovi.ts": "fetchRoviPlaceExplanation → POST /live/ai/place-explanation.",
    "live-travel-handoff.ts": "buildTravelHandoffUrl for Travel tab deep links.",
    "live-preview-actions.ts": "startLivePreviewDirection, addLivePreviewLocation API calls.",
    "live-place-media.ts": "resolvePlaceMedia → POST /live/places/media/resolve.",
    "live-map-layer-preference.ts": "localStorage for base map layer.",
    "live-travel-layer-preference.ts": "localStorage for travel overlay toggle.",
    "live-sea-routes-preference.ts": "localStorage for sea + cruise route overlays.",
    "live-foot-routes-preference.ts": "localStorage for foot/trek overlay.",
    "live-friend-preference.ts": "localStorage for friend tracking layer.",
    "live-saved-places-preference.ts": "localStorage for saved places layer visibility.",
    "live-saved-places-store.ts": "Local saved places CRUD + SAVED_PLACES_CHANGED_EVENT.",
    "live-panel-size.ts": "Preview panel resize dimensions localStorage.",
    "live-travel-layer-sync.ts": "Sync highways, main routes, railways overlay on map.",
    "live-hybrid-roads-sync.ts": "Hybrid base layer road emphasis overlay.",
    "live-sea-routes-sync.ts": "Shipping lanes, ferries, cruise itineraries GeoJSON overlay.",
    "live-foot-routes-sync.ts": "OSM trekking trails vector overlay.",
    "live-friend-layer-sync.ts": "Friend location markers overlay.",
    "live-saved-places-layer-sync.ts": "Saved place pins overlay + click binding.",
    "live-travel-layer-vector.ts": "Vector tile source for travel layer.",
    "live-travel-layer-styles.ts": "MapLibre layer styles for travel overlay.",
    "route-intelligence.ts": "fetchRouteIntelligence → POST /route-intelligence/explain.",
    "route-intelligence-types.ts": "TypeScript types for route intelligence API.",
    "wiki-about-display.ts": "Wikipedia display helpers and Wayra disclaimer text.",
    "use-live-saved-places.ts": "Hook subscribing to saved places store changes.",
    "use-live-preview-panel-resize.ts": "Hook for draggable preview panel dimensions.",
}


def classify(rel: str) -> str:
    name = Path(rel).name
    if rel.startswith("__tests__/"):
        return "test"
    if name.startswith("use-live-"):
        return "hook"
    if name.endswith("-sync.ts"):
        return "sync"
    if name.endswith(".tsx"):
        return "component"
    if name.endswith(".ts"):
        return "module"
    return "other"


def main() -> None:
    files = sorted(p.relative_to(LIVE_DIR).as_posix() for p in LIVE_DIR.rglob("*") if p.is_file())
    lines: list[str] = []

    def add(text: str = "") -> None:
        lines.append(text)

    today = date.today().isoformat()
    add("# Rovvy Live Tab — Technical Documentation")
    add()
    add(f"> **Document version:** 1.0  ")
    add(f"> **Last updated:** {today}  ")
    add(f"> **Route:** `http://localhost:3000/live` (production: `https://rovvy.app/live`)  ")
    add(f"> **Primary source:** `frontend/app/(dashboard)/live/` ({len(files)} files)  ")
    add("> **Purpose:** Comprehensive reference for the Live tab redevelopment.")
    add()
    add("---")
    add()
    add("## Table of Contents")
    add()
    sections = [
        "Executive Summary",
        "Screenshot Walkthrough",
        "Product Roadmap Phases",
        "Route and Layout Integration",
        "Architecture Overview",
        "Frontend Layering Model",
        "LiveStage State Machine",
        "page.tsx Orchestrator",
        "Travel Mode and Workflow",
        "Setup Panel",
        "Search System",
        "Place Preview Card Tabs",
        "Route Preview",
        "Navigation",
        "LiveMapComponent",
        "Map Base Layers",
        "Map Overlay Layers",
        "Map Controls",
        "GPS and Location",
        "Wayra Integration",
        "Travel Tab Handoff",
        "Trip Context",
        "Backend API Reference",
        "Backend Services",
        "localStorage Preferences",
        "UI Panel Visibility Matrix",
        "Event Bus",
        "Complete File Inventory",
        "Test Coverage",
        "Known Gaps",
        "Development Guide",
        "Appendix — Flow Diagrams",
        "Appendix — Type Reference",
        "Appendix — Handler Index",
    ]
    for i, title in enumerate(sections, 1):
        slug = title.lower().replace(" ", "-").replace("—", "").replace("/", "")
        add(f"{i}. [{title}](#{i}-{slug})")
    add()
    add("---")
    add()

    # Section 1
    add("## 1. Executive Summary")
    add()
    add("The **Live tab** is Rovvy's map-first real-time navigation product. It occupies the full viewport below the global dashboard header. All product UI floats as glass panels over a MapLibre GL JS canvas using OpenStreetMap-derived tiles.")
    add()
    add("### Key facts")
    add()
    add("| Item | Value |")
    add("|------|-------|")
    add("| Entry file | `frontend/app/(dashboard)/live/page.tsx` |")
    add("| Map engine | MapLibre GL JS 5.x |")
    add("| Tile provider | CARTO basemaps (OSM data) |")
    add("| Routing backend | FastAPI `LiveRoutingService` (Google Routes + OSRM fallback) |")
    add("| Auth model | Browse-first; JWT required only to **Start Live** |")
    add("| Default workflow | Solo |")
    add("| Default travel mode | Drive |")
    add("| Module count | 118 files in live folder |")
    add()
    add("### What works without login")
    add()
    add("- Pan/zoom map, switch layers")
    add("- Search places (requires GPS or map center anchor)")
    add("- Category nearby search (beaches, airports, etc.)")
    add("- Place preview card with Wikipedia About")
    add("- Route preview on map")
    add("- Map tap → location sheet")
    add()
    add("### What requires login")
    add()
    add("- **Start Solo Live** from setup panel")
    add("- Account sync for `addLivePreviewLocation` (falls back to local-only on 401)")
    add()
    add("---")
    add()

    # Section 2 Screenshot
    add("## 2. Screenshot Walkthrough")
    add()
    add("The redevelopment screenshot shows **`static_landing`** with the **setup panel** open.")
    add()
    add("### 2.1 Visible UI elements mapped to code")
    add()
    add("| Screenshot element | React component / state |")
    add("|--------------------|-------------------------|")
    add("| Hero search pill | Search input in `page.tsx` + `TravelModeChip` |")
    add("| \"Search places, stops, meet points\" | `searchQuery` placeholder |")
    add("| Suggestions button | `setShowSuggestionsCard(true)` |")
    add("| TRAVEL MODE grid (Drive selected) | Setup panel — `EXTENDED_TRAVEL_MODES.map()` |")
    add("| WORKFLOW (Solo selected) | `WORKFLOW_TYPES.map()` → `workflowType` |")
    add("| DESTINATION \"No destination set\" | `destination` is null |")
    add("| Set button | Focuses search, closes setup panel |")
    add("| \"Sign in to start\" | `!user` branch in setup panel action area |")
    add("| Dark map with API KEY watermarks | CARTO tiles without valid `NEXT_PUBLIC_CARTO_API_KEY` |")
    add("| Compass (bottom-left) | `LiveMapRightControls` compass section |")
    add("| Layers/zoom/locate (bottom-right) | `LiveMapRightControls` + `LiveMapAttributionStrip` |")
    add("| Coordinates bar | `LiveMapAttributionStrip` — `formatMapCoordinates()` |")
    add("| Global header Live tab active | `LiveHeaderNavTab` in dashboard layout |")
    add()
    add("### 2.2 Initial state on page load")
    add()
    add("1. `liveStage = \"static_landing\"`")
    add("2. `showSetupPanel` may be false until user clicks TravelModeChip")
    add("3. Map loads with saved layer preference (`loadLiveMapLayerPreference()` → default `\"clean\"`)")
    add("4. GPS watch starts inside `LiveMapComponent` on mount")
    add("5. Recent searches loaded from localStorage")
    add("6. If `?trip_id=` present, trip context fetched asynchronously")
    add()
    add("---")
    add()

    # Section 3 Roadmap
    add("## 3. Product Roadmap Phases")
    add()
    add("| Phase | Live tab scope | Status |")
    add("|-------|----------------|--------|")
    add("| L1 | Fullscreen map, GPS dot, day/night | Complete |")
    add("| L2 | Reports, hazards, voting | Not started |")
    add("| L3 | Traffic, weather, POI search | POI/category search live |")
    add("| L4 | Routing, navigation | Solo drive nav complete |")
    add("| L5 | Route chat | Not started |")
    add("| L6 | Group travel | Workflow UI only (toast on start) |")
    add("| L7 | Convoy / Seat Share | Workflow UI only (toast on start) |")
    add("| L8 | Wayra AI | Preview suggestions + messenger integration |")
    add()
    add("---")
    add()

    # Section 4 Layout
    add("## 4. Route and Layout Integration")
    add()
    add("### 4.1 File routing")
    add()
    add("```")
    add("frontend/app/(dashboard)/live/page.tsx  →  GET /live")
    add("```")
    add()
    add("### 4.2 Dashboard layout (`layout.tsx`)")
    add()
    add("When `pathname === \"/live\"`:")
    add("- Adds `live-mode` class to `documentElement` and `body`")
    add("- Sets `--rovvy-header-h` CSS variable")
    add("- Uses `dashboard-main-live` class: `p-0`, `overflow-hidden`, transparent background")
    add("- Renders `LiveHeaderNavTab` instead of plain nav link for Live section")
    add("- Listens for `rovvy-live-chrome` custom event to hide bottom nav in immersive mode")
    add()
    add("### 4.3 Live page shell positioning")
    add()
    add("```tsx")
    add('<div className="live-page-shell fixed inset-x-0 bottom-0" style={{ top: "var(--rovvy-header-h)" }}>')
    add("```")
    add()
    add("This ensures the map fills all space below the sticky header without double scrollbars.")
    add()
    add("### 4.4 Dynamic map import")
    add()
    add("```tsx")
    add('const LiveMapComponent = dynamic(() => import("./LiveMapComponent"), { ssr: false });')
    add("```")
    add()
    add("MapLibre requires browser APIs; server-side rendering is disabled.")
    add()
    add("---")
    add()

    # Section 5 Architecture
    add("## 5. Architecture Overview")
    add()
    add("```mermaid")
    add("flowchart TB")
    add("  subgraph Dashboard")
    add("    Layout[layout.tsx]")
    add("    Header[Global Header + LiveHeaderNavTab]")
    add("  end")
    add("  subgraph LivePage[page.tsx]")
    add("    State[React State + Handlers]")
    add("    Search[Hero Search UI]")
    add("    Panels[Floating Panels]")
    add("  end")
    add("  subgraph MapLayer[LiveMapComponent]")
    add("    ML[MapLibre GL]")
    add("    GPS[GPS Watch]")
    add("    Sync[Overlay Sync Modules]")
    add("  end")
    add("  subgraph Backend[FastAPI]")
    add("    Route[/live/route-preview]")
    add("    Geo[/geocoding/*]")
    add("    Places[/places/nearby]")
    add("    AI[/live/ai/*]")
    add("  end")
    add("  Layout --> LivePage")
    add("  State --> MapLayer")
    add("  State --> Backend")
    add("  Search --> Geo")
    add("  Panels --> AI")
    add("```")
    add()
    add("Data flows **down** via props to `LiveMapComponent` and **up** via callbacks (`onMapClick`, `onGpsStateChange`, etc.). Business logic lives in `page.tsx` handlers and pure `live-*.ts` modules — not in the map component.")
    add()
    add("---")
    add()

    # Section 6 Layering
    add("## 6. Frontend Layering Model")
    add()
    add("| Layer | Files | Import rules |")
    add("|-------|-------|--------------|")
    add("| Components | 32 `.tsx` files | May import anything except avoid maplibre in non-map files |")
    add("| Sync | 6 `*-sync.ts` | Import maplibre; NO apiFetch |")
    add("| Hooks | 2 `use-live-*.ts` | Compose stores and UI state |")
    add("| Pure modules | ~40 `live-*.ts` | NO maplibre-gl import |")
    add("| Network | routing, geocoding, rovi, etc. | apiFetch only |")
    add("| Tests | 19 files in `__tests__/` | Vitest unit tests |")
    add()
    add("---")
    add()

    # Section 7 LiveStage
    add("## 7. LiveStage State Machine")
    add()
    add("Source: `live-types.ts`")
    add()
    add("```typescript")
    add("export type LiveStage =")
    add('  | "static_landing"')
    add('  | "place_preview"')
    add('  | "destination_set"')
    add('  | "long_distance_preview"')
    add('  | "solo_drive_command"')
    add('  | "solo_drive_navigation"')
    add('  | "split_phase_active";')
    add("```")
    add()
    add("### Transition table")
    add()
    add("| From | Event | To | Handler |")
    add("|------|-------|-----|---------|")
    add("| static_landing | Select place | place_preview | selectDestination |")
    add("| place_preview | Make destination (local) | destination_set | handleMakeDestination |")
    add("| place_preview | Make destination (far) | long_distance_preview | handleMakeDestination |")
    add("| destination_set | Go / Start Live | split_phase_active | handleGetDirections / handleStartLive |")
    add("| split_phase_active | End navigation | destination_set | handleEndSoloLive |")
    add("| any | Clear place | static_landing | clearSelectedPlace |")
    add()
    add("### isActiveNavigationStage")
    add()
    add("Returns true for `solo_drive_navigation` OR `split_phase_active`. Triggers:")
    add("- Hide hero search")
    add("- Show `SoloLiveNavigationOverlay`")
    add("- Map `navigationMode={true}`")
    add("- `enterNavigationView()` on map ref")
    add()
    add("**Note:** Current handlers set `split_phase_active` for navigation, not `solo_drive_navigation`.")
    add()
    add("---")
    add()

    # Sections 8-34 - generate substantial content
    add("## 8. page.tsx Orchestrator")
    add()
    add("The orchestrator is the single largest file in the Live tab. It coordinates ~50 pieces of React state, 30+ handler functions, and conditional rendering of 15+ overlay panels.")
    add()
    add("### 8.1 URL parameters")
    add()
    add("| Param | Example | Effect |")
    add("|-------|---------|--------|")
    add("| trip_id | `/live?trip_id=abc-123` | Fetches trip + locations; merges trip places into saved places layer |")
    add()
    add("### 8.2 Auth integration")
    add()
    add("- `useDashboardUser()` from `@/contexts/dashboard-user-context`")
    add("- `getToken()` from `@/lib/auth` for authenticated API calls")
    add("- `InlineSignInModal` posts to `/auth/login`, saves JWT as `gt_token`")
    add()
    add("### 8.3 Derived visibility flags")
    add()
    add("| Flag | Formula (simplified) |")
    add("|------|---------------------|")
    add("| showPlacePreview | !isLiveActive && selectedPlace && showPlaceDetailsPanel |")
    add("| showRouteSummaryBar | !isLiveActive && (place_preview \\|\\| destination_set) && !showPlaceDetailsPanel |")
    add("| showNavigationOverlay | isLiveActive && isActiveNavigationStage(liveStage) |")
    add("| isLongDistancePreview | liveStage === \"long_distance_preview\" |")
    add("| isNavigating | isActiveNavigationStage(liveStage) |")
    add()
    add("---")
    add()

    add("## 9. Travel Mode and Workflow")
    add()
    add("### 9.1 Ground travel modes")
    add()
    add("```typescript")
    add('const TRAVEL_MODES = ["Drive", "Bike", "Trek", "Walk"] as const;')
    add("```")
    add()
    add("Sent to backend in route preview request. Affects last-mile walk segment for Drive arrivals.")
    add()
    add("### 9.2 Extended modes (Phase 2 placeholders)")
    add()
    add("Train, Bus, Air, Ship appear in setup panel UI via `EXTENDED_TRAVEL_MODES` but are disabled with toast.")
    add()
    add("### 9.3 Vehicle preference")
    add()
    add("- `private` — Solo Live routing on map")
    add("- `public` — Opens Travel tab / route intelligence instead of drive route")
    add()
    add("### 9.4 Workflow types")
    add()
    add("| Workflow | Start Live | Navigation |")
    add("|----------|------------|------------|")
    add("| Solo | Enabled when route ready | Full 3D nav |")
    add("| Group Travel | Toast Phase 2 | N/A |")
    add("| Seat Share | Toast Phase 3 | N/A |")
    add()
    add("---")
    add()

    add("## 10. Setup Panel")
    add()
    add("Opened via `TravelModeChip` click → `setShowSetupPanel(true)`.")
    add()
    add("### Sections")
    add("1. **Travel Mode** — 4×2 grid from `EXTENDED_TRAVEL_MODES`")
    add("2. **Workflow** — 3-column grid from `WORKFLOW_TYPES`")
    add("3. **Destination** — shows committed destination or Set link")
    add("4. **Action** — Sign in OR Start {Workflow} Live button")
    add()
    add("Start button disabled when:")
    add("- `routePreviewStatus !== \"ready\"`")
    add("- `!activeRoute`")
    add("- `routeLoading === true`")
    add()
    add("---")
    add()

    add("## 11. Search System")
    add()
    add("### 11.1 Hero search bar")
    add()
    add("- Debounce: `SEARCH_DEBOUNCE_MS = 150` (in live-geocoding.ts)")
    add("- Minimum query length: 2 characters for API search")
    add("- Anchor required: fresh GPS or map center")
    add()
    add("### 11.2 Autocomplete pipeline")
    add()
    add("1. `liveAutocompleteSearch()` → `GET /search/places`")
    add("2. Fallback → `GET /geocoding/search`")
    add("3. Merge with map label search via `mergeAutocompleteResults()`")
    add("4. `selectPlace()` → `autocompleteResultToPlacePreview()` → `selectDestination()`")
    add()
    add("### 11.3 Category search")
    add()
    add("- Taxonomy: `frontend/data/live_search_taxonomy.json`")
    add("- `resolveLiveSearchCategory(query)` matches keywords")
    add("- `handleNearbySearch()` → `GET /places/nearby`")
    add("- Results shown in list panel + POI pins on map")
    add()
    add("### 11.4 Recent searches")
    add()
    add("- Storage key: `rovvy.live.recentSearches.v1` or per-user variant")
    add("- Types: place, category_search, destination, dropped_pin")
    add("- `filterInstantSuggestions()` powers Suggestions dropdown")
    add()
    add("### 11.5 Pasted location")
    add()
    add("`parsePastedLocation()` handles Google Maps URLs and lat/lng strings.")
    add()
    add("---")
    add()

    add("## 12. Place Preview Card Tabs")
    add()
    add("Component: `PlacePreviewCard.tsx`")
    add()
    add("### Tabs")
    add()
    add("| Tab | ID | Content |")
    add("|-----|-----|---------|")
    add("| Guide | guide | Actions, route preview, AI suggestions, nearby at click |")
    add("| About | about | Wikipedia via `PlaceWikiAboutSection` → `/places/wiki-summary` |")
    add("| Info | info | Address, hours, phone, tags, trust badges |")
    add()
    add("### Key actions on Guide tab")
    add()
    add("| Button | Handler |")
    add("|--------|---------|")
    add("| Make destination | onMakeDestination |")
    add("| Get directions | onGetDirections |")
    add("| Start direction | onStartDirection |")
    add("| Start Live | onStartLive |")
    add("| Ask Wayra | onAskRovi → emitOpenWayra |")
    add("| Open Travel tab | onOpenTravelTab |")
    add("| Save place | onSavePlace → localStorage |")
    add()
    add("### Route alternatives")
    add()
    add("When backend returns toll/no-toll options, picker shown via `routeAlternatives` + `onSelectRouteAlternative`.")
    add()
    add("### Wayra compact mode")
    add()
    add("When `wayraChatOpen && !placeCardExpanded`, card uses compact layout (`compact` prop).")
    add()
    add("---")
    add()

    add("## 13. Route Preview")
    add()
    add("### 13.1 Trigger")
    add()
    add("`kickRoutePreview(dest)` called from `selectDestination` and origin changes.")
    add()
    add("### 13.2 Origin resolution order")
    add()
    add("1. Fresh GPS (`buildGpsRouteOrigin`)")
    add("2. User-chosen origin (`routeOrigin` state)")
    add("3. Map center fallback (`buildMapCenterRouteOrigin`)")
    add()
    add("### 13.3 API call")
    add()
    add("```typescript")
    add("// live-routing.ts")
    add('await apiFetch("/live/route-preview", { method: "POST", body: { ... } })')
    add("```")
    add()
    add("### 13.4 Validation")
    add()
    add("- `isLandConnectedDriveRoute()` — blocks ocean routes for drive mode")
    add("- `shouldDrawDriveRouteOnMap()` — controls polyline visibility")
    add("- `soloLiveBlockReason()` — user-facing block messages")
    add()
    add("### 13.5 Distance tiers")
    add()
    add("- Local: ≤ 100 miles (`LOCAL_LIVE_MAX_M`)")
    add("- Far: > 100 miles → route intelligence instead of drive polyline")
    add()
    add("### 13.6 Last-mile walk")
    add()
    add("Drive routes may include dashed walk segment from road end to destination pin.")
    add()
    add("---")
    add()

    add("## 14. Navigation")
    add()
    add("### 14.1 Starting navigation")
    add()
    add("Paths to `split_phase_active`:")
    add("- `handleGetDirections()` from preview card or summary bar Go")
    add("- `handleStartLive()` from setup panel")
    add("- `handleBeginNavigation()` from SoloLiveActivePanel")
    add()
    add("### 14.2 startWazeNavigation sequence")
    add()
    add("1. `setMapViewMode(\"3d\")`")
    add("2. `mapRef.current.setViewMode(\"3d\")`")
    add("3. `mapRef.current.enterNavigationView()` — pitch, bearing, GPS follow")
    add("4. `setLiveStage(\"split_phase_active\")`")
    add("5. `setIsLiveActive(true)`")
    add("6. Route line `active: true`")
    add()
    add("### 14.3 SoloLiveNavigationOverlay")
    add()
    add("Shows: destination name, ETA, speed, trip status controls, end navigation.")
    add()
    add("### 14.4 Ending navigation")
    add()
    add("`handleEndSoloLive()`:")
    add("- Returns to 2D view")
    add("- Sets `liveStage = \"destination_set\"`")
    add("- Clears `isLiveActive`")
    add()
    add("---")
    add()

    add("## 15. LiveMapComponent")
    add()
    add("File: `LiveMapComponent.tsx` (~2,987 lines)")
    add()
    add("### 15.1 LiveMapRef imperative API")
    add()
    ref_methods = [
        "zoomIn / zoomOut / getZoom / setZoom / getMaxZoom",
        "locateUser(forceFresh?)",
        "getUserLocation / getMapCenter / isLiveGpsActive",
        "clearClickedPin",
        "flyToPlace(lat, lng, zoom?)",
        "searchMapLabels(query, anchor, limit?)",
        "supportsLabelSearch()",
        "resetNorth",
        "getBearing / getPitch / getViewMode / setViewMode",
        "enterNavigationView()",
        "fitBounds(bounds)",
        "restoreMapOverlays()",
    ]
    for m in ref_methods:
        add(f"- `{m}`")
    add()
    add("### 15.2 Map events")
    add()
    add("| Event | Callback |")
    add("|-------|----------|")
    add("| click | onMapClick (with queried POI features) |")
    add("| dblclick | onMapDoubleClick |")
    add("| dragstart / wheel / movestart | onMapInteraction(true) |")
    add("| move / moveend | onMapCenterChange |")
    add("| rotate / rotateend | onBearingChange |")
    add("| zoom / zoomend | onZoomChange, onMaxZoomCapChange |")
    add("| load / error / styledata | Internal init + overlay restore |")
    add()
    add("### 15.3 Markers rendered")
    add()
    add("- User GPS dot (pulse, heading cone)")
    add("- Destination / selected place pin")
    add("- Route origin pin (when not GPS)")
    add("- Clicked pin + coordinate overlay")
    add("- Nearby category POI pins")
    add("- Friend locations (when enabled)")
    add("- Saved places (when enabled)")
    add("- Border checkpoint markers on cross-country routes")
    add()
    add("---")
    add()

    add("## 16. Map Base Layers")
    add()
    add("Defined in `@/lib/map-providers` as `LiveMapLayer`:")
    add()
    add("| Layer ID | Description |")
    add("|----------|-------------|")
    add("| street | Standard OSM street map |")
    add("| clean | Reduced clutter (default) |")
    add("| satellite | Satellite imagery |")
    add("| terrain | Esri World Topo terrain |")
    add("| hybrid | Satellite + road labels |")
    add("| dark | Dark night mode |")
    add()
    add("Preference: `localStorage[\"rovvy_live_map_layer\"]`")
    add()
    add("### Globe projection")
    add()
    add("At minimum zoom, map switches to globe view (`live-map-globe.ts`) with optional space background in immersive mode.")
    add()
    add("---")
    add()

    add("## 17. Map Overlay Layers")
    add()
    overlays = [
        ("Travel layer", "live-travel-layer-sync.ts", "rovvy_live_travel_layer", "Highways, main routes, railways"),
        ("Sea routes", "live-sea-routes-sync.ts", "rovvy_live_sea_routes", "Shipping lanes + ferries (static GeoJSON)"),
        ("Cruise routes", "live-sea-routes-sync.ts", "rovvy_live_cruise_routes", "World cruise itineraries"),
        ("Foot routes", "live-foot-routes-sync.ts", "rovvy_live_foot_routes", "OSM trekking trails vector"),
        ("Friends", "live-friend-layer-sync.ts", "rovvy_live_friend_tracking", "Friend GPS markers"),
        ("Saved places", "live-saved-places-layer-sync.ts", "rovvy_live_saved_places_layer", "User + trip saved pins"),
        ("Hybrid roads", "live-hybrid-roads-sync.ts", "(auto with hybrid base)", "Road emphasis on hybrid"),
        ("Active route", "LiveMapComponent internal", "N/A", "Polyline + casing + arrows + walk dash"),
    ]
    add("| Overlay | Sync module | Preference key | Data source |")
    add("|---------|-------------|----------------|-------------|")
    for name, mod, key, src in overlays:
        add(f"| {name} | `{mod}` | `{key}` | {src} |")
    add()
    add("All overlays restored after base layer style switch via `restoreMapOverlays()`.")
    add()
    add("---")
    add()

    add("## 18. Map Controls")
    add()
    add("### LiveMapRightControls (right edge)")
    add("- Compass with bearing indicator")
    add("- Locate me (GPS)")
    add("- Layers panel (base + overlays)")
    add("- 2D / 3D view toggle")
    add("- Sound and notifications toggles (UI state only today)")
    add()
    add("### LiveMapAttributionStrip (bottom)")
    add("- Current coordinates")
    add("- Tile attribution (CARTO · OSM)")
    add("- Zoom slider (`LiveStripZoomScale`)")
    add("- Immersive fullscreen toggle")
    add()
    add("### LiveMapNoticeStack")
    add("- Toast messages")
    add("- Status pill (Live not started / Place selected / Destination set / Navigating)")
    add("- Cross-border alert")
    add("- Origin pick mode indicator")
    add()
    add("---")
    add()

    add("## 19. GPS and Location")
    add()
    add("### GpsState (live-gps.ts)")
    add()
    add("```typescript")
    add("// Simplified")
    add("type GpsStatus = \"idle\" | \"requesting\" | \"active\" | \"approximate\" | \"denied\" | \"unavailable\" | \"stale\";")
    add("```")
    add()
    add("### GPS marker modes")
    add("- Browse: blue pulse dot")
    add("- Live active: enhanced pulse")
    add("- Navigating: heading cone + motion styling")
    add()
    add("### Search anchor resolution")
    add("1. Fresh GPS fix")
    add("2. Map center")
    add("3. Click bias / destination bias when navigating")
    add()
    add("---")
    add()

    add("## 20. Wayra Integration")
    add()
    add("### Events (from @/lib/open-wayra and @/lib/wayra/live-map-context)")
    add()
    add("| Event | Direction | Purpose |")
    add("|-------|-----------|---------|")
    add("| WAYRA_MAP_FOCUS_EVENT | Wayra → Live | Fly map to place, selectDestination |")
    add("| WAYRA_CONTEXT_EVENT | Live → Wayra | Push place/route/GPS context |")
    add("| emitOpenWayra | Live → Wayra | Open chat with prompt |")
    add("| emitClearWayraContext | Live → Wayra | Clear bound location |")
    add("| emitWayraPlacePicked | Live → Wayra | Attach place to chat |")
    add("| minimize-rovvy-lounge | Live → Layout | Collapse lounge when place selected |")
    add()
    add("### Context scopes dispatched")
    add("- `place_preview`, `destination`, `gps_only`, `trip`")
    add()
    add("### UI integration")
    add("- `useWayraPanelOpen()` adjusts preview card width")
    add("- `LiveAiSuggestionsBlock` renders Ask Wayra chips")
    add("- Route failures can auto-open Wayra with error context")
    add()
    add("---")
    add()

    add("## 21. Travel Tab Handoff")
    add()
    add("Module: `live-travel-handoff.ts` wraps `@/lib/travel-handoff`.")
    add()
    add("```typescript")
    add('buildTravelHandoffPath(kind, target, origin)')
    add("// kind: \"plan\" | \"flights\" | \"routes\" | \"buses\"")
    add("```")
    add()
    add("Used when:")
    add("- User selects public transport vehicle preference")
    add("- Long-distance route intelligence option selected")
    add("- Preview card \"Plan trip\" action")
    add()
    add("---")
    add()

    add("## 22. Trip Context")
    add()
    add("URL: `/live?trip_id={uuid}`")
    add()
    add("Fetches:")
    add("- `GET /trips/{id}` → trip name, dates, metadata")
    add("- `GET /trips/{id}/locations` → saved trip places")
    add()
    add("Trip places merge into `visibleSavedPlaces` for map layer display.")
    add()
    add("---")
    add()

    add("## 23. Backend API Reference")
    add()
    apis = [
        ("GET", "/search/places", "live-geocoding.ts", "Primary autocomplete"),
        ("GET", "/geocoding/search", "live-geocoding.ts", "Fallback forward geocode"),
        ("GET", "/geocoding/reverse", "live-geocoding.ts, page.tsx", "Reverse geocode tap/pin"),
        ("GET", "/geocoding/display-name", "live-place-name-i18n.ts", "Transliteration enrichment"),
        ("GET", "/places/nearby", "page.tsx", "Category POI search"),
        ("GET", "/places/wiki-summary", "PlacePreviewCard.tsx", "Wikipedia About tab"),
        ("POST", "/live/route-preview", "live-routing.ts", "Route geometry + alternatives"),
        ("POST", "/live/directions/start", "live-preview-actions.ts", "Start nav session (optional backend)"),
        ("POST", "/live/places/add-location", "live-preview-actions.ts", "Save pin to account"),
        ("POST", "/live/places/media/resolve", "live-place-media.ts", "Lazy media/tags lookup"),
        ("POST", "/live/ai/place-explanation", "live-rovi.ts", "Rovi AI place explanation"),
        ("POST", "/route-intelligence/explain", "route-intelligence.ts", "Long-distance options"),
        ("GET", "/trips/{id}", "page.tsx", "Trip context"),
        ("GET", "/trips/{id}/locations", "page.tsx", "Trip places"),
        ("POST", "/auth/login", "InlineSignInModal.tsx", "Inline sign-in"),
    ]
    add("| Method | Endpoint | Frontend caller | Purpose |")
    add("|--------|----------|-----------------|---------|")
    for method, ep, caller, purpose in apis:
        add(f"| {method} | `{ep}` | {caller} | {purpose} |")
    add()
    add("All calls use `apiFetch` from `@/lib/safe-fetch` (NOT `@/lib/api.ts`).")
    add()
    add("---")
    add()

    add("## 24. Backend Services")
    add()
    add("| Python module | Route file | Responsibility |")
    add("|---------------|------------|----------------|")
    add("| live_routing_service.py | live_routing.py | Google Routes + OSRM route preview |")
    add("| live_preview_action_service.py | live_preview_actions.py | Directions start, add location |")
    add("| live_ai_service.py | live_ai.py | Place explanation (Rovi) |")
    add("| live_location_context_service.py | (internal) | Location context for AI |")
    add("| live_search_taxonomy_service.py | (internal) | Search category taxonomy |")
    add()
    add("Model: `app/models/live_session.py` — live session persistence (optional nav sessions).")
    add()
    add("---")
    add()

    add("## 25. localStorage Preferences")
    add()
    prefs = [
        ("rovvy_live_map_layer", "Base map layer ID"),
        ("rovvy_live_travel_layer", "Travel overlay enabled (\"1\")"),
        ("rovvy_live_sea_routes", "Sea routes overlay"),
        ("rovvy_live_cruise_routes", "Cruise routes overlay"),
        ("rovvy_live_foot_routes", "Foot/trek overlay"),
        ("rovvy_live_friend_tracking", "Friend markers overlay"),
        ("rovvy_live_saved_places_layer", "Saved places overlay"),
        ("rovvy_live_saved_places_v1", "JSON array of saved places"),
        ("rovvy.live.recentSearches.v1", "Recent searches (anonymous)"),
        ("rovvy.live.recentSearches.v1:{userId}", "Recent searches (per user)"),
        ("rovvy_live_preview_panel_size_v1", "Preview panel width/height"),
        ("gt_token", "JWT (via auth, not Live-specific)"),
        ("gt_user_name", "Display name after inline login"),
    ]
    add("| Key | Purpose |")
    add("|-----|---------|")
    for k, p in prefs:
        add(f"| `{k}` | {p} |")
    add()
    add("---")
    add()

    add("## 26. UI Panel Visibility Matrix")
    add()
    panels = [
        ("Hero search + dropdown", "!isNavigating", "page.tsx"),
        ("Setup panel", "showSetupPanel", "page.tsx"),
        ("Nearby category list", "nearbyCategory && !selectedPlace", "page.tsx"),
        ("PlacePreviewCard", "showPlacePreview", "PlacePreviewCard.tsx"),
        ("LiveRouteSummaryBar", "showRouteSummaryBar", "LiveRouteSummaryBar.tsx"),
        ("LiveRouteOriginSetup", "showOriginSetup", "LiveRouteOriginSetup.tsx"),
        ("RoviRouteIntelligencePanel", "isLongDistancePreview && destination", "RoviRouteIntelligencePanel.tsx"),
        ("SoloLiveActivePanel", "showSoloLivePanel (rare)", "SoloLiveActivePanel.tsx"),
        ("SoloLiveNavigationOverlay", "showNavigationOverlay", "SoloLiveNavigationOverlay.tsx"),
        ("LiveMapLocationSheet", "mapLocationSheet != null", "LiveMapLocationSheet.tsx"),
        ("LiveMiniHud", "isLiveActive", "LiveMiniHud.tsx"),
        ("InlineSignInModal", "showSignInModal", "InlineSignInModal.tsx"),
        ("SavedPlacePanel", "activeSavedPlaceId", "SavedPlacePanel.tsx"),
        ("FarAwayPlacePanel", "showFarAwayPanel (hardcoded false)", "FarAwayPlacePanel.tsx"),
        ("LiveMapAttributionStrip", "always", "LiveMapAttributionStrip.tsx"),
        ("LiveMapRightControls", "always", "LiveMapRightControls.tsx"),
        ("LiveImmersiveChrome", "always", "LiveImmersiveChrome.tsx"),
    ]
    add("| Panel | Visibility condition | Component |")
    add("|-------|---------------------|-----------|")
    for panel, cond, comp in panels:
        add(f"| {panel} | `{cond}` | {comp} |")
    add()
    add("---")
    add()

    add("## 27. Event Bus")
    add()
    add("### Custom DOM events")
    add()
    add("| Event | Dispatched from | Listened by |")
    add("|-------|-----------------|-------------|")
    add("| rovvy-live-chrome | live-immersive-chrome.ts | dashboard layout.tsx |")
    add("| WAYRA_MAP_FOCUS_EVENT | Wayra | page.tsx |")
    add("| WAYRA_CONTEXT_EVENT | page.tsx | Wayra panel |")
    add("| SAVED_PLACES_CHANGED_EVENT | live-saved-places-store.ts | useLiveSavedPlaces |")
    add("| minimize-rovvy-lounge | page.tsx | Lounge layout |")
    add()
    add("---")
    add()

    add("## 28. Complete File Inventory")
    add()
    add(f"All {len(files)} files under `frontend/app/(dashboard)/live/`:")
    add()

    by_layer: dict[str, list[str]] = {}
    for rel in files:
        layer = classify(rel)
        by_layer.setdefault(layer, []).append(rel)

    for layer in ["component", "sync", "hook", "module", "test", "other"]:
        items = by_layer.get(layer, [])
        if not items:
            continue
        add(f"### 28.{list(by_layer.keys()).index(layer)+1} {layer.title()} layer ({len(items)} files)")
        add()
        for rel in items:
            desc = FILE_DESCRIPTIONS.get(Path(rel).name, "See source file for details.")
            add(f"#### `{rel}`")
            add()
            add(desc)
            add()
        add()

    add("---")
    add()

    add("## 29. Test Coverage")
    add()
    add("Frontend tests in `__tests__/` (Vitest):")
    add()
    test_files = [f for f in files if f.startswith("__tests__/")]
    for tf in test_files:
        add(f"- `{tf}`")
    add()
    add("Run: `cd frontend && npx vitest run app/(dashboard)/live`")
    add()
    add("---")
    add()

    add("## 30. Known Gaps and Legacy Code")
    add()
    add("| Item | Status | Notes |")
    add("|------|--------|-------|")
    add("| FarAwayPlacePanel | Disabled | `showFarAwayPanel = false` hardcoded |")
    add("| SoloRoutePreviewPanel | Orphan | Not imported by page.tsx |")
    add("| solo_drive_command stage | Unused path | Handlers use split_phase_active |")
    add("| Group Travel / Seat Share | Phase stubs | Toast only on Start Live |")
    add("| Train/Bus/Air/Ship modes | Phase 2 UI | Disabled with toast |")
    add("| Firebase RTDB | Not connected | Comment-only in live-place-media.ts |")
    add("| LiveMapDock | Legacy | Superseded by LiveMapRightControls |")
    add("| DEV_SHOW_MOCK_FRIENDS | false | Friend layer uses empty array |")
    add()
    add("---")
    add()

    add("## 31. Development Guide")
    add()
    add("### 31.1 Local setup")
    add()
    add("1. Start backend: FastAPI on configured port")
    add("2. Start frontend: `cd frontend && npm run dev`")
    add("3. Open `http://localhost:3000/live`")
    add("4. Set `NEXT_PUBLIC_CARTO_API_KEY` in frontend env to remove tile watermarks")
    add()
    add("### 31.2 Adding a new map overlay")
    add()
    add("1. Create `live-{name}-sync.ts` with `sync{Name}Overlay(map, data)`")
    add("2. Add preference module `live-{name}-preference.ts` if toggle needed")
    add("3. Call sync from `LiveMapComponent.restoreOverlaysRef`")
    add("4. Add toggle to `LiveMapRightControls` layers panel")
    add("5. Wire state in `page.tsx`")
    add()
    add("### 31.3 Adding a new Live API endpoint")
    add()
    add("1. Add schema in `app/schemas/`")
    add("2. Add service in `app/services/`")
    add("3. Add route in `app/routes/`")
    add("4. Register router in `app/main.py`")
    add("5. Add network module in live folder (apiFetch only)")
    add("6. Call from page.tsx handler — not from LiveMapComponent")
    add()
    add("### 31.4 Do NOT modify")
    add()
    add("- `frontend/lib/api.ts`")
    add("- `frontend/lib/auth.ts`")
    add("- `.env` files")
    add()
    add("---")
    add()

    add("## 32. Appendix — Flow Diagrams")
    add()
    add("### 32.1 Place search to navigation")
    add()
    add("```")
    add("User types in hero search")
    add("  → debounce 150ms")
    add("  → liveAutocompleteSearch (/search/places)")
    add("  → user clicks result")
    add("  → selectPlace → selectDestination")
    add("  → liveStage = place_preview")
    add("  → kickRoutePreview → POST /live/route-preview")
    add("  → routePreviewStatus = ready")
    add("  → LiveRouteSummaryBar shows Go")
    add("  → user clicks Go")
    add("  → handleGetDirections → startWazeNavigation")
    add("  → liveStage = split_phase_active")
    add("  → SoloLiveNavigationOverlay visible")
    add("```")
    add()
    add("### 32.2 Setup panel Start Live")
    add()
    add("```")
    add("User opens setup panel (TravelModeChip)")
    add("  → selects Drive + Solo")
    add("  → sets destination via search")
    add("  → route preview loads")
    add("  → if !user: \"Sign in to start\"")
    add("  → if user: \"Start Solo Live\" enabled")
    add("  → handleStartLive → startWazeNavigation")
    add("```")
    add()
    add("### 32.3 Long-distance destination")
    add()
    add("```")
    add("selectDestination (far place > 100mi)")
    add("  → handleMakeDestination")
    add("  → shouldOpenRouteIntelligence = true")
    add("  → liveStage = long_distance_preview")
    add("  → fetchRouteIntelligence")
    add("  → RoviRouteIntelligencePanel shows flight/train/bus options")
    add("  → user selects option → handleOpenTravelTab")
    add("```")
    add()
    add("---")
    add()

    add("## 33. Appendix — Type Reference")
    add()
    types_ref = [
        ("LiveStage", "7-stage session state machine"),
        ("GroundTravelMode", "Drive | Bike | Trek | Walk"),
        ("ExtendedTravelMode", "Ground + Train/Bus/Air/Ship"),
        ("VehiclePreference", "private | public"),
        ("RouteOrigin", "Origin with source: gps|search|map_pick|map_center"),
        ("RouteLine", "Polyline geometry + duration + last-mile + borders"),
        ("RouteAlternative", "Toll/no-toll alternate routes"),
        ("RoutePreviewStatus", "idle | loading | ready | failed"),
        ("PlacePreviewData", "Place card data shape"),
        ("SplitPhaseActivity", "Active session metadata"),
        ("TripStatus", "on_the_way | stopping | reached | running_late"),
        ("GpsState", "GPS watch state + accuracy"),
        ("LiveMapLayer", "Base layer enum from map-providers"),
        ("LiveMapRef", "Imperative map API"),
        ("FriendLocation", "Friend marker data"),
        ("LiveSavedPlace", "Local saved place record"),
    ]
    add("| Type | Description |")
    add("|------|-------------|")
    for t, d in types_ref:
        add(f"| `{t}` | {d} |")
    add()
    add("Full definitions: `live-types.ts`, `PlacePreviewCard.tsx`, `live-gps.ts`, `@/lib/map-providers`.")
    add()
    add("---")
    add()

    add("## 34. Appendix — Handler Index")
    add()
    handlers_full = [
        "selectDestination", "clearSelectedPlace", "handleClosePlaceDetails",
        "handleMakeDestination", "handleChangeDestination", "handleContinueFromPreview",
        "handleContinueAnyway", "kickRoutePreview", "loadRoutePreview",
        "handleSelectRouteAlternative", "resolveRoutePreviewOrigin",
        "handleGetDirections", "handleStartPreviewDirection", "handleStartLive",
        "handleStartSoloLive", "handleStartFromPlacePreview", "handleBeginNavigation",
        "startWazeNavigation", "handleEndSoloLive", "handleMapClick", "handleMapDoubleClick",
        "handleNearbySearch", "handleCloseNearbyResults", "handleResultClick",
        "selectPlace", "handleInstantSuggestionClick", "handleLocateClick",
        "handleUseMapArea", "handleLayerChange", "handleTravelLayerChange",
        "handleSeaRoutesChange", "handleCruiseRoutesChange", "handleFootRoutesChange",
        "handleFriendTrackingChange", "handleSavedPlacesLayerChange", "handleToggleViewMode",
        "toggleLiveImmersive", "handleOpenTravelTab", "handlePlanTrip",
        "handleAskWayraFromPreview", "handleSavePlaceLocally", "handleSavedPlaceSelect",
        "handleSelectRouteIntelligenceOption", "handleUseCurrentLocationOrigin",
        "handleUseMapCenterOrigin", "handleStartOriginPick", "handleSearchOriginSelect",
        "handleSheetSetStartingPoint", "handleSheetSetDestination", "handleSheetAddStop",
        "handleSheetCopyCoordinates", "handleSheetSavePlace", "closeMapLocationSheet",
        "handleAddStopFromPreview", "handleAddStopFromLive", "showToast",
    ]
    for i, h in enumerate(handlers_full, 1):
        add(f"{i}. `{h}` — see `page.tsx`")
    add()
    add("---")
    add()
    add("## Document History")
    add()
    add(f"| Date | Author | Change |")
    add(f"|------|--------|--------|")
    add(f"| {today} | Cursor Agent | Initial comprehensive Live tab documentation for redevelopment |")
    add()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {len(lines)} lines to {OUT}")


if __name__ == "__main__":
    main()
