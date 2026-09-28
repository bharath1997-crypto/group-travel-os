import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
import {additions} from './additions.mjs';
const out='D:/group travel os/outputs/live-audit-20260924';
const source='frontend/app/(dashboard)/live/';
// Feature | status | importance | difficulty | acceptance | evidence | rationale
const groups=[
['Map foundation','Graphic',[
['Full-screen interactive map','Complete in code','Critical','Hard','Keep map usable while loading and after provider failures.','Browser: Chicago streets and labels rendered; LiveMapComponent.tsx','Every discovery and routing action depends on a usable map.'],
['Pan, zoom, numeric zoom slider and scale','Complete in code','Critical','Moderate','Verify mouse, touch, keyboard and changing zoom caps.','Browser: zoom slider, in/out controls and map scale; LiveStripZoomScale.tsx','Users must inspect and select the correct area.'],
['Compass and reset north','Complete in code','Important','Easy','Confirm reset after rotating the map.','Browser: Facing North control; LiveMapCompass.tsx','Restores orientation after map rotation.'],
['Map fullscreen / immersive mode','Complete in code','Important','Moderate','Test enter/exit, focus and safe-area spacing.','Browser: Map fullscreen button; LiveImmersiveChrome.tsx','Improves map space on small screens.'],
['Coordinate strip and map attribution','Complete in code','Important','Easy','Preserve coordinates and attribution in all base layers.','Browser: coordinates and OpenStreetMap attribution; LiveMapAttributionStrip.tsx','Provides location context and source credit.'],
['Detailed map with labels and house numbers','Complete in code','Important','Moderate','Check number density and readability at street zoom.','Browser: Detailed selected and street/house labels rendered; LiveMapLayerControl.tsx','Helps precise address finding; dense labels can overwhelm.'],
['Clean map style','Complete in code','Important','Moderate','Verify rendered tiles match selected style after switching.','Browser: Clean option visible; live-map-layer-preference.ts','A readable default can reduce map clutter.'],
['Satellite imagery','Complete in code','Later','Moderate','Verify imagery loads and has correct attribution.','Browser: Satellite option visible; LiveMapLayerControl.tsx','Useful orientation enhancement after core map reliability.'],
['Terrain / topography style','Complete in code','Later','Hard','Verify elevation rendering and coverage before promising terrain detail.','Browser: Terrain option visible; LiveMapLayerControl.tsx','Useful for outdoor trips but secondary to route correctness.'],
['Hybrid imagery with road labels','Complete in code','Later','Hard','Test label contrast and layer switching.','Browser: Hybrid option visible; LiveMapComponent.tsx','Alternative presentation rather than a launch dependency.'],
['Dark basemap (intentionally disabled)','Pending','Later','Easy','Keep hidden until product approval and contrast review.','live-map-layer-preference.ts; Live README product gate dated 2026-09-19','Do not reintroduce a deliberately deferred theme.'],
['3D view / camera pitch','Complete in code','Later','Moderate','Check tilt reset and mobile performance.','Browser: 3D View toggle visible; LivePageClient.tsx handleToggleViewMode','Visual enhancement; not essential to selecting or reaching a place.'],
['Zoom-out globe projection and day/night atmosphere','Complete in code','Later','Hard','Verify low-zoom transitions, marker scale and graphics performance.','Code only: live-map-globe.ts; LiveMapComponent.tsx','Adds geographic context but should not delay launch fixes.'],
['Style loading, fallback and retry handling','Partial','Critical','Hard','Test provider failures, slow loads and layer-state consistency.','LivePageLoadError.tsx; live-openfreemap-tile-fallback.ts; browser base map rendered','A blank or mismatched map blocks the entire page.'],
]],
['Map overlays','Graphic',[
['Parks & capitals discovery overlay','Partial','Critical','Hard','Resolve observed layer unavailable state; distinguish empty coverage from fetch failure.','Browser: layer unavailable · try again; live-map-discovery-layer-network.ts','A visible default discovery layer must work or explain failure.'],
['15 discovery categories with select all / clear','Complete in code','Important','Moderate','Verify every category, zero-selection semantics and reload behavior.','Browser: categories panel; live-map-discovery-categories.ts','Gives users control over clutter and relevant places.'],
['Nature categories: parks, national parks, forests, waterfalls, mountains, rocks, viewpoints, scenic spots','Complete in code','Important','Moderate','Validate category-to-pin matches and sparse-area empty states.','Browser category labels; live-map-discovery-categories.ts','Supports outdoor discovery without separate screens.'],
['Beach category','Complete in code','Important','Easy','Confirm beach results are point places with appropriate labels.','Browser: Beaches checkbox; live-map-discovery-categories.ts','Useful category coverage, conditional on overlay reliability.'],
['Civic / visit categories: historic sites, capitals, monuments, churches, landmarks, museums','Complete in code','Important','Moderate','Validate category labels and overlap between broad/narrow categories.','Browser category labels; live-map-discovery-categories.ts','Supports city discovery and cultural visits.'],
['Teal clusters, counts and click-to-expand','Partial','Important','Hard','Verify cluster expansion against successful discovery payload.','Browser help describes numbered clusters; live-map-discovery-layer-sync.ts; layer unavailable','Keeps dense result sets legible.'],
['Zoom-tier capital symbols and labels','Complete in code','Later','Moderate','Check national/state/district/municipal visibility across zoom levels.','Code only: live-capital-level.ts; Live README 2026-09-20','Improves geographic detail after discovery basics work.'],
['Saved-place pin overlay','Complete in code','Important','Moderate','Verify saves survive reload on this device; keep local-only wording.','Browser: My saves tooltip explicitly device-only; live-saved-places-layer-sync.ts','Makes saved places easy to revisit.'],
['Place-report overlay and fading markers','Partial','Important','Hard','Verify nearby report fetch, expiry and confirmed-state markers.','Browser: Reports option; live-place-reports-sync.ts','Adds useful freshness information if timestamps are reliable.'],
['Travel / transport overlay','Complete in code','Later','Hard','Verify transport features and style-dependent visibility.','Browser: Travel toggle; live-travel-layer-sync.ts','Contextual transport graphic; not a booking or live-traffic guarantee.'],
['Sea route overlay','Complete in code','Later','Hard','Verify routes and clearly separate schematic context from navigable itineraries.','Browser: Sea toggle; live-sea-routes-sync.ts','Specialized coverage beyond core ground travel.'],
['Cruise route overlay','Complete in code','Later','Hard','Verify route source and avoid implying bookable or live sailings.','Browser: Cruise toggle; cruise layer wiring in LiveMapComponent.tsx','Optional travel inspiration.'],
['Walking / trekking paths overlay','Complete in code','Important','Hard','Check path visibility and route suitability for selected mode.','Browser: Foot toggle; live-foot-routes-sync.ts','Useful ground-travel context, especially for Walk/Trek.'],
['Friend markers, headings and freshness states','Partial','Critical','Very hard','Verify with consenting authenticated trip members and stale/disconnected devices.','Code only: live-friend-layer-sync.ts; use-live-group-converge.ts','Incorrect member locations can mislead group coordination.'],
['Group convergence route lines','Partial','Important','Hard','Confirm lines use actual member coordinates and route status.','Code only: live-group-routes-sync.ts; LivePageClient.tsx','Explains where people are coming from; backend session QA pending.'],
['Vote pins and convoy vehicle / pickup pins','Partial','Important','Hard','Check pin-to-option/vehicle identity in real trip sessions.','Code only: live-vote-pins-sync.ts; live-convoy-map-pins.ts','Connects group decisions to exact map locations.'],
]],
['Search and selection','Feature',[
['Place / meet-point search and autocomplete','Complete in code','Critical','Hard','Test ambiguous names, no matches, request races and multiple regions.','Browser: search bar and Coffee nearby journey; live-geocoding.ts','Primary entry to destination selection.'],
['Suggestions and recent-search shortcuts','Complete in code','Important','Moderate','Test recent-history persistence and clearing.','Browser: Suggestions opened Coffee nearby recent item; live-recent-searches.ts','Reduces repeated search effort.'],
['Category nearby search','Complete in code','Critical','Hard','Check categories, anchors and provider failures outside the sampled area.','Browser: Coffee nearby returned 12 results; LivePageClient.tsx handleNearbySearch','Core map-based discovery.'],
['Distance-sorted nearby list and result count','Complete in code','Critical','Moderate','Keep list count, pin count and distance anchor consistent.','Browser: 12 found, 0.3–1.0 mi, 12 numbered pins; LiveNearbyList.tsx','Users rely on proximity when choosing a stop.'],
['Numbered category pins synchronized with list','Complete in code','Important','Moderate','Verify list and map selection stay synchronized after a new query.','Browser: coffee pins 1–12 matched displayed list','Reduces confusion between nearby choices.'],
['Search loading, empty and failure states','Partial','Critical','Moderate','Clear Searching once final results settle; show retry on real failures.','Browser: results appeared while search bar briefly retained Searching; later cleared; LiveNearbyList.tsx','Prevents stale results being mistaken for current results.'],
['Search area / GPS bias and widen-search guidance','Partial','Critical','Hard','Label actual anchor and make widen action behavior explicit.','Browser: Searching this map area; LivePageClient.tsx onWidenSearch only gives pan guidance','Nearby must mean the area the user expects.'],
['Paste coordinates or supported location links','Complete in code','Important','Moderate','Verify supported URL/coordinate formats and invalid input errors.','Code only: live-pasted-location.ts; LivePageClient.tsx','Useful handoff from shared locations.'],
['POI tap, double-click and dropped-pin selection','Complete in code','Critical','Hard','Check POI-vs-road selection and exact pin coordinates.','Code only: live-map-poi-pick.ts; live-map-long-press-bind.ts','Wrong selections create wrong destinations.'],
['Map-location action sheet','Complete in code','Important','Moderate','Verify set start, set destination, add stop, copy coordinates and save.','Code only: LiveMapLocationSheet.tsx; LivePageClient.tsx handlers','Provides actions for arbitrary map locations.'],
['Place name localization and administrative labels','Partial','Important','Hard','Check multilingual names and consistent enriched title/category.','Browser: Pan Artesanal changed to Pan Artesanal Bakery; category text remained Cafe; live-place-name-i18n.ts','Consistent identity helps users trust the selected place.'],
['Unknown / open-water / unroutable picks','Complete in code','Critical','Hard','Test ocean, islands and land points without routable roads.','Code only: live-open-water-place.ts; live-route-validation.ts','Avoids fabricated drive directions to impossible destinations.'],
]],
['Place details','UI extension',[
['Responsive place sheet with close / drag-to-expand','Complete in code','Critical','Moderate','Verify phone and desktop layout, drag, keyboard close and unobscured controls.','Browser: Pan Artesanal sheet opened with splitter and Close; LivePlacePanelHost.tsx','Core information surface after choosing a place.'],
['Place hero, category and photo fallback','Complete in code','Important','Moderate','Preserve No Rovvy photos yet rather than unrelated imagery.','Browser: photo fallback, title and address; PlacePanel.tsx','Useful presentation without misleading imagery.'],
['Guide tab with route tips and AI-estimate label','Complete in code','Important','Moderate','Keep estimated tips distinct from verified venue facts.','Browser: Guide, AI ESTIMATE and AREA INFO labels; PlacePanelLiveChrome.tsx','Context is useful only when its uncertainty is clear.'],
['About / Wikipedia matched summary and no-match state','Complete in code','Important','Hard','Check article match identity and attribution across regions.','Browser: exact-pin no-match message; use-place-wiki-summary.ts','Prevents regional background being presented as exact-place facts.'],
['Info tab: country, state, category, coordinates and hours when present','Complete in code','Critical','Moderate','Keep unknown hours unknown; verify fields against selected place.','Browser: Chicago, Illinois, United States; PlacePanelLiveChrome.tsx','Basic identity and address are essential to navigation.'],
['Overture / Supabase detail enrichment and nearest-place fallback','Partial','Critical','Very hard','Verify gers_id identity and close-neighbor ambiguity; reconcile all displayed fields.','Code: LivePlacePanelHost.tsx fetches exact ID or nearest; browser title changed after enrichment','Wrong enriched identity can attach the wrong details to a pin.'],
['Rich place tier: photos, reviews, price, contact and availability','Partial','Important','Hard','QA each populated field with real records and unknown-value fallbacks.','Code only: PlacePanel.tsx; place-panel-types.ts; sampled place showed thin preview','Rich details help decisions only if backed by actual data.'],
['Add location / add to plan / account sync','Partial','Important','Hard','Verify device persistence, signed-in collection sync and accurate failure message.','Code: handleAddPreviewLocation saves locally and attempts account sync; not clicked','Retaining selections is essential to planning continuity.'],
['Saved-place detail and revisit','Complete in code','Important','Moderate','Verify selecting stored pin opens the same location after reload.','Code only: SavedPlacePanel.tsx; use-live-saved-places.ts','Completes the local-save retrieval journey.'],
['Put to vote from place details','Partial','Important','Hard','Connect visible button to real trip poll flow or label unavailable.','Browser: button visible; LivePageClient.tsx liveChrome onPutToVote is coming-soon toast','Visible entry point currently does not use existing vote handler.'],
['Who is going and Invite','Pending','Important','Hard','Use actual attendance/invitation state; do not invent social proof.','Browser: Group Live coming soon text; onInviteGroup toast','Useful group context, but this entry is not connected.'],
['Hold seats / booking action','Pending','Later','Very hard','Connect real inventory/booking outcome before allowing commitment claims.','Code: onHoldSeats only booking-API-coming-soon toast','Defer until reliable booking integration exists.'],
['Review first, add hours and suggest edit','Pending','Later','Hard','Provide moderated persistent submissions and clear outcome feedback.','Code: LivePageClient.tsx handlers only coming-soon toasts','Contribution features are optional for initial use.'],
]],
['Trip setup and routing','Feature',[
['Trip setup panel and mode/workflow chip','Complete in code','Critical','Moderate','Ensure chip and panel always reflect the same selected state.','Browser: setup and Edit travel mode or workflow; LiveSetupPanel.tsx','Defines how subsequent routing should behave.'],
['Drive / Bike / Trek / Walk selectors','Partial','Critical','Hard','Verify each mode reaches the correct routing service and navigation behavior.','Browser: four modes visible; setup inspected in Drive only','Incorrect mode produces unsuitable routes and ETAs.'],
['Private vehicle versus public transport','Complete in code','Important','Moderate','Verify public choice opens Travel with the correct destination context.','Browser: both options; live-travel-handoff.ts','Clarifies which journeys stay on Live.'],
['Solo / Group Travel / Seat Share workflows','Partial','Critical','Hard','Keep prerequisites, trip context and demo states explicit.','Browser: three workflows visible; LiveSetupPanel.tsx; LivePageClient.tsx','These are distinct user journeys with different readiness.'],
['Destination set/change and route summary bar','Complete in code','Critical','Moderate','Verify close/change and stale route cleanup.','Browser: Pan Artesanal, Drive route ready, 1 min; LiveRouteSummaryBar.tsx','Connects the chosen place to the next action.'],
['Route-origin chooser: GPS, map center, map pick or search','Complete in code','Critical','Hard','Confirm chosen origin is visible and never silently replaced.','Code only: LiveRouteOriginSetup.tsx; live-route-origin.ts','Routes must start where the user intends.'],
['Route calculation, alternatives and route lines','Partial','Critical','Very hard','Verify distance, duration and geometry for all modes and failure cases.','Browser: one Drive route ready; live-routing.ts; live-route-validation.ts','The core travel utility requires trustworthy routes.'],
['Route intelligence / long-distance options / last mile','Partial','Important','Hard','Validate estimates and handoff details; identify non-bookable suggestions.','Code only: RoviRouteIntelligencePanel.tsx; route-intelligence.ts; live-travel-handoff.ts','Useful for journeys unsuited to a simple local drive.'],
['Add stop and duplicate-stop protection','Partial','Important','Hard','Verify stop actually changes route geometry and survives intended lifecycle.','Code: handleAddStopFromLive and duplicate checks; browser ADD STOP visible','Users need real multi-stop behavior, not a success label alone.'],
['Sign-in gate and inline sign-in modal','Partial','Critical','Hard','Resolve inconsistent entry paths and test session expiration.','Browser: setup said Sign in to start, but route Start directions opened Solo Live; InlineSignInModal.tsx','Auth expectations should be consistent across all entry points.'],
['Start and end Solo Live','Partial','Critical','Hard','Verify intended guest/auth behavior and session cleanup.','Browser: Start directions entered Solo Live; END returned to destination state','Lifecycle controls must reliably start and stop the intended session.'],
]],
['Navigation and location','Feature',[
['Turn banner and maneuver icon','Partial','Critical','Very hard','Verify maneuver progression against actual moving GPS and route steps.','Browser: Continue toward Pan Artesanal; live-navigation-maneuver.ts','Guidance must track real position, not just the initial route.'],
['Lane-arrow graphic','Partial','Critical','Hard','Only present lane guidance backed by actual lane data; label/hide fallback arrows.','Browser: four lane arrows; live-navigation-maneuver.ts builds laneHints','Decorative arrows can be mistaken for authoritative lane instructions.'],
['ETA, arrival clock and remaining-distance bar','Partial','Critical','Very hard','Use route progress and provider duration; fix nonzero turn distance with 0 m left.','Browser: 1 min, 0 m LEFT, 0.1 MI turn distance; SoloLiveNavigationOverlay.tsx estimates from destination.distanceM','Incorrect progress or arrival times undermine the main purpose of Live.'],
['Speed readout and graphical speed bars','Partial','Important','Moderate','Distinguish unknown speed from stationary zero and test fresh GPS.','Browser: dash MPH; SoloLiveNavigationOverlay.tsx uses speedMph || dash','A zero/unknown distinction is needed for trustworthy telemetry.'],
['Locate me / GPS permission and helper states','Partial','Critical','Hard','Test granted, denied, stale and unavailable GPS with explicit consent.','Browser: Locate me visible; not invoked; live-gps.ts; LivePageClient.tsx','Location is sensitive and essential to meaningful guidance.'],
['GPS marker, heading and camera follow modes','Partial','Critical','Hard','Verify marker accuracy, user pan escape and reacquisition on real movement.','Code only: live-gps-marker.ts; LiveMapComponent.tsx','Wrong position or unwanted camera movement disrupts navigation.'],
['Parking quick action','Pending','Important','Moderate','Persist actual parking coordinates and offer retrieval before claiming saved.','Browser: PARKING visible; LivePageClient.tsx onSaveParking only Parking saved toast','The existing success message implies data was saved when it was not.'],
['Share-trip quick action','Pending','Later','Hard','Create permission-aware share links with expiry and revoke controls.','Browser: SHARE visible; onShareTrip coming-soon toast','Useful extension after basic navigation is dependable.'],
['Offline / stale GPS / no-route / empty-group cards','Partial','Critical','Hard','Exercise each state and confirm recovery without misleading stale data.','Code only: LiveEmptyStateCard.tsx; LiveMapNoticeStack.tsx','Users need truthful degradation during travel.'],
]],
['Group coordination','Feature',[
['Real trip context and group-member loading','Partial','Critical','Hard','Verify trip/member permissions and empty/error states with actual accounts.','Code only: live-group-network.ts; LivePageClient.tsx','All shared activity must belong to the correct trip and members.'],
['Group poll creation, choices and voting','Partial','Important','Hard','Test create/cast/refresh with two trip members and fix visible place entry.','use-live-group-vote.ts polls every 15 seconds; mock path also exists; browser prerequisite toast','Core group decision feature, conditional on trustworthy shared state.'],
['Vote bars, counts, my-vote state and quick actions','Partial','Important','Moderate','Ensure totals and selected option reflect server state, not demo counts.','Code only: LiveGroupVotePanel.tsx; live-group-vote-mock.ts','Makes group preferences understandable.'],
['Group convergence start and live location updates','Partial','Critical','Very hard','Verify Firebase auth, updates, reconnection and sharing stop behavior.','Code only: use-live-group-converge.ts; live-group-network.ts','Shared location must be reliable, authorized and stoppable.'],
['Member ETA / freshness / arrival status cards','Partial','Critical','Very hard','Test real moving devices and stale locations; label estimates.','Code only: LiveGroupConvergePanel.tsx; use-live-group-arrival.ts','People rely on these statuses when waiting or meeting.'],
['On my way, running late and member nudge actions','Pending','Important','Hard','Persist status and deliver nudges before displaying sent/seen claims.','Code: LivePageClient.tsx handlers only show status/nudge toasts','False acknowledgments create coordination failures.'],
['Wayra group notice and suggested group actions','Partial','Later','Hard','Keep suggestions separate from executed orders or table changes.','Code: context-alert API exists; order-drink/table-hold handlers only toasts','Optional assistance must not imply actions were completed.'],
['Group turn-by-turn navigation entry','Pending','Important','Very hard','Connect group navigation to verified solo navigation lifecycle.','Code: converge navigate action says next Group Live step','Important when expanding group travel beyond meeting status.'],
['Notifications dock / inbox','Pending','Later','Hard','Implement actual inbox and unread state before advertising notifications.','Browser: Notifications — coming in Group Live phase; live-dock-stages.ts disabled','Visible shell exists, but inbox behavior is not implemented.'],
]],
['Seat Share and settlement','Feature',[
['Seat Share vehicles, available seats and cost-per-head cards','Partial','Important','Hard','Separate real offers from local mock/demo state.','Code: LiveSeatSharePanel.tsx; use-live-seat-share.ts real mode requires trip and user','Useful ridesharing context but requires accurate capacity and costs.'],
['Join vehicle with transactional seat allocation','Partial','Critical','Very hard','Test two users joining the last seat, authorization and rollback.','Code only: live-convoy-sync.ts transactionJoinConvoySeat; use-live-seat-share.ts','Overbooking undermines the seat-sharing workflow.'],
['Add pickup point and convoy map updates','Partial','Important','Hard','Verify coordinates, assignment and updates in two clients.','Code only: transactionAddConvoyPickup; live-convoy-map-pins.ts','Pickup identity must match the actual rider and vehicle.'],
['Broadcast available seats','Partial','Important','Hard','Await successful publish before saying refreshed/sent.','Code: publishSelf invoked without awaiting before success toast; mock branch says broadcast sent','Current messaging can claim a failed or nonexistent broadcast succeeded.'],
['Night Finished / arrival summary','Partial','Important','Hard','Use verified arrival status; clearly label missing trip context.','Code only: LiveNightFinishedPanel.tsx; live-night-finished.ts','Useful closing step after group coordination works.'],
['Expense total, currency and per-person summary','Partial','Critical','Hard','Keep unavailable totals unknown and reject unsupported mixed-currency totals.','Code only: live-night-finished.ts; live-trip-expenses-network.ts','Incorrect cost summaries can mislead settlement decisions.'],
['Open split handoff','Partial','Important','Moderate','Verify correct trip is carried into split activities.','Code only: splitActivitiesHref and onOpenSplit router push','Connects Live with the existing expense workflow.'],
['Mark everyone arrived / check late members','Pending','Important','Hard','Persist authorized arrival updates and deliver real nudges before success.','Code: settlement handlers only Group marked as arrived / Nudge sent to late members toasts','Avoids false state changes and false contact claims.'],
]],
['Reports and assistant','UI extension',[
['Six place-vibe report choices','Partial','Important','Hard','Test authenticated submission, failure feedback and duplicate handling.','Browser modal: Long line, Packed, Quiet, Price changed, Closed early, No parking; no report submitted','Useful time-sensitive local context.'],
['Report expiry and three-report confirmation','Partial','Critical','Hard','Verify two-hour expiry and independent-user confirmation; label community reports.','Browser explanatory copy; live-place-report-types.ts; API not exercised','A confirmed label must represent meaningful evidence.'],
['Report auth and submission error feedback','Partial','Critical','Moderate','Show actionable errors for non-auth failures instead of silent return.','Code: LiveReportModal.tsx returns on failed non-auth result with no inline error','Users must know whether a report was actually saved.'],
['Floating draggable Wayra launcher','Complete in code','Important','Moderate','Test placement, open/close and overlap with map controls.','Browser: Talk to Wayra launcher; shared AIAssistantSidecar.tsx','Convenient access to contextual help.'],
['Ask Wayra about place / route with selected context','Partial','Important','Hard','Verify exact place/route context and clear old context on selection changes.','Browser Guide CTA; LivePageClient.tsx handleAskWayraFromPreview','Assistant answers must concern the selected location.'],
['AI route explanation and suggestions','Partial','Later','Hard','Validate claims, attribution and unavailable-service feedback.','Code only: live-rovi.ts; LiveAiSuggestionsBlock.tsx','Adds advice after deterministic search and routing are reliable.'],
]],
['Page usability','UI extension',[
['Ten-tool dock with stage prerequisites','Partial','Important','Moderate','Use specific prerequisites without appending misleading coming-in-Group-Live wording.','Browser: ten tools; Nearby/Vote/Seat prerequisites all appended generic future-phase copy','Navigation should make available and unavailable actions obvious.'],
['Responsive dock, phone bottom sheet and safe-area layout','Partial','Critical','Hard','Test phone/desktop sizes, landscape, expanded sheets and assistant overlap.','Browser narrow viewport inspected; LiveLeftDock.tsx; LivePlacePanelHost.tsx','Controls must remain usable on the devices used while traveling.'],
['Top header reveal and map chrome','Complete in code','Important','Moderate','Verify discoverable navigation without persistent map obstruction.','Code only: LiveTopRevealZone.tsx; use-live-auto-reveal-header.ts','Balances app navigation with map space.'],
['Keyboard access, labels, dialogs and focus','Partial','Critical','Hard','Run keyboard and screen-reader pass on search, map controls and modal focus.','Browser AX: search field had no accessible name; use-place-panel-focus.ts; LiveReportModal.tsx','Primary controls must be usable without a mouse or vision.'],
['Toasts, status notices and dismiss controls','Partial','Critical','Moderate','Only claim durable outcomes after confirmed success.','Browser status/prerequisite messages; multiple toast-only callbacks in LivePageClient.tsx','Feedback is part of correctness, not just decoration.'],
['Saved settings and session preferences','Complete in code','Important','Moderate','Verify persistence scope and restore defaults; protect deliberate disabled features.','Code only: live-map-layer-preference.ts; live-map-discovery-categories.ts; local preference modules','Keeps repeat visits consistent and avoids unexpected resets.'],
]]];
const rows=[];
const browserEvidence={
 'Zoom-in control':'Visible and enabled below maximum zoom',
 'Zoom-out control':'Visible on loaded map',
 'Maximum-zoom disabled feedback':'Zoom-in button changed to Maximum zoom disabled at z14',
 'Numeric zoom slider':'Visible with zoom value in accessibility tree',
 'Map-center coordinate readout':'Chicago coordinates changed after map movement',
 'North-bearing indicator':'Facing North control visible',
 'Detailed road labels':'Chicago road labels rendered on map',
 'Detailed house numbers':'House numbers rendered at z14',
 'Layers panel open and close':'Opened layer menu and closed it',
 'Selected base-layer indicator':'Detailed option selected in layer menu',
 'Detailed layer selector':'Detailed option visible; rendered map matched',
 'Clean layer selector':'Clean option visible; not selected',
 'Satellite layer selector':'Satellite option visible; not selected',
 'Terrain layer selector':'Terrain option visible; not selected',
 'Hybrid layer selector':'Hybrid option visible; not selected',
 'Discovery layer toggle':'Parks & capitals showed layer unavailable · try again',
 'Saved-pins layer toggle':'My saves option visible with device-only help',
 'Report layer toggle':'Reports option visible with 2-hour help',
 'Travel overlay toggle':'Travel option visible',
 'Sea overlay toggle':'Sea option visible',
 'Cruise overlay toggle':'Cruise option visible',
 'Foot overlay toggle':'Foot option visible',
 '2D/3D layer-panel toggle':'3D View option visible',
 'Default six discovery categories':'Six categories selected in category panel',
 'Per-category checkbox state':'15 category checkboxes visible',
 'Select-all category action':'Select all button visible',
 'Clear category selection':'Clear button visible',
 'Discovery fetch failure message':'Layer unavailable · try again in menu',
 'Search field focus and input':'Coffee nearby was selected from suggestions',
 'Recent-category suggestion':'Coffee nearby recent item opened',
 'Suggestion dropdown open/close':'Suggestions dropdown opened',
 'Search-loading indicator':'Searching visible before results; lingered briefly',
 'Nearby heading reflects category':'Coffee nearby heading rendered',
 'Nearby total count':'12 found in Chicago sample',
 'Distance-sorted result order':'Results displayed from 0.3 to 1.0 mi',
 'Distance unit display':'Nearby rows displayed mi',
 'Result rank badge':'Ranks 1–12 displayed',
 'Result category subtitle':'Sample rows displayed Cafe',
 'Result address subtitle':'Sample rows displayed Chicago addresses',
 'Result click selects destination':'Pan Artesanal click produced route summary',
 'Nearby result pin glyph':'12 numbered coffee map pins rendered',
 'Place sheet drag handle':'Splitter Drag to expand visible',
 'Place sheet close action':'Close returned to route summary',
 'Guide tab selection':'Guide content opened',
 'About tab selection':'About showed exact-pin no-match Wikipedia state',
 'Info tab selection':'Info showed locality and category',
 'Wikipedia exact-match no-result state':'No exact Wikipedia article for Pan Artesanal',
 'Photo-free fallback':'No Rovvy photos yet appeared',
 'City field from reverse geocode':'Chicago shown in Info',
 'State/province field':'Illinois shown in Info',
 'Country field':'United States shown in Info',
 'Enriched title reconciliation':'Title changed to Pan Artesanal Bakery while category remained Cafe',
 'Route ready state':'Drive route ready and 1 min summary rendered',
 'Navigation 3D pitch':'Start directions entered Solo Live view',
 'Turn instruction text':'Continue toward Pan Artesanal shown',
 'Turn distance label':'0.1 MI shown in turn banner',
 'Generated lane-hint arrows':'Four arrows shown in Solo overlay',
 'Remaining route distance':'0 m LEFT shown beside nonzero turn distance',
 'Arrival clock time':'Clock time and 1 min ETA shown',
 'Unknown speed state':'Dash MPH shown without GPS speed',
 'End navigation action':'END returned to destination state',
 'Long-line report choice':'Choice visible in report modal; not submitted',
 'Packed report choice':'Choice visible in report modal; not submitted',
 'Quiet report choice':'Choice visible in report modal; not submitted',
 'Price-changed report choice':'Choice visible in report modal; not submitted',
 'Closed-early report choice':'Choice visible in report modal; not submitted',
 'No-parking report choice':'Choice visible in report modal; not submitted',
 'Trip setup dock icon':'Opened setup panel',
 'Category-filter dock icon':'Opened category panel',
 'Nearby-results dock icon':'Opened after category search',
 'Vote dock icon':'Prerequisite toast shown',
 'Seat Share dock icon':'Prerequisite toast shown',
 'Notifications dock icon':'Coming in Group Live phase toast shown',
 'Drive mode selection':'Drive visible in setup',
 'Bike mode selection':'Bike visible in setup',
 'Trek mode selection':'Trek visible in setup',
 'Walk mode selection':'Walk visible in setup',
 'Private-vehicle selection':'Option visible in setup',
 'Public-transport selection':'Option visible in setup',
 'Solo workflow card':'Option visible in setup',
 'Group Travel workflow card':'Option visible in setup',
 'Seat Share workflow card':'Option visible in setup',
 'Destination status in setup':'No destination set shown initially',
 'Set-destination shortcut':'Set button visible',
 'Inline sign-in prompt':'Sign in to start shown in setup',
 'Search accessible label':'AX exposed unnamed text field',
 'Dock stage spoken labels':'AX exposed named tool checkboxes',
 'Unavailable stage explanation':'Multiple prerequisites ended with generic future-phase copy',
};
for(const [stream,type,items] of additions) for(const [feature,status,importance,difficulty,next,evidence,why] of items){
 const ev=browserEvidence[feature]?`Browser: ${browserEvidence[feature]}; Source: ${evidence.replace('Code only: ','')}`:evidence;
 rows.push([`L${String(rows.length+1).padStart(3,'0')}`,stream,feature,status,importance,difficulty,next,ev,stream==='Convergence detail'||stream==='Group vote detail'||stream==='Seat Share detail'?'Trip context + auth':'See acceptance / next action',type,why]);
}
if(rows.length<250)throw Error('Detailed inventory fell below the requested minimum');
if(new Set(rows.map(r=>r[2].toLowerCase())).size!==rows.length)throw Error('Duplicate feature names');
const wb=Workbook.create();const s=wb.worksheets.add('Live Tasks'); const review=wb.worksheets.add('Review');
s.showGridLines=false;s.tabColor='#173B36';
const end=8+rows.length;
s.getRange(`A1:K${end}`).format.font={name:'Arial',size:11,color:'#172B29'};
s.getRange('A2').values=[['Rovvy Live — feature and priority tracker']];s.getRange('A2:K2').merge();s.getRange('A2').format.font={size:16,bold:true};
s.getRange('A3:K3').merge();s.getRange('A3').values=[['Reviewed 24 Sep 2026 · localhost:3000/live · Browser sample + source inspection. Complete in code does not mean production QA.']];
s.getRange('A5:K5').values=[['Items',rows.length,'Complete in code',null,'Partial',null,'Pending',null,'Critical',null,null]];
s.getRange('D5').formulas=[[`=COUNTIF(D9:D${end},"Complete in code")`]];s.getRange('F5').formulas=[[`=COUNTIF(D9:D${end},"Partial")`]];s.getRange('H5').formulas=[[`=COUNTIF(D9:D${end},"Pending")`]];s.getRange('J5').formulas=[[`=COUNTIF(E9:E${end},"Critical")`]];
s.getRange('A6:K6').merge();s.getRange('A6').values=[['Same Explorer color key: red = Very hard; yellow = Critical or Partial; green = Complete in code; gray = Pending. Ratings are review judgments.']];
s.getRange('A7:K7').merge();s.getRange('A7').values=[['One row per separately assessable control, display, action or behavior. Filter Importance for cruciality. Evidence marked Code only needs runtime verification; counts are not readiness percentages.']];
s.getRange('A8:K8').values=[['ID','Workstream','Task / feature','Status','Importance','Difficulty','Acceptance / next action','Evidence / current finding','Dependency','Type','Why it matters / feedback']];
s.getRange(`A9:K${end}`).values=rows;
const widths=[10,24,48,22,16,16,67,72,29,19,62];widths.forEach((v,i)=>s.getRangeByIndexes(0,i,end,1).format.columnWidth=v);
s.getRange(`A8:K${end}`).format.wrapText=true;s.getRange(`A9:K${end}`).format.verticalAlignment='top';s.getRange(`A9:K${end}`).format.rowHeight=58;
s.getRange('A8:K8').format={fill:'#173B36',font:{bold:true,color:'#FFFFFF'},rowHeight:32,horizontalAlignment:'center',verticalAlignment:'center',wrapText:true};
s.getRange('A2:K7').format.rowHeight=25;s.getRange('A2:K2').format.rowHeight=32;
const table=s.tables.add(`A8:K${end}`,true,'LiveFeatures');table.style='TableStyleMedium2';s.freezePanes.freezeRows(8);
s.getRange(`D9:D${end}`).dataValidation={rule:{type:'list',values:['Complete in code','Partial','Pending']}};
s.getRange(`E9:E${end}`).dataValidation={rule:{type:'list',values:['Critical','Important','Later']}};
s.getRange(`F9:F${end}`).dataValidation={rule:{type:'list',values:['Easy','Moderate','Hard','Very hard']}};
for(const [col,text,fill,color] of [['D','Complete in code','#DCF1E5','#195A35'],['D','Partial','#FFF1B8','#775400'],['D','Pending','#E9ECEF','#59636D'],['E','Critical','#FFF1B8','#775400'],['F','Very hard','#FADBDD','#9E2635']]) s.getRange(`${col}9:${col}${end}`).conditionalFormats.add('containsText',{text,format:{fill,font:{color,bold:true}}});
review.showGridLines=false;review.getRange('A1:D35').format.font={name:'Arial',size:11,color:'#172B29'};review.getRange('A2:D2').merge();review.getRange('A2').values=[['Live review — decisions and verification']];review.getRange('A2').format.font={size:16,bold:true};
const notes=[
['Review date',new Date('2026-09-24T12:00:00Z'),'',''],
['Context','User requested the same feature, UI and graphical inventory used for Explorer.','',''],
['Decision','Prioritize truthful search, identity, routing and action outcomes before more map effects.','',''],
['Priority','Meaning','Recommended action','Evidence / limitation'],
['Critical','Blocks the core journey or risks misleading location, navigation, cost or action outcomes.','Resolve and verify before treating Live as dependable.','Importance is separate from implementation status and difficulty.'],
['Important','Material user value, but can be scoped or deferred without invalidating the core map journey.','Complete after Critical gates; hide unavailable actions clearly.','Includes saves, useful group workflows and map readability.'],
['Later','Optional expansion or visual enhancement.','Defer until the core journey is verified.','Includes satellite variants, globe polish, booking stubs and assistant extras.'],
['Status','Meaning','Verification expectation',''],
['Complete in code','Scoped implementation exists; no known missing core behavior found in this review.','Code-only evidence needs runtime verification.','Not an end-to-end, device or production certification.'],
['Partial','A surface or integration exists, but a gap, issue or material unverified dependency remains.','Meet each row acceptance criterion before upgrading.','No production readiness percentage is calculated.'],
['Pending','Unavailable, toast-only, placeholder, or deliberately gated.','Implement only when prioritized and verify persistent behavior.','Dark is deliberately disabled; it is not an accidental defect.'],
['Finding','Impact','Next action','Evidence'],
['Discovery layer unavailable','Default parks/capitals overlay could not be relied on in this browser session.','Investigate actual failure and verify retry/empty states.','Observed layer unavailable · try again.'],
['Navigation progress mismatch','Solo overlay showed 0 m left alongside a 0.1 mi turn distance and 1 min ETA.','Use route progress/provider duration and test moving GPS.','Browser observation; SoloLiveNavigationOverlay.tsx derives ETA from destination distance.'],
['False success feedback','Parking, arrival updates and nudges include toast-only callbacks.','Persist/deliver actions before showing saved/sent/arrived.','LivePageClient.tsx callbacks inspected; no messages sent.'],
['Group entry integration gap','Visible place Put to vote / Invite actions still use coming-soon callbacks.','Connect existing trip-aware poll path to visible controls.','use-live-group-vote.ts exists; liveChrome callbacks remain stubs.'],
['Auth entry inconsistency','Setup says sign in to start; route Start directions entered Solo Live in the same session.','Define and enforce intended guest-versus-authenticated policy.','Observed browser paths; no credentials entered.'],
['Enriched identity consistency','Place title changed to Bakery while the Info category remained Cafe.','Reconcile preview and enriched fields and verify nearest-place matching.','Pan Artesanal sample; mismatch is not proof of a wrong underlying venue.'],
['Search naming / loading','AX search field lacked a name; Searching briefly remained alongside returned results.','Add an accessible name and verify loading-state timing.','Browser AX tree; searching indicator later cleared.'],
['Verified sample','Map rendering; setup; layers menu; 15 category options; 12 coffee results and pins; place tabs; route ready; Solo start/end; report modal.','Treat this as a sampled browser review.','No reports, saves, invitations, seat joins or financial actions submitted.'],
['Not verified','Real GPS movement; desktop/breakpoint matrix; every base/overlay render; authenticated group/seat/expense persistence; production providers.','Run targeted scenarios before upgrading dependent rows.','No new unit/integration test suite run; source inspection is not runtime verification.'],
['Source root',source,'','Relative code references in Live Tasks are under this folder; AIAssistantSidecar.tsx is in frontend/components/ai.'],
['Source URL','http://localhost:3000/live','','Current browser review target.'],
['Reference format','Scram Book/Explorer Tab/Rovvy_Explorer_Scrum_Book.xlsx','','Matched status / importance / difficulty separation, filters, dropdowns and color conventions.'],
['Product decisions','Scram Book/Live Tab/README.md; Rovvy_Live_v3_Design_Review.md; Rovvy_Live_Tab_Technical_Documentation.md','','Historical shipped claims were cross-checked where practical; current source takes precedence.'],
['Result','Completed inventory and criticality review in the Live Scram Book.','Next: navigation truth and action-feedback fixes, then discovery failure investigation.','Documentation only; application code unchanged.'],
['Counting scope','One row per separately assessable control, display, action or behavior.','Do not interpret item counts as engineering effort or production readiness.','Some rows are parts of one journey, but each has a distinct acceptance check.'],
];
review.getRange(`A4:D${notes.length+3}`).values=notes;
for(const [i,w] of [26,76,72,76].entries())review.getRangeByIndexes(0,i,notes.length+4,1).format.columnWidth=w;
review.getRange(`A4:D${notes.length+3}`).format.wrapText=true;review.getRange(`A4:D${notes.length+3}`).format.verticalAlignment='top';review.getRange(`A4:D${notes.length+3}`).format.rowHeight=50;review.getRange('B4').setNumberFormat('mmm d, yyyy');
for(const r of [7,11,15])review.getRange(`A${r}:D${r}`).format={fill:'#173B36',font:{bold:true,color:'#FFFFFF'},rowHeight:28};
wb.recalculate();
console.log(JSON.stringify({items:rows.length,status:rows.reduce((a,r)=>(a[r[3]]=(a[r[3]]||0)+1,a),{}),importance:rows.reduce((a,r)=>(a[r[4]]=(a[r[4]]||0)+1,a),{})}));
console.log((await wb.inspect({kind:'table',range:'Live Tasks!A5:K5',include:'values,formulas',tableMaxRows:1,tableMaxCols:11})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:20},summary:'Formula error scan'})).ndjson);
for(const [name,range,file] of [['Live Tasks','A8:F14','tasks.png'],['Live Tasks','G8:K12','evidence.png'],['Review','A12:D18','review.png']]){const p=await wb.render({sheetName:name,range,scale:1,format:'png'});await fs.writeFile(`${out}/${file}`,new Uint8Array(await p.arrayBuffer()));}
const output=await SpreadsheetFile.exportXlsx(wb);await output.save(`${out}/Rovvy_Live_Scrum_Book.xlsx`);
await fs.copyFile(`${out}/Rovvy_Live_Scrum_Book.xlsx`,'D:/group travel os/Scram Book/Live Tab/Rovvy_Live_Scrum_Book.xlsx');
await fs.writeFile(`${out}/inventory.json`,JSON.stringify(rows,null,2));
