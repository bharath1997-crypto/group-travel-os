# Rovvy Live Tab — Technical Documentation

> **Document version:** 1.0  
> **Last updated:** 2026-09-12  
> **Route:** `http://localhost:3000/live` (production: `https://rovvy.app/live`)  
> **Primary source:** `frontend/app/(dashboard)/live/` (118 files)  
> **Purpose:** Comprehensive reference for the Live tab redevelopment.  
> **Design target:** See [Rovvy_Live_v2_Design_Review.md](./Rovvy_Live_v2_Design_Review.md) and [design/Rovvy_Live_v2_reference.html](./design/Rovvy_Live_v2_reference.html).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Screenshot Walkthrough](#2-screenshot-walkthrough)
3. [Product Roadmap Phases](#3-product-roadmap-phases)
4. [Route and Layout Integration](#4-route-and-layout-integration)
5. [Architecture Overview](#5-architecture-overview)
6. [Frontend Layering Model](#6-frontend-layering-model)
7. [LiveStage State Machine](#7-livestage-state-machine)
8. [page.tsx Orchestrator](#8-page.tsx-orchestrator)
9. [Travel Mode and Workflow](#9-travel-mode-and-workflow)
10. [Setup Panel](#10-setup-panel)
11. [Search System](#11-search-system)
12. [Place Preview Card Tabs](#12-place-preview-card-tabs)
13. [Route Preview](#13-route-preview)
14. [Navigation](#14-navigation)
15. [LiveMapComponent](#15-livemapcomponent)
16. [Map Base Layers](#16-map-base-layers)
17. [Map Overlay Layers](#17-map-overlay-layers)
18. [Map Controls](#18-map-controls)
19. [GPS and Location](#19-gps-and-location)
20. [Wayra Integration](#20-wayra-integration)
21. [Travel Tab Handoff](#21-travel-tab-handoff)
22. [Trip Context](#22-trip-context)
23. [Backend API Reference](#23-backend-api-reference)
24. [Backend Services](#24-backend-services)
25. [localStorage Preferences](#25-localstorage-preferences)
26. [UI Panel Visibility Matrix](#26-ui-panel-visibility-matrix)
27. [Event Bus](#27-event-bus)
28. [Complete File Inventory](#28-complete-file-inventory)
29. [Test Coverage](#29-test-coverage)
30. [Known Gaps](#30-known-gaps)
31. [Development Guide](#31-development-guide)
32. [Appendix — Flow Diagrams](#32-appendix--flow-diagrams)
33. [Appendix — Type Reference](#33-appendix--type-reference)
34. [Appendix — Handler Index](#34-appendix--handler-index)

---

## 1. Executive Summary

The **Live tab** is Rovvy's map-first real-time navigation product. It occupies the full viewport below the global dashboard header. All product UI floats as glass panels over a MapLibre GL JS canvas using OpenStreetMap-derived tiles.

### Key facts

| Item | Value |
|------|-------|
| Entry file | `frontend/app/(dashboard)/live/page.tsx` |
| Map engine | MapLibre GL JS 5.x |
| Tile provider | CARTO basemaps (OSM data) |
| Routing backend | FastAPI `LiveRoutingService` (Google Routes + OSRM fallback) |
| Auth model | Browse-first; JWT required only to **Start Live** |
| Default workflow | Solo |
| Default travel mode | Drive |
| Module count | 118 files in live folder |

### What works without login

- Pan/zoom map, switch layers
- Search places (requires GPS or map center anchor)
- Category nearby search (beaches, airports, etc.)
- Place preview card with Wikipedia About
- Route preview on map
- Map tap → location sheet

### What requires login

- **Start Solo Live** from setup panel
- Account sync for `addLivePreviewLocation` (falls back to local-only on 401)

---

## 2. Screenshot Walkthrough

The redevelopment screenshot shows **`static_landing`** with the **setup panel** open.

### 2.1 Visible UI elements mapped to code

| Screenshot element | React component / state |
|--------------------|-------------------------|
| Hero search pill | Search input in `page.tsx` + `TravelModeChip` |
| "Search places, stops, meet points" | `searchQuery` placeholder |
| Suggestions button | `setShowSuggestionsCard(true)` |
| TRAVEL MODE grid (Drive selected) | Setup panel — `EXTENDED_TRAVEL_MODES.map()` |
| WORKFLOW (Solo selected) | `WORKFLOW_TYPES.map()` → `workflowType` |
| DESTINATION "No destination set" | `destination` is null |
| Set button | Focuses search, closes setup panel |
| "Sign in to start" | `!user` branch in setup panel action area |
| Dark map with API KEY watermarks | CARTO tiles without valid `NEXT_PUBLIC_CARTO_API_KEY` |
| Compass (bottom-left) | `LiveMapRightControls` compass section |
| Layers/zoom/locate (bottom-right) | `LiveMapRightControls` + `LiveMapAttributionStrip` |
| Coordinates bar | `LiveMapAttributionStrip` — `formatMapCoordinates()` |
| Global header Live tab active | `LiveHeaderNavTab` in dashboard layout |

### 2.2 Initial state on page load

1. `liveStage = "static_landing"`
2. `showSetupPanel` may be false until user clicks TravelModeChip
3. Map loads with saved layer preference (`loadLiveMapLayerPreference()` → default `"clean"`)
4. GPS watch starts inside `LiveMapComponent` on mount
5. Recent searches loaded from localStorage
6. If `?trip_id=` present, trip context fetched asynchronously

---

## 3. Product Roadmap Phases

| Phase | Live tab scope | Status |
|-------|----------------|--------|
| L1 | Fullscreen map, GPS dot, day/night | Complete |
| L2 | Reports, hazards, voting | Not started |
| L3 | Traffic, weather, POI search | POI/category search live |
| L4 | Routing, navigation | Solo drive nav complete |
| L5 | Route chat | Not started |
| L6 | Group travel | Workflow UI only (toast on start) |
| L7 | Convoy / Seat Share | Workflow UI only (toast on start) |
| L8 | Wayra AI | Preview suggestions + messenger integration |

---

## 4. Route and Layout Integration

### 4.1 File routing

```
frontend/app/(dashboard)/live/page.tsx  →  GET /live
```

### 4.2 Dashboard layout (`layout.tsx`)

When `pathname === "/live"`:
- Adds `live-mode` class to `documentElement` and `body`
- Sets `--rovvy-header-h` CSS variable
- Uses `dashboard-main-live` class: `p-0`, `overflow-hidden`, transparent background
- Renders `LiveHeaderNavTab` instead of plain nav link for Live section
- Listens for `rovvy-live-chrome` custom event to hide bottom nav in immersive mode

### 4.3 Live page shell positioning

```tsx
<div className="live-page-shell fixed inset-x-0 bottom-0" style={{ top: "var(--rovvy-header-h)" }}>
```

This ensures the map fills all space below the sticky header without double scrollbars.

### 4.4 Dynamic map import

```tsx
const LiveMapComponent = dynamic(() => import("./LiveMapComponent"), { ssr: false });
```

MapLibre requires browser APIs; server-side rendering is disabled.

---

## 5. Architecture Overview

```mermaid
flowchart TB
  subgraph Dashboard
    Layout[layout.tsx]
    Header[Global Header + LiveHeaderNavTab]
  end
  subgraph LivePage[page.tsx]
    State[React State + Handlers]
    Search[Hero Search UI]
    Panels[Floating Panels]
  end
  subgraph MapLayer[LiveMapComponent]
    ML[MapLibre GL]
    GPS[GPS Watch]
    Sync[Overlay Sync Modules]
  end
  subgraph Backend[FastAPI]
    Route[/live/route-preview]
    Geo[/geocoding/*]
    Places[/places/nearby]
    AI[/live/ai/*]
  end
  Layout --> LivePage
  State --> MapLayer
  State --> Backend
  Search --> Geo
  Panels --> AI
```

Data flows **down** via props to `LiveMapComponent` and **up** via callbacks (`onMapClick`, `onGpsStateChange`, etc.). Business logic lives in `page.tsx` handlers and pure `live-*.ts` modules — not in the map component.

---

## 6. Frontend Layering Model

| Layer | Files | Import rules |
|-------|-------|--------------|
| Components | 32 `.tsx` files | May import anything except avoid maplibre in non-map files |
| Sync | 6 `*-sync.ts` | Import maplibre; NO apiFetch |
| Hooks | 2 `use-live-*.ts` | Compose stores and UI state |
| Pure modules | ~40 `live-*.ts` | NO maplibre-gl import |
| Network | routing, geocoding, rovi, etc. | apiFetch only |
| Tests | 19 files in `__tests__/` | Vitest unit tests |

---

## 7. LiveStage State Machine

Source: `live-types.ts`

```typescript
export type LiveStage =
  | "static_landing"
  | "place_preview"
  | "destination_set"
  | "long_distance_preview"
  | "solo_drive_command"
  | "solo_drive_navigation"
  | "split_phase_active";
```

### Transition table

| From | Event | To | Handler |
|------|-------|-----|---------|
| static_landing | Select place | place_preview | selectDestination |
| place_preview | Make destination (local) | destination_set | handleMakeDestination |
| place_preview | Make destination (far) | long_distance_preview | handleMakeDestination |
| destination_set | Go / Start Live | split_phase_active | handleGetDirections / handleStartLive |
| split_phase_active | End navigation | destination_set | handleEndSoloLive |
| any | Clear place | static_landing | clearSelectedPlace |

### isActiveNavigationStage

Returns true for `solo_drive_navigation` OR `split_phase_active`. Triggers:
- Hide hero search
- Show `SoloLiveNavigationOverlay`
- Map `navigationMode={true}`
- `enterNavigationView()` on map ref

**Note:** Current handlers set `split_phase_active` for navigation, not `solo_drive_navigation`.

---

## 8. page.tsx Orchestrator

The orchestrator is the single largest file in the Live tab. It coordinates ~50 pieces of React state, 30+ handler functions, and conditional rendering of 15+ overlay panels.

### 8.1 URL parameters

| Param | Example | Effect |
|-------|---------|--------|
| trip_id | `/live?trip_id=abc-123` | Fetches trip + locations; merges trip places into saved places layer |

### 8.2 Auth integration

- `useDashboardUser()` from `@/contexts/dashboard-user-context`
- `getToken()` from `@/lib/auth` for authenticated API calls
- `InlineSignInModal` posts to `/auth/login`, saves JWT as `gt_token`

### 8.3 Derived visibility flags

| Flag | Formula (simplified) |
|------|---------------------|
| showPlacePreview | !isLiveActive && selectedPlace && showPlaceDetailsPanel |
| showRouteSummaryBar | !isLiveActive && (place_preview \|\| destination_set) && !showPlaceDetailsPanel |
| showNavigationOverlay | isLiveActive && isActiveNavigationStage(liveStage) |
| isLongDistancePreview | liveStage === "long_distance_preview" |
| isNavigating | isActiveNavigationStage(liveStage) |

---

## 9. Travel Mode and Workflow

### 9.1 Ground travel modes

```typescript
const TRAVEL_MODES = ["Drive", "Bike", "Trek", "Walk"] as const;
```

Sent to backend in route preview request. Affects last-mile walk segment for Drive arrivals.

### 9.2 Extended modes (Phase 2 placeholders)

Train, Bus, Air, Ship appear in setup panel UI via `EXTENDED_TRAVEL_MODES` but are disabled with toast.

### 9.3 Vehicle preference

- `private` — Solo Live routing on map
- `public` — Opens Travel tab / route intelligence instead of drive route

### 9.4 Workflow types

| Workflow | Start Live | Navigation |
|----------|------------|------------|
| Solo | Enabled when route ready | Full 3D nav |
| Group Travel | Toast Phase 2 | N/A |
| Seat Share | Toast Phase 3 | N/A |

---

## 10. Setup Panel

Opened via `TravelModeChip` click → `setShowSetupPanel(true)`.

### Sections
1. **Travel Mode** — 4×2 grid from `EXTENDED_TRAVEL_MODES`
2. **Workflow** — 3-column grid from `WORKFLOW_TYPES`
3. **Destination** — shows committed destination or Set link
4. **Action** — Sign in OR Start {Workflow} Live button

Start button disabled when:
- `routePreviewStatus !== "ready"`
- `!activeRoute`
- `routeLoading === true`

---

## 11. Search System

### 11.1 Hero search bar

- Debounce: `SEARCH_DEBOUNCE_MS = 150` (in live-geocoding.ts)
- Minimum query length: 2 characters for API search
- Anchor required: fresh GPS or map center

### 11.2 Autocomplete pipeline

1. `liveAutocompleteSearch()` → `GET /search/places`
2. Fallback → `GET /geocoding/search`
3. Merge with map label search via `mergeAutocompleteResults()`
4. `selectPlace()` → `autocompleteResultToPlacePreview()` → `selectDestination()`

### 11.3 Category search

- Taxonomy: `frontend/data/live_search_taxonomy.json`
- `resolveLiveSearchCategory(query)` matches keywords
- `handleNearbySearch()` → `GET /places/nearby`
- Results shown in list panel + POI pins on map

### 11.4 Recent searches

- Storage key: `rovvy.live.recentSearches.v1` or per-user variant
- Types: place, category_search, destination, dropped_pin
- `filterInstantSuggestions()` powers Suggestions dropdown

### 11.5 Pasted location

`parsePastedLocation()` handles Google Maps URLs and lat/lng strings.

---

## 12. Place Preview Card Tabs

Component: `PlacePreviewCard.tsx`

### Tabs

| Tab | ID | Content |
|-----|-----|---------|
| Guide | guide | Actions, route preview, AI suggestions, nearby at click |
| About | about | Wikipedia via `PlaceWikiAboutSection` → `/places/wiki-summary` |
| Info | info | Address, hours, phone, tags, trust badges |

### Key actions on Guide tab

| Button | Handler |
|--------|---------|
| Make destination | onMakeDestination |
| Get directions | onGetDirections |
| Start direction | onStartDirection |
| Start Live | onStartLive |
| Ask Wayra | onAskRovi → emitOpenWayra |
| Open Travel tab | onOpenTravelTab |
| Save place | onSavePlace → localStorage |

### Route alternatives

When backend returns toll/no-toll options, picker shown via `routeAlternatives` + `onSelectRouteAlternative`.

### Wayra compact mode

When `wayraChatOpen && !placeCardExpanded`, card uses compact layout (`compact` prop).

---

## 13. Route Preview

### 13.1 Trigger

`kickRoutePreview(dest)` called from `selectDestination` and origin changes.

### 13.2 Origin resolution order

1. Fresh GPS (`buildGpsRouteOrigin`)
2. User-chosen origin (`routeOrigin` state)
3. Map center fallback (`buildMapCenterRouteOrigin`)

### 13.3 API call

```typescript
// live-routing.ts
await apiFetch("/live/route-preview", { method: "POST", body: { ... } })
```

### 13.4 Validation

- `isLandConnectedDriveRoute()` — blocks ocean routes for drive mode
- `shouldDrawDriveRouteOnMap()` — controls polyline visibility
- `soloLiveBlockReason()` — user-facing block messages

### 13.5 Distance tiers

- Local: ≤ 100 miles (`LOCAL_LIVE_MAX_M`)
- Far: > 100 miles → route intelligence instead of drive polyline

### 13.6 Last-mile walk

Drive routes may include dashed walk segment from road end to destination pin.

---

## 14. Navigation

### 14.1 Starting navigation

Paths to `split_phase_active`:
- `handleGetDirections()` from preview card or summary bar Go
- `handleStartLive()` from setup panel
- `handleBeginNavigation()` from SoloLiveActivePanel

### 14.2 startWazeNavigation sequence

1. `setMapViewMode("3d")`
2. `mapRef.current.setViewMode("3d")`
3. `mapRef.current.enterNavigationView()` — pitch, bearing, GPS follow
4. `setLiveStage("split_phase_active")`
5. `setIsLiveActive(true)`
6. Route line `active: true`

### 14.3 SoloLiveNavigationOverlay

Shows: destination name, ETA, speed, trip status controls, end navigation.

### 14.4 Ending navigation

`handleEndSoloLive()`:
- Returns to 2D view
- Sets `liveStage = "destination_set"`
- Clears `isLiveActive`

---

## 15. LiveMapComponent

File: `LiveMapComponent.tsx` (~2,987 lines)

### 15.1 LiveMapRef imperative API

- `zoomIn / zoomOut / getZoom / setZoom / getMaxZoom`
- `locateUser(forceFresh?)`
- `getUserLocation / getMapCenter / isLiveGpsActive`
- `clearClickedPin`
- `flyToPlace(lat, lng, zoom?)`
- `searchMapLabels(query, anchor, limit?)`
- `supportsLabelSearch()`
- `resetNorth`
- `getBearing / getPitch / getViewMode / setViewMode`
- `enterNavigationView()`
- `fitBounds(bounds)`
- `restoreMapOverlays()`

### 15.2 Map events

| Event | Callback |
|-------|----------|
| click | onMapClick (with queried POI features) |
| dblclick | onMapDoubleClick |
| dragstart / wheel / movestart | onMapInteraction(true) |
| move / moveend | onMapCenterChange |
| rotate / rotateend | onBearingChange |
| zoom / zoomend | onZoomChange, onMaxZoomCapChange |
| load / error / styledata | Internal init + overlay restore |

### 15.3 Markers rendered

- User GPS dot (pulse, heading cone)
- Destination / selected place pin
- Route origin pin (when not GPS)
- Clicked pin + coordinate overlay
- Nearby category POI pins
- Friend locations (when enabled)
- Saved places (when enabled)
- Border checkpoint markers on cross-country routes

---

## 16. Map Base Layers

Defined in `@/lib/map-providers` as `LiveMapLayer`:

| Layer ID | Description |
|----------|-------------|
| street | Standard OSM street map |
| clean | Reduced clutter (default) |
| satellite | Satellite imagery |
| terrain | Esri World Topo terrain |
| hybrid | Satellite + road labels |
| dark | Dark night mode |

Preference: `localStorage["rovvy_live_map_layer"]`

### Globe projection

At minimum zoom, map switches to globe view (`live-map-globe.ts`) with optional space background in immersive mode.

---

## 17. Map Overlay Layers

| Overlay | Sync module | Preference key | Data source |
|---------|-------------|----------------|-------------|
| Travel layer | `live-travel-layer-sync.ts` | `rovvy_live_travel_layer` | Highways, main routes, railways |
| Sea routes | `live-sea-routes-sync.ts` | `rovvy_live_sea_routes` | Shipping lanes + ferries (static GeoJSON) |
| Cruise routes | `live-sea-routes-sync.ts` | `rovvy_live_cruise_routes` | World cruise itineraries |
| Foot routes | `live-foot-routes-sync.ts` | `rovvy_live_foot_routes` | OSM trekking trails vector |
| Friends | `live-friend-layer-sync.ts` | `rovvy_live_friend_tracking` | Friend GPS markers |
| Saved places | `live-saved-places-layer-sync.ts` | `rovvy_live_saved_places_layer` | User + trip saved pins |
| Hybrid roads | `live-hybrid-roads-sync.ts` | `(auto with hybrid base)` | Road emphasis on hybrid |
| Active route | `LiveMapComponent internal` | `N/A` | Polyline + casing + arrows + walk dash |

All overlays restored after base layer style switch via `restoreMapOverlays()`.

---

## 18. Map Controls

### LiveMapRightControls (right edge)
- Compass with bearing indicator
- Locate me (GPS)
- Layers panel (base + overlays)
- 2D / 3D view toggle
- Sound and notifications toggles (UI state only today)

### LiveMapAttributionStrip (bottom)
- Current coordinates
- Tile attribution (CARTO · OSM)
- Zoom slider (`LiveStripZoomScale`)
- Immersive fullscreen toggle

### LiveMapNoticeStack
- Toast messages
- Status pill (Live not started / Place selected / Destination set / Navigating)
- Cross-border alert
- Origin pick mode indicator

---

## 19. GPS and Location

### GpsState (live-gps.ts)

```typescript
// Simplified
type GpsStatus = "idle" | "requesting" | "active" | "approximate" | "denied" | "unavailable" | "stale";
```

### GPS marker modes
- Browse: blue pulse dot
- Live active: enhanced pulse
- Navigating: heading cone + motion styling

### Search anchor resolution
1. Fresh GPS fix
2. Map center
3. Click bias / destination bias when navigating

---

## 20. Wayra Integration

### Events (from @/lib/open-wayra and @/lib/wayra/live-map-context)

| Event | Direction | Purpose |
|-------|-----------|---------|
| WAYRA_MAP_FOCUS_EVENT | Wayra → Live | Fly map to place, selectDestination |
| WAYRA_CONTEXT_EVENT | Live → Wayra | Push place/route/GPS context |
| emitOpenWayra | Live → Wayra | Open chat with prompt |
| emitClearWayraContext | Live → Wayra | Clear bound location |
| emitWayraPlacePicked | Live → Wayra | Attach place to chat |
| minimize-rovvy-lounge | Live → Layout | Collapse lounge when place selected |

### Context scopes dispatched
- `place_preview`, `destination`, `gps_only`, `trip`

### UI integration
- `useWayraPanelOpen()` adjusts preview card width
- `LiveAiSuggestionsBlock` renders Ask Wayra chips
- Route failures can auto-open Wayra with error context

---

## 21. Travel Tab Handoff

Module: `live-travel-handoff.ts` wraps `@/lib/travel-handoff`.

```typescript
buildTravelHandoffPath(kind, target, origin)
// kind: "plan" | "flights" | "routes" | "buses"
```

Used when:
- User selects public transport vehicle preference
- Long-distance route intelligence option selected
- Preview card "Plan trip" action

---

## 22. Trip Context

URL: `/live?trip_id={uuid}`

Fetches:
- `GET /trips/{id}` → trip name, dates, metadata
- `GET /trips/{id}/locations` → saved trip places

Trip places merge into `visibleSavedPlaces` for map layer display.

---

## 23. Backend API Reference

| Method | Endpoint | Frontend caller | Purpose |
|--------|----------|-----------------|---------|
| GET | `/search/places` | live-geocoding.ts | Primary autocomplete |
| GET | `/geocoding/search` | live-geocoding.ts | Fallback forward geocode |
| GET | `/geocoding/reverse` | live-geocoding.ts, page.tsx | Reverse geocode tap/pin |
| GET | `/geocoding/display-name` | live-place-name-i18n.ts | Transliteration enrichment |
| GET | `/places/nearby` | page.tsx | Category POI search |
| GET | `/places/wiki-summary` | PlacePreviewCard.tsx | Wikipedia About tab |
| POST | `/live/route-preview` | live-routing.ts | Route geometry + alternatives |
| POST | `/live/directions/start` | live-preview-actions.ts | Start nav session (optional backend) |
| POST | `/live/places/add-location` | live-preview-actions.ts | Save pin to account |
| POST | `/live/places/media/resolve` | live-place-media.ts | Lazy media/tags lookup |
| POST | `/live/ai/place-explanation` | live-rovi.ts | Rovi AI place explanation |
| POST | `/route-intelligence/explain` | route-intelligence.ts | Long-distance options |
| GET | `/trips/{id}` | page.tsx | Trip context |
| GET | `/trips/{id}/locations` | page.tsx | Trip places |
| POST | `/auth/login` | InlineSignInModal.tsx | Inline sign-in |

All calls use `apiFetch` from `@/lib/safe-fetch` (NOT `@/lib/api.ts`).

---

## 24. Backend Services

| Python module | Route file | Responsibility |
|---------------|------------|----------------|
| live_routing_service.py | live_routing.py | Google Routes + OSRM route preview |
| live_preview_action_service.py | live_preview_actions.py | Directions start, add location |
| live_ai_service.py | live_ai.py | Place explanation (Rovi) |
| live_location_context_service.py | (internal) | Location context for AI |
| live_search_taxonomy_service.py | (internal) | Search category taxonomy |

Model: `app/models/live_session.py` — live session persistence (optional nav sessions).

---

## 25. localStorage Preferences

| Key | Purpose |
|-----|---------|
| `rovvy_live_map_layer` | Base map layer ID |
| `rovvy_live_travel_layer` | Travel overlay enabled ("1") |
| `rovvy_live_sea_routes` | Sea routes overlay |
| `rovvy_live_cruise_routes` | Cruise routes overlay |
| `rovvy_live_foot_routes` | Foot/trek overlay |
| `rovvy_live_friend_tracking` | Friend markers overlay |
| `rovvy_live_saved_places_layer` | Saved places overlay |
| `rovvy_live_saved_places_v1` | JSON array of saved places |
| `rovvy.live.recentSearches.v1` | Recent searches (anonymous) |
| `rovvy.live.recentSearches.v1:{userId}` | Recent searches (per user) |
| `rovvy_live_preview_panel_size_v1` | Preview panel width/height |
| `gt_token` | JWT (via auth, not Live-specific) |
| `gt_user_name` | Display name after inline login |

---

## 26. UI Panel Visibility Matrix

| Panel | Visibility condition | Component |
|-------|---------------------|-----------|
| Hero search + dropdown | `!isNavigating` | page.tsx |
| Setup panel | `showSetupPanel` | page.tsx |
| Nearby category list | `nearbyCategory && !selectedPlace` | page.tsx |
| PlacePreviewCard | `showPlacePreview` | PlacePreviewCard.tsx |
| LiveRouteSummaryBar | `showRouteSummaryBar` | LiveRouteSummaryBar.tsx |
| LiveRouteOriginSetup | `showOriginSetup` | LiveRouteOriginSetup.tsx |
| RoviRouteIntelligencePanel | `isLongDistancePreview && destination` | RoviRouteIntelligencePanel.tsx |
| SoloLiveActivePanel | `showSoloLivePanel (rare)` | SoloLiveActivePanel.tsx |
| SoloLiveNavigationOverlay | `showNavigationOverlay` | SoloLiveNavigationOverlay.tsx |
| LiveMapLocationSheet | `mapLocationSheet != null` | LiveMapLocationSheet.tsx |
| LiveMiniHud | `isLiveActive` | LiveMiniHud.tsx |
| InlineSignInModal | `showSignInModal` | InlineSignInModal.tsx |
| SavedPlacePanel | `activeSavedPlaceId` | SavedPlacePanel.tsx |
| FarAwayPlacePanel | `showFarAwayPanel (hardcoded false)` | FarAwayPlacePanel.tsx |
| LiveMapAttributionStrip | `always` | LiveMapAttributionStrip.tsx |
| LiveMapRightControls | `always` | LiveMapRightControls.tsx |
| LiveImmersiveChrome | `always` | LiveImmersiveChrome.tsx |

---

## 27. Event Bus

### Custom DOM events

| Event | Dispatched from | Listened by |
|-------|-----------------|-------------|
| rovvy-live-chrome | live-immersive-chrome.ts | dashboard layout.tsx |
| WAYRA_MAP_FOCUS_EVENT | Wayra | page.tsx |
| WAYRA_CONTEXT_EVENT | page.tsx | Wayra panel |
| SAVED_PLACES_CHANGED_EVENT | live-saved-places-store.ts | useLiveSavedPlaces |
| minimize-rovvy-lounge | page.tsx | Lounge layout |

---

## 28. Complete File Inventory

All 118 files under `frontend/app/(dashboard)/live/`:

### 28.1 Component layer (32 files)

#### `FarAwayPlacePanel.tsx`

Alternative panel for far destinations (implemented but disabled via showFarAwayPanel=false).

#### `InlineSignInModal.tsx`

Inline login modal for Start Live auth gate.

#### `LiveAiSuggestionsBlock.tsx`

Wayra AI suggestion chips in place preview.

#### `LiveDataTrustBadge.tsx`

Verified / Area info / AI estimate trust labels.

#### `LiveImmersiveChrome.tsx`

Decorative space/globe chrome for immersive mode.

#### `LiveMapAttributionStrip.tsx`

Bottom strip: coordinates, attribution, zoom, immersive toggle.

#### `LiveMapClickPopup.tsx`

Click popup UI for map interactions.

#### `LiveMapCompass.tsx`

Compass widget.

#### `LiveMapComponent.tsx`

MapLibre map controller. GPS watch, route layers, overlay sync delegation, navigation camera. No business logic.

#### `LiveMapDock.tsx`

Legacy simplified dock (layers, fullscreen, GPS).

#### `LiveMapLayerControl.tsx`

Base map layer picker sub-component.

#### `LiveMapLocationSheet.tsx`

Bottom sheet on map tap: set origin/destination, add stop, copy coords.

#### `LiveMapNoticeStack.tsx`

Toast messages, status pill, cross-border notices.

#### `LiveMapRightControls.tsx`

Right dock: compass, locate, layers panel, 2D/3D toggle, sound/notifications.

#### `LiveMapToolsControl.tsx`

Map tools sub-control.

#### `LiveMapZoomControl.tsx`

Zoom buttons.

#### `LiveMiniHud.tsx`

Top-left HUD during active live session (mode, speed, ETA).

#### `LiveRouteOriginSetup.tsx`

Modal for choosing route origin: GPS, map center, map pick, search.

#### `LiveRouteSummaryBar.tsx`

Compact bottom route summary with duration, Go button, open details.

#### `LiveStripZoomScale.tsx`

Right-edge zoom slider.

#### `PlacePreviewCard.tsx`

Primary place preview panel with Guide/About/Info tabs, route alternatives, Wayra suggestions, action buttons.

#### `PlacePreviewMedia.tsx`

Place photo/media gallery in preview card.

#### `PlaceWikiAboutBlock.tsx`

Wikipedia about content block.

#### `PlaceWikiAboutSection.tsx`

About tab section wrapper with entity-match disclosure.

#### `RoviPlaceExplanationBlock.tsx`

Rovi AI place explanation block.

#### `RoviRouteIntelligencePanel.tsx`

Long-distance multi-modal route options UI (flights, trains, etc.).

#### `SavedPlacePanel.tsx`

Detail panel for a locally saved place.

#### `SoloLiveActivePanel.tsx`

Pre-navigation Solo command panel (shown when liveStage=solo_drive_command — rarely reached).

#### `SoloLiveNavigationOverlay.tsx`

Full-screen Waze-style turn-by-turn navigation overlay during active nav.

#### `SoloRoutePreviewPanel.tsx`

Legacy/orphan route preview panel — not imported by page.tsx.

#### `TravelModeChip.tsx`

Hero search left chip showing travel mode + workflow.

#### `page.tsx`

Main Live page orchestrator (~4,236 lines). Owns all session state, search, route preview, panel visibility, and map props.


### 28.4 Sync layer (6 files)

#### `live-foot-routes-sync.ts`

OSM trekking trails vector overlay.

#### `live-friend-layer-sync.ts`

Friend location markers overlay.

#### `live-hybrid-roads-sync.ts`

Hybrid base layer road emphasis overlay.

#### `live-saved-places-layer-sync.ts`

Saved place pins overlay + click binding.

#### `live-sea-routes-sync.ts`

Shipping lanes, ferries, cruise itineraries GeoJSON overlay.

#### `live-travel-layer-sync.ts`

Sync highways, main routes, railways overlay on map.


### 28.5 Hook layer (2 files)

#### `use-live-preview-panel-resize.ts`

Hook for draggable preview panel dimensions.

#### `use-live-saved-places.ts`

Hook subscribing to saved places store changes.


### 28.3 Module layer (59 files)

#### `live-ai-suggestions.ts`

buildRoutePreviewAiSuggestions for Wayra chips.

#### `live-clean-map-housenumbers.ts`

Clean map house number label styling.

#### `live-dark-map-labels.ts`

Dark layer street label sync.

#### `live-design-tokens.ts`

Tailwind class tokens for search pill, dropdown, section labels.

#### `live-foot-routes-preference.ts`

localStorage for foot/trek overlay.

#### `live-friend-preference.ts`

localStorage for friend tracking layer.

#### `live-geocoding.ts`

Autocomplete, forward/reverse geocoding, debounce, caching.

#### `live-globe-sun.ts`

Sun position calculation for globe lighting.

#### `live-gps-marker.ts`

GPS dot DOM factory, pulse animations, heading cone, globe scale.

#### `live-gps.ts`

GPS state types, logging, status labels, freshness checks.

#### `live-immersive-chrome.ts`

Immersive fullscreen state + custom event dispatch for dashboard layout.

#### `live-layout.ts`

Layout constants: control positions, 2D/3D pitch values, map view mode type.

#### `live-location-context.ts`

buildLocationContext, shouldShowAskRoviAi, distance tiers.

#### `live-map-attribution.ts`

Attribution focus types and formatting.

#### `live-map-globe.ts`

Globe projection at max zoom out, sun lighting, locate zoom resolution.

#### `live-map-labels.ts`

Search visible map labels for autocomplete merge.

#### `live-map-layer-preference.ts`

localStorage for base map layer.

#### `live-map-pick-context.ts`

Coordinate formatting for map pick UI.

#### `live-map-right-controls.ts`

Pure helpers for right controls layout.

#### `live-map-style-switch.ts`

Safe MapLibre style switching with overlay restore.

#### `live-map-tap-coords.ts`

Resolve tap lng/lat from map event.

#### `live-map-zoom-limits.ts`

Min/max zoom caps, red/green limit button colors.

#### `live-maplibre-tile-abort-fix.ts`

Patch for MapLibre 5.x tile abort race crash.

#### `live-marker-elements.ts`

DOM factories for destination, start, clicked pin, border checkpoint markers.

#### `live-meetup-marker.ts`

Meetup pin marker element factory.

#### `live-osm-address.ts`

OSM address parsing helpers.

#### `live-panel-size.ts`

Preview panel resize dimensions localStorage.

#### `live-pasted-location.ts`

Parse Google Maps URLs and coordinate strings.

#### `live-place-display.ts`

Place name/address display formatting.

#### `live-place-enrich.ts`

Enrich places with travel-relevant metadata.

#### `live-place-key.ts`

Stable placeKey builder for dedup and media lookup.

#### `live-place-media.ts`

resolvePlaceMedia → POST /live/places/media/resolve.

#### `live-place-name-i18n.ts`

Latin spelling enrichment via /geocoding/display-name.

#### `live-place-transliteration.ts`

Transliteration helpers for non-Latin names.

#### `live-poi-icons.ts`

POI category icon and color resolution.

#### `live-preview-actions.ts`

startLivePreviewDirection, addLivePreviewLocation API calls.

#### `live-recent-searches.ts`

Recent search localStorage persistence.

#### `live-route-bearing.ts`

Bearing along route for navigation camera.

#### `live-route-origin.ts`

Build route origins from GPS, map pick, map center, search.

#### `live-route-style.ts`

Route line width/color tokens for MapLibre layers.

#### `live-route-validation.ts`

Land-connected route checks, solo live block reasons.

#### `live-routing.ts`

fetchLiveRoute → POST /live/route-preview; routeLineFromAlternative.

#### `live-rovi.ts`

fetchRoviPlaceExplanation → POST /live/ai/place-explanation.

#### `live-saved-places-preference.ts`

localStorage for saved places layer visibility.

#### `live-saved-places-store.ts`

Local saved places CRUD + SAVED_PLACES_CHANGED_EVENT.

#### `live-sea-routes-preference.ts`

localStorage for sea + cruise route overlays.

#### `live-search-categories.ts`

Category taxonomy resolution from live_search_taxonomy.json.

#### `live-search-merge.ts`

Merge API autocomplete with map label search results.

#### `live-search-suggestions.ts`

Instant suggestion filtering from recent searches.

#### `live-strip-zoom-scale.ts`

Zoom scale slider math and snapping.

#### `live-tap-geocode-cache.ts`

In-memory cache for map tap reverse geocode.

#### `live-travel-handoff.ts`

buildTravelHandoffUrl for Travel tab deep links.

#### `live-travel-layer-preference.ts`

localStorage for travel overlay toggle.

#### `live-travel-layer-styles.ts`

MapLibre layer styles for travel overlay.

#### `live-travel-layer-vector.ts`

Vector tile source for travel layer.

#### `live-types.ts`

Core TypeScript types: LiveStage, RouteLine, RouteAlternative, travel modes, formatters.

#### `route-intelligence-types.ts`

TypeScript types for route intelligence API.

#### `route-intelligence.ts`

fetchRouteIntelligence → POST /route-intelligence/explain.

#### `wiki-about-display.ts`

Wikipedia display helpers and Wayra disclaimer text.


### 28.2 Test layer (19 files)

#### `__tests__/live-ai-suggestions.test.ts`

See source file for details.

#### `__tests__/live-foot-routes.test.ts`

See source file for details.

#### `__tests__/live-globe-sun.test.ts`

See source file for details.

#### `__tests__/live-gps-marker.test.ts`

See source file for details.

#### `__tests__/live-gps.test.ts`

See source file for details.

#### `__tests__/live-map-attribution.test.ts`

See source file for details.

#### `__tests__/live-map-globe.test.ts`

See source file for details.

#### `__tests__/live-map-style-switch.test.ts`

See source file for details.

#### `__tests__/live-map-tap-coords.test.ts`

See source file for details.

#### `__tests__/live-map-zoom-limits.test.ts`

See source file for details.

#### `__tests__/live-place-display.test.ts`

See source file for details.

#### `__tests__/live-place-name-i18n.test.ts`

See source file for details.

#### `__tests__/live-route-origin.test.ts`

See source file for details.

#### `__tests__/live-route-validation.test.ts`

See source file for details.

#### `__tests__/live-saved-places-store.test.ts`

See source file for details.

#### `__tests__/live-search-suggestions.test.ts`

See source file for details.

#### `__tests__/live-strip-zoom-scale.test.ts`

See source file for details.

#### `__tests__/live-tap-geocode-cache.test.ts`

See source file for details.

#### `__tests__/wiki-about-display.test.ts`

See source file for details.


---

## 29. Test Coverage

Frontend tests in `__tests__/` (Vitest):

- `__tests__/live-ai-suggestions.test.ts`
- `__tests__/live-foot-routes.test.ts`
- `__tests__/live-globe-sun.test.ts`
- `__tests__/live-gps-marker.test.ts`
- `__tests__/live-gps.test.ts`
- `__tests__/live-map-attribution.test.ts`
- `__tests__/live-map-globe.test.ts`
- `__tests__/live-map-style-switch.test.ts`
- `__tests__/live-map-tap-coords.test.ts`
- `__tests__/live-map-zoom-limits.test.ts`
- `__tests__/live-place-display.test.ts`
- `__tests__/live-place-name-i18n.test.ts`
- `__tests__/live-route-origin.test.ts`
- `__tests__/live-route-validation.test.ts`
- `__tests__/live-saved-places-store.test.ts`
- `__tests__/live-search-suggestions.test.ts`
- `__tests__/live-strip-zoom-scale.test.ts`
- `__tests__/live-tap-geocode-cache.test.ts`
- `__tests__/wiki-about-display.test.ts`

Run: `cd frontend && npx vitest run app/(dashboard)/live`

---

## 30. Known Gaps and Legacy Code

| Item | Status | Notes |
|------|--------|-------|
| FarAwayPlacePanel | Disabled | `showFarAwayPanel = false` hardcoded |
| SoloRoutePreviewPanel | Orphan | Not imported by page.tsx |
| solo_drive_command stage | Unused path | Handlers use split_phase_active |
| Group Travel / Seat Share | Phase stubs | Toast only on Start Live |
| Train/Bus/Air/Ship modes | Phase 2 UI | Disabled with toast |
| Firebase RTDB | Not connected | Comment-only in live-place-media.ts |
| LiveMapDock | Legacy | Superseded by LiveMapRightControls |
| DEV_SHOW_MOCK_FRIENDS | false | Friend layer uses empty array |

---

## 31. Development Guide

### 31.1 Local setup

1. Start backend: FastAPI on configured port
2. Start frontend: `cd frontend && npm run dev`
3. Open `http://localhost:3000/live`
4. Set `NEXT_PUBLIC_CARTO_API_KEY` in frontend env to remove tile watermarks

### 31.2 Adding a new map overlay

1. Create `live-{name}-sync.ts` with `sync{Name}Overlay(map, data)`
2. Add preference module `live-{name}-preference.ts` if toggle needed
3. Call sync from `LiveMapComponent.restoreOverlaysRef`
4. Add toggle to `LiveMapRightControls` layers panel
5. Wire state in `page.tsx`

### 31.3 Adding a new Live API endpoint

1. Add schema in `app/schemas/`
2. Add service in `app/services/`
3. Add route in `app/routes/`
4. Register router in `app/main.py`
5. Add network module in live folder (apiFetch only)
6. Call from page.tsx handler — not from LiveMapComponent

### 31.4 Do NOT modify

- `frontend/lib/api.ts`
- `frontend/lib/auth.ts`
- `.env` files

---

## 32. Appendix — Flow Diagrams

### 32.1 Place search to navigation

```
User types in hero search
  → debounce 150ms
  → liveAutocompleteSearch (/search/places)
  → user clicks result
  → selectPlace → selectDestination
  → liveStage = place_preview
  → kickRoutePreview → POST /live/route-preview
  → routePreviewStatus = ready
  → LiveRouteSummaryBar shows Go
  → user clicks Go
  → handleGetDirections → startWazeNavigation
  → liveStage = split_phase_active
  → SoloLiveNavigationOverlay visible
```

### 32.2 Setup panel Start Live

```
User opens setup panel (TravelModeChip)
  → selects Drive + Solo
  → sets destination via search
  → route preview loads
  → if !user: "Sign in to start"
  → if user: "Start Solo Live" enabled
  → handleStartLive → startWazeNavigation
```

### 32.3 Long-distance destination

```
selectDestination (far place > 100mi)
  → handleMakeDestination
  → shouldOpenRouteIntelligence = true
  → liveStage = long_distance_preview
  → fetchRouteIntelligence
  → RoviRouteIntelligencePanel shows flight/train/bus options
  → user selects option → handleOpenTravelTab
```

---

## 33. Appendix — Type Reference

| Type | Description |
|------|-------------|
| `LiveStage` | 7-stage session state machine |
| `GroundTravelMode` | Drive, Bike, Trek, Walk |
| `ExtendedTravelMode` | Ground modes plus Train, Bus, Air, Ship |
| `VehiclePreference` | private or public |
| `RouteOrigin` | Origin with source gps, search, map_pick, or map_center |
| `RouteLine` | Polyline geometry + duration + last-mile + borders |
| `RouteAlternative` | Toll/no-toll alternate routes |
| `RoutePreviewStatus` | idle | loading | ready | failed |
| `PlacePreviewData` | Place card data shape |
| `SplitPhaseActivity` | Active session metadata |
| `TripStatus` | on_the_way | stopping | reached | running_late |
| `GpsState` | GPS watch state + accuracy |
| `LiveMapLayer` | Base layer enum from map-providers |
| `LiveMapRef` | Imperative map API |
| `FriendLocation` | Friend marker data |
| `LiveSavedPlace` | Local saved place record |

Full definitions: `live-types.ts`, `PlacePreviewCard.tsx`, `live-gps.ts`, `@/lib/map-providers`.

---

## 34. Appendix — Handler Index

1. `selectDestination` — see `page.tsx`
2. `clearSelectedPlace` — see `page.tsx`
3. `handleClosePlaceDetails` — see `page.tsx`
4. `handleMakeDestination` — see `page.tsx`
5. `handleChangeDestination` — see `page.tsx`
6. `handleContinueFromPreview` — see `page.tsx`
7. `handleContinueAnyway` — see `page.tsx`
8. `kickRoutePreview` — see `page.tsx`
9. `loadRoutePreview` — see `page.tsx`
10. `handleSelectRouteAlternative` — see `page.tsx`
11. `resolveRoutePreviewOrigin` — see `page.tsx`
12. `handleGetDirections` — see `page.tsx`
13. `handleStartPreviewDirection` — see `page.tsx`
14. `handleStartLive` — see `page.tsx`
15. `handleStartSoloLive` — see `page.tsx`
16. `handleStartFromPlacePreview` — see `page.tsx`
17. `handleBeginNavigation` — see `page.tsx`
18. `startWazeNavigation` — see `page.tsx`
19. `handleEndSoloLive` — see `page.tsx`
20. `handleMapClick` — see `page.tsx`
21. `handleMapDoubleClick` — see `page.tsx`
22. `handleNearbySearch` — see `page.tsx`
23. `handleCloseNearbyResults` — see `page.tsx`
24. `handleResultClick` — see `page.tsx`
25. `selectPlace` — see `page.tsx`
26. `handleInstantSuggestionClick` — see `page.tsx`
27. `handleLocateClick` — see `page.tsx`
28. `handleUseMapArea` — see `page.tsx`
29. `handleLayerChange` — see `page.tsx`
30. `handleTravelLayerChange` — see `page.tsx`
31. `handleSeaRoutesChange` — see `page.tsx`
32. `handleCruiseRoutesChange` — see `page.tsx`
33. `handleFootRoutesChange` — see `page.tsx`
34. `handleFriendTrackingChange` — see `page.tsx`
35. `handleSavedPlacesLayerChange` — see `page.tsx`
36. `handleToggleViewMode` — see `page.tsx`
37. `toggleLiveImmersive` — see `page.tsx`
38. `handleOpenTravelTab` — see `page.tsx`
39. `handlePlanTrip` — see `page.tsx`
40. `handleAskWayraFromPreview` — see `page.tsx`
41. `handleSavePlaceLocally` — see `page.tsx`
42. `handleSavedPlaceSelect` — see `page.tsx`
43. `handleSelectRouteIntelligenceOption` — see `page.tsx`
44. `handleUseCurrentLocationOrigin` — see `page.tsx`
45. `handleUseMapCenterOrigin` — see `page.tsx`
46. `handleStartOriginPick` — see `page.tsx`
47. `handleSearchOriginSelect` — see `page.tsx`
48. `handleSheetSetStartingPoint` — see `page.tsx`
49. `handleSheetSetDestination` — see `page.tsx`
50. `handleSheetAddStop` — see `page.tsx`
51. `handleSheetCopyCoordinates` — see `page.tsx`
52. `handleSheetSavePlace` — see `page.tsx`
53. `closeMapLocationSheet` — see `page.tsx`
54. `handleAddStopFromPreview` — see `page.tsx`
55. `handleAddStopFromLive` — see `page.tsx`
56. `showToast` — see `page.tsx`

---

## Document History

| Date | Author | Change |
|------|--------|--------|
| 2026-09-12 | Cursor Agent | Initial comprehensive Live tab documentation for redevelopment |

