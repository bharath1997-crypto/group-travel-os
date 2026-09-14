# Rovvy Live v3 — Design Review (Approved Target)

> **Date:** 2026-09-12  
> **Status:** **Approved** as primary design reference (supersedes v2 for UI direction)  
> **Implementation:** Phase A–**D complete** — dock shell, place preview, solo nav, L2 reports

---

## v3 adds over v2

| Screen | New in v3 | Phase |
|--------|-----------|-------|
| Solo navigation | Turn banner + bottom ETA bar | **C (shipped)** |
| Place preview | Hero image, Resy, Put to vote, Who's going | **B (shipped)** |
| Coffee nearby list | Distance-sorted list in left column | **B (shipped)** |
| Seat Share panel | Cars, seats, pickup points | F (L7) |
| Night Finished → Splits | Post-event settlement card | F |
| Empty states | Five error cards (spec, not user tab) | **B (shipped)** |
| Setup | Same as v2 + group meet-point block | **A (shipped)** |

---

## Phase A — shipped in code (2026-09-12)

| Change | Files |
|--------|-------|
| Persistent left dock | `LiveLeftDock.tsx` |
| v3 setup panel (4 modes, workflow cards) | `LiveSetupPanel.tsx` |
| Top-right dark hero search | `page.tsx` |
| Cream dock tokens | `live-design-tokens.ts` |
| Dark TravelModeChip variant | `TravelModeChip.tsx` |
| Nearby list in dock | `page.tsx` |

Stage tabs (Vote, Converge, Arrival, Empty) visible but disabled — toast on click.

**Verification (2026-09-12):** `npx tsc --noEmit` — 0 errors; Live vitest — 100 passed (19 files).

---

## Phase B — shipped in code (2026-09-12)

| Change | Files |
|--------|-------|
| Place preview hero + group stubs | `LivePlacePreviewV3Sections.tsx`, `PlacePreviewCard.tsx` |
| v3 nearby list (count, mono distance) | `LiveNearbyList.tsx` |
| Inline empty-state cards | `LiveEmptyStateCard.tsx`, `page.tsx` |
| Online/offline banner | `page.tsx` |

Put to vote / Who's going / Reserve / Group invites — UI stubs with toast until L6.

**Verification (2026-09-12):** `npx tsc --noEmit` — 0 errors; Live vitest — 100 passed (19 files).

---

## Phase C — shipped in code (2026-09-12)

| Change | Files |
|--------|-------|
| Dark glass turn banner + lane hints | `SoloLiveNavigationOverlay.tsx` |
| Cream bottom ETA bar (flush above strip) | `SoloLiveNavigationOverlay.tsx`, `live-design-tokens.ts` |
| Maneuver parsing extracted | `live-navigation-maneuver.ts` |

**Verification (2026-09-12):** `npx tsc --noEmit` — 0 errors; Live vitest — 103 passed (20 files).

---

## Phase D — shipped in code (2026-09-12)

| Change | Files |
|--------|-------|
| Place vibe reports API (6 types, 2h TTL, 3-match confirm) | `app/models/live_place_report.py`, `app/services/live_place_report_service.py`, `app/routes/live_place_reports.py` |
| v3 “What’s it like there?” modal | `LiveReportModal.tsx`, `live-place-report-types.ts` |
| Report button + Reports layer toggle | `LiveMapRightControls.tsx`, `LiveMapLayerControl.tsx`, `live-place-reports-sync.ts` |
| Map wiring + nearby fetch | `page.tsx`, `LiveMapComponent.tsx`, `live-place-reports.ts` |

Submit requires auth (inline sign-in fallback). Browse can read nearby reports without login.

**Verification (2026-09-12):** `npx tsc --noEmit` — 0 errors; Live vitest — 104 passed (21 files); backend `test_live_place_reports.py` — 5 passed.

---

## Phase E1 — shipped in code (2026-09-13)

| Change | Files |
|--------|-------|
| Converge panel (Last one in, member ETAs, status pills) | `LiveGroupConvergePanel.tsx`, `live-group-converge-mock.ts` |
| Wayra noticed card (dismissible) | `LiveGroupConvergePanel.tsx` |
| Start Group Live → converge + mock friends on map | `page.tsx` |
| Converge rail icon when group session active | `LiveDockRail.tsx` |
| Group Travel “6 in” badge + CTA copy | `LiveSetupPanel.tsx` |
| Friend→destination route lines during converge | `live-group-routes-sync.ts`, `LiveMapComponent.tsx` |
| Traffic status toast (dismissible) | `LivePageClient.tsx`, `LiveMapNoticeStack.tsx` |
| Converge rail unblocked (`converge: true` + availability-first clicks) | `live-dock-stages.ts`, `LiveDockRail.tsx` |

Mock ETAs only — Firebase friend pings deferred to E3.

**Verification (2026-09-14):** `npx tsc --noEmit` — 0 errors; `live-dock-stages` + `live-group-routes-sync` + converge mock vitest — 5 passed.

---

## Phase E2 — shipped in code (2026-09-13)

| Change | Files |
|--------|-------|
| Vote panel (Vote open header, option bars, quick actions) | `LiveGroupVotePanel.tsx`, `live-group-vote-mock.ts` |
| Map vote pins when vote stage active | `live-vote-marker-elements.ts`, `live-vote-pins-sync.ts`, `LiveMapComponent.tsx` |
| Put to vote from place preview | `page.tsx` |
| Vote rail icon when group vote session active | `LiveDockRail.tsx`, `live-dock-stages.ts` |
| Vote-opened dismissible notice (v3 copy) | `live-group-vote-mock.ts`, `LivePageClient.tsx` |
| Add option via search → mock poll + map pin coords | `LivePageClient.tsx`, `live-group-vote-mock.ts` |

Mock poll only — real group vote API deferred.

**Verification (2026-09-14):** `npx tsc --noEmit` — 0 errors; vote mock + dock stages vitest — 8 passed.

---

## Phase E3 — shipped in code (2026-09-13)

| Change | Files |
|--------|-------|
| Firebase custom token + group converge session start | `app/routes/live_group.py`, `app/services/live_group_service.py`, `tests/test_live_group.py` |
| RTDB subscribe/publish at `trips/{tripId}/locations/{userId}` | `live-group-location-sync.ts`, `live-firebase-auth.ts` |
| Real converge members + friend map overlay | `live-group-converge.ts`, `use-live-group-converge.ts`, `page.tsx` |
| Wayra live-context alert on converge panel | `live-group-network.ts` → `/wayra/live-context/{trip_id}` |

| Dynamic converge status notice (Wayra / late member / mock fallback) | `buildConvergeStatusNotice()`, `LivePageClient.tsx` |
| Roster-from-RTDB fallback when group members load late | `live-group-converge.ts` |
| Trip roster count in setup CTA (`{n} in`) | `LiveSetupPanel.tsx`, `LivePageClient.tsx` |
| Firebase connect error toast | `LivePageClient.tsx`, `use-live-group-converge.ts` |

Mock converge remains fallback when Live is opened without `trip_id` or before Firebase connects.

**Verification (2026-09-14):** backend 4 passed (2026-09-13); frontend converge tests 8 passed; `npx tsc --noEmit` — 0 errors.

---

## Phase F — shipped in code (2026-09-13)

| Change | Files |
|--------|-------|
| Seat Share panel (vehicles, open seats, pickup points, broadcast) | `LiveSeatSharePanel.tsx`, `live-seat-share-mock.ts` |
| Night Finished → Splits card (running total, Open split) | `LiveNightFinishedPanel.tsx`, `live-night-finished.ts`, `live-trip-expenses-network.ts` |
| Seat / Settle rail icons + Group Live night finished flow | `LiveDockRail.tsx`, `live-dock-stages.ts`, `LiveGroupConvergePanel.tsx`, `page.tsx` |

| Seat Share opened dismissible notice | `buildSeatShareOpenedNotice()`, `LivePageClient.tsx` |
| Settle opened dismissible notice | `buildSettleOpenedNotice()`, `LivePageClient.tsx` |
| Real convoy self-only fallback (no mock Tomas flash) | `convoyPayloadToRecord()`, `use-live-seat-share.ts` |
| Seat Share Firebase error toast | `LivePageClient.tsx` |
| Empty vehicles state in seat panel | `LiveSeatSharePanel.tsx` |

Seat Share vehicles are mock without `trip_id`; convoy RTDB when trip-linked. Expense total loads from `/trips/{id}/expenses` when authenticated.

**Verification (2026-09-14):** seat share + night finished vitest — 9 passed; `npx tsc --noEmit` — 0 errors.

---

## Phase G — shipped in code (2026-09-13)

| Change | Files |
|--------|-------|
| Live vote panel API (trip polls) | `app/services/live_group_service.py`, `app/routes/live_group.py`, `app/schemas/live_group.py` |
| Put to vote → create destination poll | `live-group-vote-network.ts`, `page.tsx` |
| Real-time vote refresh + cast | `use-live-group-vote.ts`, `live-group-vote.ts` |

Mock vote remains when Live opens without `trip_id`.

**Verification (2026-09-13):** backend 7 passed; frontend vote tests 2 passed; `npx tsc --noEmit` — 0 errors.

---

## Phase H — shipped in code (2026-09-13)

| Change | Files |
|--------|-------|
| Convoy RTDB subscribe/publish | `live-convoy-sync.ts`, `live-convoy-types.ts` |
| RTDB offers → Seat Share panel | `live-seat-share-convoy.ts`, `use-live-seat-share.ts` |
| Start Seat Share broadcasts open seats | `page.tsx` |

Mock Seat Share remains without `trip_id`.

**Verification (2026-09-13):** convoy tests 3 passed; `npx tsc --noEmit` — 0 errors.

---

## Remaining phases

_v3 Live shell phases A–H complete. Future: arrival automation, split-activities trip deep link, convoy map pins._

---

## Document history

| Date | Change |
|------|--------|
| 2026-09-12 | v3 assessment; Phase A implementation complete + verified |
