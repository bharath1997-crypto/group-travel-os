# Rovvy Live v2 — Design Review & Integration Plan

> **Date:** 2026-09-12  
> **Source artifact:** `design/Rovvy_Live_v2_reference.html` (Claude DC mockup, 686 lines)  
> **Compared against:** `frontend/app/(dashboard)/live/` (production Live tab)  
> **Status:** Approved as **design reference** — not yet implemented

---

## 1. Executive verdict

**Yes — this mockup is worth adopting as the Live tab redevelopment target**, with phased implementation. It is a significant UX upgrade over the current center-dropdown setup panel and aligns well with Rovvy's Live roadmap (L1–L8).

The mockup is **not drop-in code**. It is a Claude DC (Design Component) interactive HTML prototype with a fake CSS grid map. Implementation means rebuilding layout and panel components in Next.js while keeping the existing MapLibre stack, routing services, and Wayra hooks.

### Recommendation

| Decision | Choice |
|----------|--------|
| Adopt as design reference? | **Yes** — store in Scram Book, link from technical doc |
| Implement all panels at once? | **No** — phased by roadmap |
| Replace MapLibre with CSS map? | **No** — keep real map |
| Replace dashboard header? | **No** — mock includes its own header; Live page uses `(dashboard)/layout.tsx` |

---

## 2. What the v2 mockup contains

### 2.1 Layout model (major change)

| Region | v2 mockup | Current `/live` |
|--------|-----------|-----------------|
| Primary panel | **Left dock** (356px), scrollable | Center **dropdown** from hero search |
| Stage switcher | Top of left dock: Setup · Vote · Converge · Arrival · Empty | No stage tabs — `LiveStage` enum drives state implicitly |
| Hero search | **Top-right** dark glass pill | **Top-center** light pill |
| Map controls | Right vertical stack + bottom layer strip | `LiveMapRightControls` + `LiveMapAttributionStrip` |
| Reports | Center modal + map pills + layer toggle | **Not built** (L2) |
| Wayra | Floating FAB on right stack | Docked panel via dashboard layout |

### 2.2 Left dock stages (prototype tabs)

The mockup's `Component.state.stage` drives five demo screens:

| Tab | Purpose | Roadmap phase |
|-----|---------|---------------|
| **Setup** | Travel mode, workflow, destination, group meet-point solver | L1 + L6 |
| **Vote** | Group destination voting with progress bars | L6 |
| **Converge** | Live ETAs for all members + Wayra suggestions | L6 + L8 |
| **Arrival** | Partial arrival, split bill, report CTA | L6 + L7 |
| **Empty** | Error/empty states (no results, approximate GPS, no land route, offline) | L1 polish |

These map to a **future expanded LiveStage** — not the current 7-value enum alone.

### 2.3 Setup panel (screenshot match)

The v2 Setup panel closely matches what you already have in redevelopment, with improvements:

| Element | v2 | Current code |
|---------|-----|--------------|
| Travel mode grid | 4 modes (Drive/Bike/Trek/Walk) | 8 modes (4 active + 4 Phase 2) |
| Workflow cards | Full-width rows with subtitles | 3-column compact buttons |
| Group badge | "6 in" on Group Travel | None |
| Meet point block | "Solve the fairest meet point" | Toast stub only |
| CTA | Gradient pill "Start Group Live · 6 people" | "Start Solo Live" / sign-in gate |
| Footer | "Browse free. Sign in only to go live." | Same browse-first intent |

### 2.4 Reports modal (new — L2)

Center-bottom sheet: **"What's it like there?"** with 6 report types:

- Long line, Packed, Quiet, Price changed, Closed early, No parking

Rules shown: *"Reports fade after two hours. Three matching reports mark a place confirmed."*

**Backend:** No Live reports API exists today. This is net-new (Firebase RTDB candidate per realtime rules, or Postgres + TTL).

### 2.5 Map layer strip (refinement)

Horizontal pill near bottom-right when layers open:

- Base: Dark, Clean, Satellite, Terrain
- Overlays: Saves, Reports, Foot, Sea

**Current code already has** equivalent toggles in `LiveMapRightControls` — v2 consolidates them into one visual pattern.

### 2.6 Design tokens (aligned with brand)

| Token | v2 value | Rovvy |
|-------|----------|-------|
| Primary teal | `#0E6E5C` | Matches `BRAND.colors.primary` |
| Panel cream | `#FBFAF7` | New surface token candidate |
| Map dark bg | `#0B1210` | Compatible with `dark` base layer |
| Display font | Instrument Serif | In `frontend/lib/brand.ts` |
| Body font | Schibsted Grotesk | In `frontend/lib/brand.ts` |
| Mono font | JetBrains Mono | In `frontend/lib/brand.ts` |

Accent color is configurable in the DC props (`#0E6E5C`, `#1F5FA8`, `#8A4B2A`, `#4A3C86`).

---

## 3. Gap analysis — mockup vs production

### 3.1 Already exists (wire v2 UI to existing logic)

| v2 feature | Existing module | Notes |
|------------|-----------------|-------|
| Travel mode selection | `travelMode` + `EXTENDED_TRAVEL_MODES` | v2 hides Phase 2 modes — OK for L1 |
| Workflow selection | `workflowType` | Add subtitle copy from mockup |
| Destination set/change | `destination` state | Same flow |
| Hero search | `page.tsx` search bar | Move position top-right |
| Suggestions | `live-recent-searches.ts` | Same |
| Map layers | `live-map-layer-preference.ts` + sync modules | Restyle picker |
| Saves layer | `live-saved-places-layer-sync.ts` | Same |
| Foot / Sea overlays | `live-foot-routes-sync.ts`, `live-sea-routes-sync.ts` | Same |
| Friends on map | `live-friend-layer-sync.ts` | Mock shows ETAs on avatars |
| Wayra | `emitOpenWayra`, `useWayraPanelOpen` | v2 uses FAB; we use dock — decide |
| Locate / compass / zoom | `LiveMapRef`, attribution strip | Same capabilities |
| Sign-in gate | `InlineSignInModal` | v2: "Sign in to go live" on CTA click |
| Route lines on map | `LiveMapComponent` route layers | Mock uses SVG; keep MapLibre |
| Empty/error states | Partial (GPS helper, route errors) | v2 Empty tab is a good spec |

### 3.2 Partially exists (needs UI rework)

| v2 feature | Current state | Work needed |
|------------|---------------|-------------|
| Left dock panel | Setup panel is center dropdown | New `LiveLeftDock.tsx` component |
| Stage tab bar | None | New state or extend `LiveStage` |
| Workflow card layout | 3-column grid | Redesign to full-width cards |
| Group meet point solver | Toast stub | UI + backend meet-point algorithm |
| Vote UI | Not built | L6 — needs trip/group session model |
| Converge ETAs | Friend mock only | Firebase RTDB + group session |
| Arrival / split | "Open split" button | Links to Connect/Splits product area |
| Report map pills | Not built | L2 — new marker layer |
| Wayra "noticed" card | `LiveAiSuggestionsBlock` | Restyle to dark gradient card |

### 3.3 Not in codebase (new features)

| v2 feature | Phase | Backend needed |
|------------|-------|----------------|
| Destination voting | L6 | Group session + vote storage (no vote count columns in SQL — use existing vote pattern) |
| Live member ETAs | L6 | Firebase RTDB location sharing |
| Meet point solver | L6 | Service: multi-origin fair point |
| Condition reports | L2 | Report model + 2h TTL + confirmation at 3 matches |
| "Nudge" / "On my way" | L6 | Trip status already has `TripStatus` type — extend |
| Offline stale banner | L1 polish | Client-only |

### 3.4 Mockup items to fix before implementation

These are **misalignments** with Rovvy system rules — fix in design reference, not copy literally:

| Issue | Mockup | Rovvy rule |
|-------|--------|------------|
| Header duplicated | Full header in HTML | Live uses `(dashboard)/layout.tsx` only |
| Logo | Letter "R" div | Use `RovvyLogo` / `RovvyIcon` from `@/components/RovvyLogo` |
| Nav label | "Splits" | Product nav is **Connect** (unless rebranding approved) |
| Map | CSS grid fake map | Keep **MapLibre** + CARTO/OSM tiles |
| Group Live default | Mock opens on Group Travel | Solo remains default per L1–L4 focus |
| Train in modes row | Not in v2 setup (good) | Current code shows 8 modes — v2's 4-only grid is cleaner |
| DC framework | `x-dc` / `DCLogic` | Not portable — extract tokens + JSX only |
| `support.js` dependency | External script | Not in repo — prototype only |

---

## 4. Proposed LiveStage v2 mapping

Extend or parallel the current enum for group phases:

```
Current (L1–L4 Solo focus):
  static_landing → place_preview → destination_set → split_phase_active

v2 additions (L6 Group):
  group_vote_open → group_converging → group_partial_arrival
```

Reports overlay is **orthogonal** — modal state, not a LiveStage:

```
reportModalOpen: boolean  // L2
leftDockStage: "setup" | "vote" | "converge" | "arrival"  // L6, dev preview via tab bar
```

The mockup's **Empty** tab is a **design spec page** for error states — implement as individual empty components, not a user-facing tab.

---

## 5. Phased implementation plan

### Phase A — Layout shell (redevelopment now)

**Goal:** Match v2 chrome without new backend.

1. Add `LiveLeftDock.tsx` — persistent left panel container
2. Move setup panel content from center dropdown → left dock Setup view
3. Move hero search to top-right (keep `TravelModeChip`)
4. Restyle workflow cards with subtitles from mockup
5. Add cream panel tokens to `live-design-tokens.ts` (`#FBFAF7`, `#F1EFE8`)
6. Keep MapLibre + all existing hooks

**Files touched:** `page.tsx`, new `LiveLeftDock.tsx`, `TravelModeChip.tsx`, `live-design-tokens.ts`

### Phase B — Controls polish

1. Restyle layer picker as horizontal strip (mockup lines 452–466)
2. Consolidate Wayra entry (FAB vs dock — product decision)
3. Implement Empty state components from mockup Empty tab
4. Bottom attribution strip — already close; align typography to JetBrains Mono coords

### Phase C — L2 Reports

1. Backend: report types, TTL, confirmation threshold
2. Frontend: `LiveReportModal.tsx`, map report pills, reports layer toggle
3. Firebase or Postgres per architecture decision

### Phase D — L6 Group Live

1. Vote panel, Converge panel, Arrival panel
2. Meet point solver service
3. Firebase friend ETAs
4. Extend `workflowType === "Group Travel"` from toast to real flow

---

## 6. File reference in repo

| Path | Role |
|------|------|
| `Scram Book/Live Tab/design/Rovvy_Live_v2_reference.html` | Interactive Claude mockup (open in browser) |
| `Scram Book/Live Tab/Rovvy_Live_Tab_Technical_Documentation.md` | Current production architecture |
| `Scram Book/Live Tab/Rovvy_Live_v2_Design_Review.md` | This document |
| `frontend/lib/brand.ts` | Font/color tokens (already matches v2) |

### How to preview the mockup

Open `Scram Book/Live Tab/design/Rovvy_Live_v2_reference.html` in a browser. Use the left dock tabs (Setup · Vote · Converge · Arrival · Empty) to walk through states. Click report button (triangle icon) on right stack for the Reports modal.

**Note:** The file may require `support.js` from the Claude DC export environment. If interactions fail, the static layout and styles are still valid as visual reference.

---

## 7. Component mapping (v2 → React)

| Mockup section | Proposed React component | Existing file |
|----------------|-------------------------|---------------|
| Left dock shell | `LiveLeftDock.tsx` | **New** |
| Stage tabs | `LiveDockStageTabs.tsx` | **New** (dev/preview only until L6) |
| Setup card | `LiveSetupPanel.tsx` | Extract from `page.tsx` ~3777–3908 |
| Vote card | `LiveGroupVotePanel.tsx` | **New** (L6) |
| Converge card | `LiveGroupConvergePanel.tsx` | **New** (L6) |
| Arrival card | `LiveGroupArrivalPanel.tsx` | **New** (L6) |
| Wayra noticed card | extend `LiveAiSuggestionsBlock.tsx` | Exists |
| Report modal | `LiveReportModal.tsx` | **New** (L2) |
| Layer strip | refactor `LiveMapLayerControl.tsx` | Exists |
| Hero search (top-right) | refactor search block in `page.tsx` | Exists |
| Right control stack | extend `LiveMapRightControls.tsx` | Exists |

---

## 8. Answers to likely questions

**Q: Is the Reports modal in the screenshot part of Live v2?**  
A: Yes — it's the L2 Reports feature. Open via the triangle button on the right stack or "Report what it's like here" in the Arrival panel. Not in production code yet.

**Q: Should we rename Live → "Go Live" in nav?**  
A: Mockup header says "Live" (line 162). Screenshot title "Go Live" may be browser tab naming. Keep nav as **Live** unless product decides otherwise.

**Q: Can we use this HTML directly in Next.js?**  
A: No. Extract design tokens, copy, layout measurements, and interaction flows. Rebuild as React + Tailwind using existing Live modules.

**Q: What's the first coding step?**  
A: Phase A — left dock layout shell + setup panel migration. Lowest risk, biggest visual match to mockup.

---

## 9. Sign-off checklist before coding Phase A

- [ ] Product confirms left dock vs center dropdown
- [ ] Product confirms 4 travel modes only in setup (hide Phase 2 grid)
- [ ] Product confirms Wayra FAB vs existing dock panel
- [ ] Design tokens added to `live-design-tokens.ts`
- [ ] Empty tab contents become individual empty-state specs (not a user tab)
- [ ] Connect vs Splits nav naming confirmed

---

## Document history

| Date | Change |
|------|--------|
| 2026-09-12 | Initial review of Claude v2 DC mockup; stored reference HTML; gap analysis and phased plan |
