# Live Tab — Scram Book

Authoritative planning and activity record for the Rovvy Live tab (`/live`).

## Artifacts

| File | Description |
|------|-------------|
| [Rovvy_Live_Tab_Technical_Documentation.md](./Rovvy_Live_Tab_Technical_Documentation.md) | Full technical reference (~1,400 lines): architecture, UI panels, state machine, APIs, file inventory |
| [Rovvy_Live_v2_Design_Review.md](./Rovvy_Live_v2_Design_Review.md) | Claude v2 mockup review, gap analysis, phased integration plan |
| [Rovvy_Live_v3_Design_Review.md](./Rovvy_Live_v3_Design_Review.md) | **Approved** v3 target + Phase A implementation notes |
| [Rovvy_OpenFreeMap_Self_Host.md](./Rovvy_OpenFreeMap_Self_Host.md) | Light self-host plan — OpenFreeMap http-host + frontend env wiring |
| [design/Rovvy_Live_v2_reference.html](./design/Rovvy_Live_v2_reference.html) | Interactive design reference (Setup · Vote · Converge · Arrival · Reports) |

## Activity log

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
