// Narrowly scoped user-facing capabilities. Each line is independently assessable.
// feature | importance | status | difficulty | source | acceptance | reason
const blocks = [
['Map controls','Graphic',`
Zoom-in control|Critical|Complete in code|Easy|LiveMapZoomControl.tsx|Confirm button and keyboard activation at all zooms.|Users need precise map scale.
Zoom-out control|Critical|Complete in code|Easy|LiveMapZoomControl.tsx|Confirm minimum zoom and disabled state.|Users need regional context.
Maximum-zoom disabled feedback|Important|Complete in code|Easy|LiveMapZoomControl.tsx|Confirm state follows active map style cap.|Prevents a control that appears broken.
Numeric zoom slider|Important|Complete in code|Moderate|LiveStripZoomScale.tsx|Check drag and keyboard increments.|Gives direct scale control.
Map scale tick strip|Later|Complete in code|Moderate|LiveStripZoomScale.tsx|Check scale ticks at globe and street zoom.|Helps interpret zoom level.
Map-center coordinate readout|Important|Complete in code|Easy|LiveMapAttributionStrip.tsx|Check readout updates after drag.|Supports exact geographic orientation.
North-bearing indicator|Important|Complete in code|Easy|LiveMapCompass.tsx|Check angle matches rotated map.|Avoids directional confusion.
Reset-north action|Important|Complete in code|Easy|LiveMapCompass.tsx|Check map bearing resets to zero.|Restores familiar orientation.
Map pan interaction|Critical|Complete in code|Moderate|LiveMapComponent.tsx|Test pointer and touch panning.|Foundation of area browsing.
Wheel zoom interaction|Important|Complete in code|Moderate|LiveMapComponent.tsx|Check scroll behavior and zoom cap.|Supports quick inspection.
Pinch zoom interaction|Important|Partial|Moderate|LiveMapComponent.tsx|Verify on a touch device.|Travelers frequently use phones.
Map rotation interaction|Important|Complete in code|Moderate|LiveMapComponent.tsx|Check rotation and compass synchronization.|Preserves orientation when rotating.
Map pitch interaction|Later|Complete in code|Moderate|LiveMapComponent.tsx|Check tilt limits and reset.|Makes 3D context usable.
Fly-to selected place|Critical|Complete in code|Moderate|LiveMapComponent.tsx|Confirm target remains visible beyond overlays.|Selected place must be findable.
Fit route bounds|Important|Complete in code|Moderate|LiveMapComponent.tsx|Check origin and destination fit with dock open.|Shows the full journey.
Map fullscreen exit|Important|Partial|Moderate|LiveImmersiveChrome.tsx|Test keyboard exit and layout restoration.|Users need a reliable escape path.
`],
['Map visual rendering','Graphic',`
Detailed road labels|Important|Complete in code|Moderate|LiveMapLayerControl.tsx|Check labels at multiple zooms.|Street names support wayfinding.
Detailed point-of-interest labels|Important|Complete in code|Moderate|LiveMapLayerControl.tsx|Check tap target versus visible label.|Names support selection.
Detailed house numbers|Important|Complete in code|Moderate|LiveMapLayerControl.tsx|Check zoom-14 threshold and density.|Address precision matters.
Clean reduced-label rendering|Later|Complete in code|Moderate|LiveMapLayerControl.tsx|Check clutter reduction in dense city.|A quieter alternative map.
Clean house-number threshold|Later|Complete in code|Moderate|LiveMapLayerControl.tsx|Check zoom-15 threshold.|Keeps clean mode useful near an address.
Satellite imagery tile rendering|Later|Partial|Hard|LiveMapLayerControl.tsx|Open and verify actual imagery and attribution.|Useful context when streets are unclear.
Terrain elevation contour rendering|Later|Partial|Hard|LiveMapLayerControl.tsx|Open and verify contours in hilly terrain.|Outdoor context depends on accurate contours.
Hybrid road casing|Later|Complete in code|Hard|live-hybrid-roads-sync.ts|Check contrast over bright and dark imagery.|Makes roads legible on satellite.
Hybrid place labels|Later|Partial|Moderate|LiveMapLayerControl.tsx|Verify labels render after style switch.|Hybrid map needs readable names.
Base-layer selection persistence|Important|Complete in code|Moderate|live-map-layer-preference.ts|Reload after each selectable style.|Prevents surprise map changes.
Style prefetch for faster switching|Important|Complete in code|Moderate|live-map-style-prefetch.ts|Time first and repeat switches.|Reduces blank map intervals.
Local development tile fallback|Critical|Complete in code|Hard|live-openfreemap-tile-fallback.ts|Test unavailable configured tile host.|Keeps the map usable on localhost.
Overlay restoration after style switch|Critical|Partial|Hard|LiveMapComponent.tsx|Toggle style with route and pins active.|Switching style must retain travel context.
Globe projection at low zoom|Later|Complete in code|Hard|live-map-globe.ts|Test flat-to-globe transition.|Provides world-scale orientation.
Globe background / atmosphere|Later|Complete in code|Moderate|live-map-globe.ts|Check contrast and loading performance.|Adds visual context without obscuring data.
Globe sunlight position|Later|Complete in code|Hard|live-globe-sun.ts|Check day/night lighting at known times.|Lighting should match geography.
`],
['Layer controls','UI extension',`
Layers panel open and close|Important|Complete in code|Easy|LiveMapLayerControl.tsx|Test button and outside click.|Map settings must be easy to reach.
Selected base-layer indicator|Important|Complete in code|Easy|LiveMapLayerControl.tsx|Check indicator matches rendered map.|Prevents confusing layer state.
Detailed layer selector|Important|Complete in code|Moderate|LiveMapLayerControl.tsx|Select and verify labels render.|Core street view choice.
Clean layer selector|Important|Complete in code|Moderate|LiveMapLayerControl.tsx|Select and verify minimal map renders.|Provides a lighter map.
Satellite layer selector|Later|Partial|Hard|LiveMapLayerControl.tsx|Select and verify actual imagery.|Aerial view only helps if tiles load.
Terrain layer selector|Later|Partial|Hard|LiveMapLayerControl.tsx|Select and verify elevation view.|Topography should match picker claim.
Hybrid layer selector|Later|Partial|Hard|LiveMapLayerControl.tsx|Select and verify imagery plus roads.|Avoids selected/rendered mismatch.
Dark layer product gate|Later|Pending|Easy|live-map-layer-preference.ts|Keep hidden until approved and QA complete.|This mode was intentionally disabled.
Saved-pins layer toggle|Important|Complete in code|Moderate|LiveMapLayerControl.tsx|Toggle and verify pin visibility.|Users control personal map clutter.
Discovery layer toggle|Critical|Partial|Hard|LiveMapLayerControl.tsx|Retry failed overlay and show result.|Current session showed unavailable state.
Report layer toggle|Important|Partial|Moderate|LiveMapLayerControl.tsx|Toggle with known report data.|Users control live-report clutter.
Travel overlay toggle|Later|Complete in code|Moderate|LiveMapLayerControl.tsx|Check line layer appears and disappears.|Separates transportation context.
Sea overlay toggle|Later|Complete in code|Moderate|LiveMapLayerControl.tsx|Check marine lines appear and disappear.|Specialized marine context.
Cruise overlay toggle|Later|Complete in code|Moderate|LiveMapLayerControl.tsx|Check itinerary lines appear and disappear.|Specialized cruise context.
Foot overlay toggle|Important|Complete in code|Moderate|LiveMapLayerControl.tsx|Check trails appear and disappear.|Helps walkers focus on paths.
Friend-tracking layer toggle|Critical|Partial|Hard|LiveMapLayerControl.tsx|Confirm consent and per-trip behavior.|Shared location visibility is sensitive.
2D/3D layer-panel toggle|Later|Complete in code|Moderate|LiveMapLayerControl.tsx|Check tilt and reset.|Adds terrain perspective.
Layer-help descriptions|Important|Complete in code|Easy|LiveMapLayerControl.tsx|Check text matches actual data.|Sets expectations for each layer.
Sound toggle state|Later|Partial|Moderate|LiveMapRightControls.tsx|Verify any audible behavior and persistence.|UI state alone should be clear.
Notification toggle state|Later|Partial|Moderate|LiveMapRightControls.tsx|Verify actual notification behavior.|Avoids implying alerts are enabled.
`],
['Discovery pins','Graphic',`
Discovery pins switch on and off|Critical|Partial|Hard|live-map-discovery-layer-session.ts|Verify toggle and error recovery.|User control needs a functioning layer.
Default six discovery categories|Important|Complete in code|Easy|live-map-discovery-categories.ts|Confirm defaults on a fresh session.|Provides useful initial exploration.
Per-category checkbox state|Important|Complete in code|Moderate|LiveDiscoveryCategoryPanel.tsx|Toggle each category and verify pins.|Allows targeted discovery.
Select-all category action|Important|Complete in code|Easy|LiveDiscoveryCategoryPanel.tsx|Confirm every selectable category becomes active.|Reduces repeated taps.
Clear category selection|Important|Partial|Moderate|LiveDiscoveryCategoryPanel.tsx|Confirm zero-selection behavior and map update.|Clear must mean no pins rather than defaults.
Category selection session persistence|Important|Complete in code|Moderate|live-map-discovery-categories.ts|Reload same session then start a new one.|User choices should behave predictably.
Discovery viewport bounds request|Critical|Partial|Hard|live-map-discovery-layer-bbox.ts|Pan and verify the new bounding box fetches.|Pins must correspond to current map area.
Discovery minimum zoom gate|Important|Complete in code|Moderate|live-map-discovery-layer-session.ts|Check precise zoom threshold and guidance.|Avoids overbroad queries and confusion.
Discovery result count notice|Important|Partial|Moderate|LivePageClient.tsx|Compare toast count to rendered pins.|Counts must reflect actual results.
Discovery fetch failure message|Critical|Partial|Moderate|LivePageClient.tsx|Offer retry and distinguish failure from zero results.|Current layer failed in the sampled session.
Discovery no-place state|Important|Partial|Moderate|LivePageClient.tsx|Test sparse viewport with successful response.|An empty map must be explained.
Teal point symbol rendering|Important|Partial|Hard|live-map-discovery-layer-sync.ts|Verify a successful payload visually.|Pins are the output of discovery.
Cluster bubble count|Important|Partial|Hard|live-map-discovery-layer-sync.ts|Confirm count equals underlying places.|A wrong count misstates coverage.
Cluster tap zoom-to-expand|Important|Partial|Hard|live-map-discovery-layer-sync.ts|Tap cluster through split levels.|Dense areas need inspectable results.
Discovery pin opens place selection|Critical|Partial|Hard|LivePageClient.tsx|Tap a returned pin and verify exact place.|Discovery has value only if places can be opened.
Capital-level filter by zoom|Later|Complete in code|Moderate|live-capital-level.ts|Check national through local tier transitions.|Avoids showing every capital at once.
`],
['Overlay graphics','Graphic',`
Saved pin glyph|Important|Complete in code|Moderate|live-saved-places-layer-sync.ts|Confirm saved pin differs from search pin.|Users need recognizable saved locations.
Saved pin click opens stored record|Important|Partial|Moderate|LivePageClient.tsx|Select after reload and verify ID.|Closes the save-and-revisit loop.
Report point glyph|Important|Partial|Moderate|live-place-reports-sync.ts|Verify displayed reports at known test coordinates.|Makes community observations discoverable.
Report marker fades at expiry|Important|Partial|Moderate|live-place-reports-sync.ts|Test two-hour boundary and refresh.|Old reports should disappear.
Travel highways overlay|Later|Complete in code|Hard|live-travel-layer-sync.ts|Check selected style and zoom visibility.|Useful high-level movement context.
Travel railway overlay|Later|Complete in code|Hard|live-travel-layer-vector.ts|Check rail depiction does not imply timetable.|Useful transit context.
Sea lane lines|Later|Complete in code|Hard|live-sea-routes-sync.ts|Verify static route geometry.|Specialized marine overview.
Ferry line layer|Later|Complete in code|Hard|live-sea-routes-sync.ts|Check source and visibility at relevant coasts.|Adds local crossing context.
Cruise itinerary lines|Later|Complete in code|Hard|live-sea-routes-sync.ts|Label static itinerary versus live service.|Avoids implying an operating cruise.
Footpath line layer|Important|Complete in code|Hard|live-foot-routes-sync.ts|Inspect trails in a known mapped area.|Supports walk and trek planning.
Friend avatar marker|Critical|Partial|Hard|live-friend-layer-sync.ts|Verify correct member identity in a real trip.|Wrong identity creates coordination risk.
Friend heading marker|Important|Partial|Hard|live-friend-layer-sync.ts|Compare heading against device movement.|Direction can help group meetings.
Friend stale-location appearance|Critical|Partial|Hard|live-friend-layer-sync.ts|Disconnect a device and inspect marker state.|Old positions must not look live.
Convoy vehicle marker|Important|Partial|Hard|live-convoy-pins-sync.ts|Check vehicle-to-offer linkage in two clients.|Makes seat offers locatable.
Pickup marker|Important|Partial|Hard|live-convoy-pins-sync.ts|Check pickup links to correct vehicle.|Prevents meeting at wrong point.
Vote option marker|Important|Partial|Hard|live-vote-pins-sync.ts|Check each pin matches a poll option.|Connects votes to places.
`],
['Search input','Feature',`
Search field focus and input|Critical|Complete in code|Easy|LivePageClient.tsx|Check typing and accessible name.|Starts the main discovery flow.
Search request debounce|Important|Complete in code|Moderate|live-geocoding.ts|Check one request per settled query.|Limits noisy lookups.
Minimum-query threshold|Important|Complete in code|Easy|LivePageClient.tsx|Check one-character and two-character behavior.|Avoids low-quality broad results.
Primary place autocomplete|Critical|Partial|Hard|live-geocoding.ts|Test city and venue queries across regions.|Finding destinations is core.
Forward-geocoding fallback|Critical|Partial|Hard|live-geocoding.ts|Simulate unavailable primary search.|Search needs graceful recovery.
Map-label search merge|Important|Partial|Hard|live-search-merge.ts|Check dedupe and ranking of tile labels.|Adds locally visible places.
Suggestion dropdown open/close|Important|Complete in code|Moderate|LivePageClient.tsx|Test focus, click-away and Escape.|Suggestions should not trap input.
Recent-place suggestion|Important|Complete in code|Moderate|live-recent-searches.ts|Select a previously visited place.|Speeds repeat visits.
Recent-category suggestion|Important|Complete in code|Moderate|live-recent-searches.ts|Select a previous category query.|Speeds repeated nearby searches.
Recent dropped-pin suggestion|Later|Complete in code|Moderate|live-recent-searches.ts|Reopen an exact dropped point.|Useful repeat map exploration.
Recent-search clear|Important|Complete in code|Easy|live-recent-searches.ts|Clear and reload list.|Gives users control of history.
Per-account recent-search key|Important|Complete in code|Moderate|live-recent-searches.ts|Switch accounts and check isolation.|Prevents mixed personal histories.
Instant suggestion filtering|Important|Complete in code|Moderate|live-search-suggestions.ts|Check keyword match and ordering.|Improves search speed.
Search-loading indicator|Critical|Partial|Moderate|LivePageClient.tsx|Check it clears when results settle.|Prevents stale loading claims.
Search zero-result message|Critical|Partial|Moderate|LiveNearbyList.tsx|Test valid query with no nearby results.|Users need a true empty state.
Search request race cancellation|Critical|Partial|Hard|LivePageClient.tsx|Issue fast changing queries and compare results.|Old results must not replace a new search.
`],
['Nearby results','UI extension',`
Nearby heading reflects category|Important|Complete in code|Easy|LiveNearbyList.tsx|Check coffee and other categories.|Explains what the list contains.
Nearby total count|Critical|Complete in code|Easy|LiveNearbyList.tsx|Compare count with unique rows.|Prevents overstated results.
Distance-sorted result order|Critical|Complete in code|Moderate|LiveNearbyList.tsx|Recompute sample distances from anchor.|Nearest should mean nearest.
Distance unit display|Important|Complete in code|Easy|LiveNearbyList.tsx|Check miles/kilometers locale behavior.|Distances must be interpretable.
Result rank badge|Important|Complete in code|Easy|LiveNearbyList.tsx|Compare rank to matching map pin.|Links list and map.
Result category subtitle|Important|Complete in code|Moderate|LiveNearbyList.tsx|Check type against source tags.|Avoids mislabeling a venue.
Result address subtitle|Critical|Partial|Moderate|LiveNearbyList.tsx|Check address provenance and missing cases.|Supports choosing the right branch.
Result click selects destination|Critical|Complete in code|Moderate|LiveNearbyList.tsx|Open result and inspect route target.|Completes nearby-to-route flow.
Nearby close button|Important|Complete in code|Easy|LiveNearbyList.tsx|Confirm map remains usable after close.|Restores browsing space.
Nearby result pin glyph|Important|Complete in code|Moderate|live-marker-elements.ts|Check map/list rank and icon match.|Avoids ambiguity on the map.
Nearby result limit by screen|Later|Complete in code|Moderate|live-search-categories.ts|Compare phone and desktop limit.|Balances density and coverage.
Nearby search anchor label|Critical|Partial|Moderate|LiveNearbyList.tsx|Distinguish map area from GPS area.|Users need to know what nearby means.
`],
['Map pick','Feature',`
POI-first map click selection|Critical|Partial|Hard|live-map-poi-pick.ts|Tap adjacent road and POI features.|Prevents wrong destination selection.
Reverse geocode bare-map tap|Critical|Partial|Hard|live-geocoding.ts|Tap unmapped place and confirm coordinate.|Makes arbitrary points useful.
Double-click map location action|Important|Complete in code|Moderate|LivePageClient.tsx|Check exact point and zoom interaction.|Provides a quick map action.
Long-press map location action|Important|Complete in code|Moderate|live-map-long-press-bind.ts|Test phone press without accidental drag.|Gives touch users a context menu.
Dropped-pin coordinate label|Important|Complete in code|Easy|LiveMapLocationSheet.tsx|Compare shown values with tap point.|Allows exact location verification.
Set map point as origin|Critical|Complete in code|Moderate|LiveMapLocationSheet.tsx|Confirm route recalculates from chosen point.|Users must control start position.
Set map point as destination|Critical|Complete in code|Moderate|LiveMapLocationSheet.tsx|Confirm selected marker and route update.|Makes arbitrary destinations routable.
Add map point as stop|Important|Partial|Hard|LiveMapLocationSheet.tsx|Confirm route geometry includes new stop.|Supports multi-stop journeys.
Copy map coordinates|Important|Complete in code|Easy|LiveMapLocationSheet.tsx|Paste copied value and compare.|Makes exact places shareable.
Save map point locally|Important|Partial|Moderate|LiveMapLocationSheet.tsx|Reload and reopen point.|Makes picked locations reusable.
Tap-geocode result cache|Later|Complete in code|Moderate|live-tap-geocode-cache.ts|Repeat tap and verify stale controls.|Reduces repeat lookup delay.
Open-water rejection state|Critical|Partial|Hard|live-open-water-place.ts|Tap ocean at multiple zooms.|Avoids invented land destinations.
`],
['Place identity','Feature',`
OSM place name display|Critical|Complete in code|Moderate|live-place-display.ts|Compare map feature name and panel.|The destination name must match the selected place.
Category label normalization|Important|Partial|Moderate|live-place-category-label.ts|Compare enriched and preview category.|Current sampled category/title differed.
Street address assembly|Critical|Partial|Hard|live-osm-address.ts|Check complete, partial and absent tags.|Users need a reliable address.
City field from reverse geocode|Important|Partial|Hard|live-place-admin-hierarchy.ts|Check city versus neighborhood on samples.|Correct locality avoids wrong-branch selection.
State/province field|Important|Partial|Moderate|live-place-admin-hierarchy.ts|Check administrative level by country.|Provides regional context.
Country field|Important|Partial|Moderate|live-place-admin-hierarchy.ts|Check cross-border samples.|Avoids travel planning in wrong country.
Coordinates in Info tab|Important|Complete in code|Easy|PlacePanelLiveChrome.tsx|Compare with selected pin.|Supports exact position checks.
Opening-hours field|Critical|Partial|Hard|PlacePanelLiveChrome.tsx|Keep unknown when no source hours exist.|Hours influence whether a visit is practical.
Open-status qualifier|Critical|Partial|Hard|PlacePanelLiveChrome.tsx|Compute only from reliable hours/time zone.|A stale open claim can mislead travel.
Place media lookup|Important|Partial|Hard|live-place-media.ts|Verify media belongs to exact venue.|Wrong photos undermine trust.
Photo-free fallback|Important|Complete in code|Easy|PlacePanel.tsx|Show empty media state honestly.|Avoids unrelated placeholder photos.
Wikidata or spine identity match|Critical|Partial|Very hard|live-place-spine.ts|Check exact ID and nearest fallback for close POIs.|Wrong record enrichment corrupts details.
Nearest-spine distance cap|Critical|Partial|Hard|LivePlacePanelHost.tsx|Test multiple spine rows within radius.|A nearest match may be the wrong business.
Enriched title reconciliation|Critical|Partial|Hard|LivePlacePanelHost.tsx|Confirm name/category/address agree after merge.|The sampled title changed after enrichment.
Local script and transliterated name|Important|Partial|Hard|live-place-name-i18n.ts|Check multilingual names and user locale.|Improves place recognition abroad.
Place trust badge|Important|Partial|Hard|LiveDataTrustBadge.tsx|Verify badge derives from source and freshness.|Trust labels should have evidence.
`],
['Place panel UI','UI extension',`
Place sheet drag handle|Important|Complete in code|Moderate|PlacePanel.tsx|Test drag with pointer and touch.|Lets users reveal more detail.
Place sheet close action|Critical|Complete in code|Easy|PlacePanel.tsx|Close by button and restore map focus.|Users need to return to map.
Place sheet focus management|Important|Partial|Moderate|use-place-panel-focus.ts|Test tab order and focus restoration.|Keyboard users need a predictable path.
Place sheet responsive width|Critical|Partial|Hard|LivePlacePanelHost.tsx|Test narrow phone through desktop sizes.|Information must stay readable.
Guide tab selection|Important|Complete in code|Easy|PlacePanelLiveChrome.tsx|Switch from other tabs and retain content.|Guide is the primary action surface.
About tab selection|Important|Complete in code|Easy|PlacePanelLiveChrome.tsx|Switch and inspect Wikipedia state.|Background context has a distinct home.
Info tab selection|Critical|Complete in code|Easy|PlacePanelLiveChrome.tsx|Switch and inspect factual fields.|Users need direct venue facts.
Wikipedia exact-match no-result state|Important|Complete in code|Moderate|PlaceWikiAboutSection.tsx|Verify no unrelated article appears.|Avoids false place biographies.
Wikipedia summary expansion|Later|Complete in code|Moderate|PlaceWikiAboutSection.tsx|Check expand/collapse and citation.|Long descriptions should be manageable.
Place photo grid|Later|Partial|Moderate|PlacePanel.tsx|Verify layout with 1, 2 and many photos.|Improves visual assessment.
Photo lightbox open|Later|Complete in code|Moderate|PlacePanel.tsx|Open a populated photo record.|Lets users inspect venue imagery.
Photo lightbox close|Later|Complete in code|Easy|PlacePanel.tsx|Test button and keyboard close.|Prevents trapped overlay.
Directions action in place panel|Critical|Partial|Hard|PlacePanel.tsx|Confirm route and auth lifecycle.|Connects place details to travel.
Add-to-plan action in place panel|Important|Partial|Hard|PlacePanel.tsx|Confirm persisted plan and state cue.|Makes selected places actionable.
Ask-group action in place panel|Important|Partial|Hard|PlacePanel.tsx|Confirm real group context or label limitation.|Group intent should not imply delivery.
Group attendance placeholder|Later|Pending|Hard|PlacePanelLiveChrome.tsx|Replace copy with real attendance if enabled.|Avoids invented social proof.
`],
['Route preview detail','Feature',`
Fresh GPS origin candidate|Critical|Partial|Hard|live-route-origin.ts|Verify freshness threshold before selection.|A stale origin yields a wrong route.
User-picked origin candidate|Critical|Complete in code|Moderate|live-route-origin.ts|Ensure user choice survives GPS updates.|Explicit starting point takes priority.
Map-center origin fallback|Critical|Partial|Moderate|live-route-origin.ts|Label map-center fallback visibly.|Silent fallback can mislead route distance.
Origin-search option|Important|Complete in code|Hard|LiveRouteOriginSetup.tsx|Select searched origin and recalculate.|Useful when planning from elsewhere.
Origin map-pick mode|Important|Complete in code|Moderate|LiveRouteOriginSetup.tsx|Pick start without changing destination.|Supports remote route planning.
Route loading state|Critical|Partial|Moderate|LiveRouteSummaryBar.tsx|Keep old route from appearing current.|Loading must distinguish stale geometry.
Route ready state|Critical|Complete in code|Moderate|LiveRouteSummaryBar.tsx|Compare provider route and displayed summary.|Enables informed start.
Route error retry|Critical|Partial|Moderate|LivePageClient.tsx|Retry after simulated provider failure.|Travel must recover from transient errors.
Route alternative selection|Important|Partial|Hard|SoloRoutePreviewPanel.tsx|Compare selected route geometry and ETA.|Alternatives need real consequences.
Toll versus no-toll route choice|Important|Partial|Hard|LivePageClient.tsx|Verify provider labels and route switching.|Cost preferences affect decisions.
Route distance format|Critical|Partial|Moderate|live-types.ts|Check unit conversion and rounding.|Wrong numbers misstate trip length.
Route duration format|Critical|Partial|Moderate|live-types.ts|Compare with backend duration.|ETA depends on accurate duration.
Route line casing|Important|Complete in code|Moderate|live-route-style.ts|Check visibility against each base layer.|Route must stand out on all styles.
Route direction arrows|Important|Complete in code|Moderate|live-route-style.ts|Check arrows follow geometry.|Clarifies travel direction.
Last-mile dashed walk segment|Important|Partial|Hard|live-routing.ts|Verify segment begins at road end.|Distinguishes driving from final walk.
Unroutable drive blocking|Critical|Partial|Hard|live-route-validation.ts|Test disconnected land and water cases.|Avoids dangerous false routes.
Far-distance route intelligence|Important|Partial|Very hard|route-intelligence.ts|Check when local route hands off.|Long journeys need different travel modes.
Travel planning handoff|Important|Partial|Hard|live-travel-handoff.ts|Verify destination and origin survive navigation.|Prevents re-entering trip details.
`],
['Navigation detail','Feature',`
Navigation camera follow|Critical|Partial|Hard|LiveMapComponent.tsx|Test moving GPS and manual-pan escape.|Map view should track actual travel.
Navigation bearing adjustment|Important|Partial|Hard|live-route-bearing.ts|Compare heading with GPS course.|Keeps forward direction intuitive.
Navigation 3D pitch|Later|Complete in code|Moderate|LiveMapComponent.tsx|Check pitch on start and reset on end.|Enhances view without trapping users.
Turn instruction text|Critical|Partial|Very hard|live-navigation-maneuver.ts|Advance along route and check each step.|Turn text must reflect current maneuver.
Turn distance label|Critical|Partial|Very hard|live-navigation-maneuver.ts|Compare with remaining distance to next turn.|Wrong distances can cause missed turns.
Generated lane-hint arrows|Critical|Partial|Hard|live-navigation-maneuver.ts|Hide unless backed by lane-level data.|Current arrows are generated by turn kind.
Remaining route distance|Critical|Partial|Very hard|SoloLiveNavigationOverlay.tsx|Resolve sampled zero-left discrepancy.|Users rely on trip progress.
Arrival clock time|Critical|Partial|Hard|SoloLiveNavigationOverlay.tsx|Use route duration and current time zone.|Arrival time affects coordination.
Speed unit label|Important|Complete in code|Easy|SoloLiveNavigationOverlay.tsx|Check MPH versus unit preference.|Telemetry requires clear units.
Unknown speed state|Important|Complete in code|Easy|SoloLiveNavigationOverlay.tsx|Distinguish unavailable from zero.|Avoids misleading speed display.
Parking save action|Important|Pending|Moderate|LivePageClient.tsx|Store precise parking point before saved toast.|A false save can strand a user.
Share trip action|Important|Pending|Hard|LivePageClient.tsx|Implement a permission-aware share outcome.|Current action only says coming soon.
Add stop from navigation|Important|Partial|Hard|LivePageClient.tsx|Recalculate active route after selection.|Live detours require a real update.
End navigation action|Critical|Complete in code|Moderate|LivePageClient.tsx|Verify camera and stage reset.|Users need to stop tracking.
Route overview action|Important|Partial|Moderate|LivePageClient.tsx|Restore route bounds after navigation view.|Helps understand remaining journey.
`],
['GPS states','Feature',`
GPS idle state|Important|Complete in code|Easy|live-gps.ts|Verify no live claim before permission.|Users should know tracking status.
GPS request state|Important|Complete in code|Easy|live-gps.ts|Show waiting feedback during permission flow.|Reduces uncertainty.
GPS active state|Critical|Partial|Hard|live-gps.ts|Verify fresh fixes from device.|Navigation relies on real position.
GPS approximate state|Critical|Partial|Hard|live-gps.ts|Show accuracy warning and limit claims.|Approximate data should not appear precise.
GPS denied state|Critical|Partial|Moderate|live-gps.ts|Offer manual-origin path after denial.|Users can still plan a route.
GPS unavailable state|Critical|Partial|Moderate|live-gps.ts|Test unsupported device and provider error.|Failure should be actionable.
GPS stale state|Critical|Partial|Hard|live-gps.ts|Reacquire or mark location old.|A stale fix can misdirect users.
GPS browse pulse marker|Important|Partial|Hard|live-gps-marker.ts|Verify correct location and appearance.|Shows current area anchor.
GPS navigating heading cone|Important|Partial|Hard|live-gps-marker.ts|Compare cone with actual movement.|Makes orientation useful.
GPS locate-me recenter|Critical|Partial|Hard|LiveMapRightControls.tsx|Test permission and recenter after pan.|Users need to find themselves.
Use-map-area fallback|Important|Complete in code|Moderate|LivePageClient.tsx|Check manual area when GPS fails.|Keeps discovery accessible.
GPS helper dismissal|Later|Complete in code|Easy|LivePageClient.tsx|Confirm dismissal does not claim GPS active.|Keeps helper unobtrusive.
`],
['Group vote detail','Feature',`
Trip-linked poll creation|Important|Partial|Hard|live-group-vote-network.ts|Create with authenticated trip and two users.|Group choice must persist.
Poll option addition from search|Important|Partial|Hard|LivePageClient.tsx|Add a selected venue with correct coordinates.|Lets groups compare real places.
Poll option map pin|Important|Partial|Hard|live-vote-pins-sync.ts|Check option pin and text match.|Visualizes alternatives.
Poll option count bar|Important|Partial|Moderate|LiveGroupVotePanel.tsx|Compare count with server ballots.|Vote graphics must be truthful.
My-vote selected state|Important|Partial|Moderate|LiveGroupVotePanel.tsx|Reload after vote and check state.|Prevents duplicate or uncertain voting.
Vote submission error state|Critical|Partial|Moderate|use-live-group-vote.ts|Simulate 401 and network failure.|Votes must not appear counted on error.
Poll refresh interval|Important|Complete in code|Moderate|use-live-group-vote.ts|Verify 15-second refresh and cleanup.|Keeps shared totals current.
Poll close or winner state|Important|Partial|Hard|LiveGroupVotePanel.tsx|Verify backend outcome and visible result.|Groups need a decision endpoint.
Mock-poll fallback labeling|Critical|Partial|Moderate|live-group-vote-mock.ts|Label non-trip demo clearly.|Demo votes must not look shared.
Quick action after vote|Important|Partial|Hard|LiveGroupVotePanel.tsx|Verify actions produce durable state.|Voting should lead to a real next step.
`],
['Convergence detail','Feature',`
Group session start API|Critical|Partial|Hard|live-group-network.ts|Check permission and error response.|Controls location sharing lifecycle.
Firebase custom-token auth|Critical|Partial|Very hard|live-firebase-auth.ts|Verify token expiration and unauthorized access.|Protects shared location data.
Trip member roster fetch|Important|Partial|Hard|live-group-network.ts|Compare with authorized group membership.|Avoids missing or extra participants.
Live member location subscription|Critical|Partial|Very hard|live-group-location-sync.ts|Use two moving devices and reconnect.|Core group convergence signal.
Member location publication|Critical|Partial|Very hard|live-group-location-sync.ts|Confirm permission and update frequency.|Shared positions must be current.
Member ETA estimation|Critical|Partial|Hard|live-group-converge.ts|Compare estimates with route and GPS.|Waiting decisions depend on ETA.
Member freshness pill|Critical|Partial|Moderate|LiveGroupConvergePanel.tsx|Disconnect device and inspect age.|Old locations must look old.
Last-member-in callout|Important|Partial|Moderate|LiveGroupConvergePanel.tsx|Check calculation from live roster.|Helps group coordinate arrival.
Arrival count banner|Important|Partial|Hard|use-live-group-arrival.ts|Verify geofence and member count.|Closing the night depends on arrivals.
Convergence status notice|Important|Partial|Moderate|LiveMapNoticeStack.tsx|Match copy to actual session state.|Provides glanceable group status.
Wayra notice dismissal|Later|Complete in code|Easy|LiveGroupConvergePanel.tsx|Dismiss and verify state.|Keeps map usable after notice.
Mock friend fallback labeling|Critical|Partial|Moderate|live-group-converge-mock.ts|Do not present demo people as live friends.|False people locations are misleading.
`],
['Seat Share detail','Feature',`
Vehicle offer card|Important|Partial|Moderate|LiveSeatSharePanel.tsx|Compare title and offer ID.|Riders need to identify drivers.
Open-seat number|Critical|Partial|Hard|LiveSeatSharePanel.tsx|Verify concurrent joins update capacity.|Avoids overbooking.
Route summary on vehicle card|Important|Partial|Moderate|LiveSeatSharePanel.tsx|Compare with offer route.|Riders need destination compatibility.
Cost-per-head estimate|Critical|Partial|Hard|LiveSeatSharePanel.tsx|Show assumptions and actual currency.|Price claims affect decisions.
Pickup list per vehicle|Important|Partial|Hard|LiveSeatSharePanel.tsx|Check each pickup belongs to offer.|Prevents wrong pickup choice.
Join-seat transaction|Critical|Partial|Very hard|live-convoy-sync.ts|Race two users on one remaining seat.|Capacity must be enforced atomically.
Joined-driver state|Important|Partial|Hard|live-convoy-actions.ts|Reload and verify selected vehicle.|Users need reliable confirmation.
Add-pickup transaction|Important|Partial|Hard|live-convoy-sync.ts|Verify server confirmation and map pin.|Pickup must persist for group.
Broadcast own seats|Important|Partial|Hard|use-live-seat-share.ts|Wait for publish success before toast.|Do not claim an unseen offer exists.
Convoy subscription|Important|Partial|Very hard|live-convoy-sync.ts|Verify changes across two clients.|Offers need live updates.
Empty vehicles state|Important|Complete in code|Easy|LiveSeatSharePanel.tsx|Open an empty real trip.|Avoids mock vehicle leakage.
Mock convoy fallback labeling|Critical|Partial|Moderate|live-seat-share-mock.ts|Label sample offers as demo.|Users must not try to join fictional seats.
`],
['Settlement detail','Feature',`
Night-finished panel heading|Important|Partial|Easy|LiveNightFinishedPanel.tsx|Check real destination and group status.|Anchors the closing workflow.
Arrived versus member count|Critical|Partial|Hard|live-night-finished.ts|Compare live arrival records.|False counts mislead the group.
Expense total fetch|Critical|Partial|Hard|live-trip-expenses-network.ts|Compare returned expenses with total.|Settlement depends on complete charges.
Mixed-currency guard|Critical|Complete in code|Moderate|live-night-finished.ts|Verify mixed currencies do not sum.|Prevents mathematically invalid total.
Per-person split estimate|Critical|Partial|Hard|live-night-finished.ts|Check who is included and rounding.|Cost allocation can affect people.
Open split route|Important|Partial|Moderate|LiveNightFinishedPanel.tsx|Carry correct trip ID to split page.|Avoids settling the wrong group.
Mark-arrived update|Important|Pending|Hard|LivePageClient.tsx|Persist the change before success toast.|Current copy asserts unsaved state.
Late-member nudge|Important|Pending|Hard|LivePageClient.tsx|Deliver nudge before sent toast.|Current copy asserts undelivered contact.
Place report from settlement|Important|Partial|Moderate|LiveNightFinishedPanel.tsx|Open correct place and location.|Connects end-of-night feedback.
`],
['Reports detail','Feature',`
Long-line report choice|Important|Partial|Moderate|LiveReportModal.tsx|Submit and verify source/time.|Queue data is time sensitive.
Packed report choice|Important|Partial|Moderate|LiveReportModal.tsx|Submit and verify source/time.|Crowding affects a visit.
Quiet report choice|Important|Partial|Moderate|LiveReportModal.tsx|Submit and verify source/time.|Availability affects meet plans.
Price-changed report choice|Important|Partial|Moderate|LiveReportModal.tsx|Submit and verify source/time.|Cost changes affect budgets.
Closed-early report choice|Critical|Partial|Moderate|LiveReportModal.tsx|Submit and verify source/time.|Avoids a wasted trip.
No-parking report choice|Important|Partial|Moderate|LiveReportModal.tsx|Submit and verify source/time.|Drive users may need another plan.
Report anonymous browse|Important|Partial|Moderate|live-place-reports.ts|Fetch without login and check privacy.|Visitors need useful updates.
Report sign-in prompt|Important|Complete in code|Moderate|LiveReportModal.tsx|Attempt submission without credentials.|Submission identity supports abuse control.
Report expiry after two hours|Critical|Partial|Hard|live-place-report-types.ts|Verify boundary and clock skew.|Old reports should not look current.
Three-match confirmation threshold|Critical|Partial|Hard|live-place-report-types.ts|Test independent users and duplicates.|Confirmation must be evidence based.
Report submission failure message|Critical|Pending|Moderate|LiveReportModal.tsx|Display non-auth failures visibly.|Silent failure hides lost reports.
`],
['Saved-place detail','Feature',`
Local save from place panel|Important|Partial|Moderate|live-saved-places-store.ts|Reload and verify selected coordinates.|Preserves trip ideas.
Local save from map pick|Important|Partial|Moderate|LivePageClient.tsx|Reload and reopen dropped point.|Preserves arbitrary locations.
Account add-location sync|Important|Partial|Hard|live-preview-actions.ts|Verify authenticated API and error feedback.|Connects browser and account plans.
Saved-place label edit|Important|Partial|Moderate|SavedPlacePanel.tsx|Edit label and reload.|Makes personal pins recognizable.
Saved-place photo attachment|Later|Partial|Hard|SavedPlacePanel.tsx|Attach and reopen a photo.|Adds personal context.
Saved-place audio attachment|Later|Partial|Hard|SavedPlacePanel.tsx|Attach and replay audio.|Optional richer note.
Saved-place file attachment|Later|Partial|Hard|SavedPlacePanel.tsx|Attach and reopen file.|Optional trip reference.
Saved-place attachment removal|Later|Partial|Moderate|SavedPlacePanel.tsx|Remove attachment and reload.|Lets users correct notes.
Saved-place deletion|Important|Partial|Moderate|SavedPlacePanel.tsx|Delete and confirm marker disappears.|Users need control of stored pins.
Trip saved-location merge|Important|Partial|Hard|LivePageClient.tsx|Compare trip places with local saves.|Group and personal pins should coexist.
`],
['Wayra detail','UI extension',`
Wayra launcher drag position|Later|Complete in code|Moderate|AIAssistantSidecar.tsx|Drag and confirm no control overlap.|Assistant should not cover map actions.
Wayra launcher open/close|Important|Complete in code|Easy|AIAssistantSidecar.tsx|Open and close without losing place.|Keeps contextual help accessible.
Place context sent to Wayra|Important|Partial|Hard|LivePageClient.tsx|Inspect exact selected place in assistant.|Wrong context produces irrelevant advice.
Route context sent to Wayra|Important|Partial|Hard|LivePageClient.tsx|Inspect route mode and destination.|Advice should match trip.
GPS-only context sent to Wayra|Important|Partial|Hard|live-location-context.ts|Verify no precise position leak beyond intended use.|Location advice depends on consent.
Wayra map-focus command|Important|Partial|Hard|LivePageClient.tsx|Ask assistant to focus a place.|Connects chat back to map.
Clear Wayra context on place change|Critical|Partial|Moderate|LivePageClient.tsx|Switch destination and inspect context.|Prevents answer about previous place.
AI place explanation loading|Later|Partial|Moderate|live-rovi.ts|Check unavailable API behavior.|Generated context should fail clearly.
AI suggestion chips|Later|Partial|Moderate|LiveAiSuggestionsBlock.tsx|Check suggestions use current route.|Prompts should be relevant.
Route failure handoff to Wayra|Later|Partial|Hard|LivePageClient.tsx|Trigger route error and inspect prompt.|Offers guidance when routing fails.
`],
['Workflow setup','UI extension',`
Trip setup dock icon|Critical|Complete in code|Easy|LiveDockRail.tsx|Open setup and confirm selection.|Main entry to planning.
Category-filter dock icon|Important|Complete in code|Easy|LiveDockRail.tsx|Open filters with map state intact.|Makes category controls discoverable.
Nearby-results dock icon|Important|Partial|Easy|LiveDockRail.tsx|Show actual result prerequisite.|Users should understand when list exists.
Place-details dock icon|Important|Partial|Easy|LiveDockRail.tsx|Open currently selected place.|Returns to venue facts.
Vote dock icon|Important|Partial|Moderate|LiveDockRail.tsx|Gate on a real or clearly marked mock poll.|Avoids empty vote pane.
Convergence dock icon|Important|Partial|Moderate|LiveDockRail.tsx|Gate on active group session.|Avoids implying tracking is active.
Navigation dock icon|Important|Pending|Hard|live-dock-stages.ts|Connect to actual navigation status.|Current rail stage is disabled.
Seat Share dock icon|Important|Partial|Moderate|LiveDockRail.tsx|Gate on seat-share workflow.|Avoids unrelated vehicle cards.
Notifications dock icon|Later|Pending|Hard|live-dock-stages.ts|Implement inbox before enabling.|Current rail stage is disabled.
Settle-up dock icon|Important|Partial|Moderate|LiveDockRail.tsx|Gate on finished group night.|Keeps finance action contextual.
Drive mode selection|Critical|Partial|Hard|LiveSetupPanel.tsx|Route with drive profile.|Driving restrictions affect safety.
Bike mode selection|Critical|Partial|Hard|LiveSetupPanel.tsx|Route with bike profile.|Cycling needs suitable roads.
Trek mode selection|Important|Partial|Hard|LiveSetupPanel.tsx|Route with trek profile.|Trail suitability differs from streets.
Walk mode selection|Critical|Partial|Hard|LiveSetupPanel.tsx|Route with pedestrian profile.|Walking requires safe paths.
Private-vehicle selection|Important|Complete in code|Moderate|LiveSetupPanel.tsx|Keep chosen mode and route behavior aligned.|Defines live routing path.
Public-transport selection|Important|Partial|Hard|LiveSetupPanel.tsx|Carry destination into Travel tab.|Transit needs a separate journey.
Solo workflow card|Critical|Complete in code|Moderate|LiveSetupPanel.tsx|Check route and sign-in gates.|Primary individual journey.
Group Travel workflow card|Important|Partial|Hard|LiveSetupPanel.tsx|Check real trip and member prerequisites.|Group actions need a shared context.
Seat Share workflow card|Important|Partial|Hard|LiveSetupPanel.tsx|Check trip and offer prerequisites.|Rideshare claims need real capacity.
Destination status in setup|Critical|Complete in code|Easy|LiveSetupPanel.tsx|Reflect selected destination after search.|Prevents starting the wrong trip.
Set-destination shortcut|Critical|Complete in code|Easy|LiveSetupPanel.tsx|Focus search from setup.|Completes the setup path.
Start-Live readiness gate|Critical|Partial|Hard|LiveSetupPanel.tsx|Check loading, missing route and ready cases.|Do not start without a valid route.
Inline sign-in prompt|Critical|Partial|Hard|InlineSignInModal.tsx|Reconcile setup and directions auth behavior.|Current entry paths gave mixed signals.
Online/offline helper card|Critical|Partial|Moderate|LiveEmptyStateCard.tsx|Show actual network state.|Avoids trusting stale results.
Group meet-point prompt|Important|Partial|Moderate|LiveSetupPanel.tsx|Set and verify shared meeting point.|Group members need one agreed target.
`],
['Accessibility and feedback','UI extension',`
Search accessible label|Critical|Partial|Easy|LivePageClient.tsx|Give field a spoken name.|Current AX field had no name.
Dock stage spoken labels|Important|Complete in code|Easy|LiveDockRail.tsx|Check every tool's label.|Icon-only rail needs names.
Unavailable stage explanation|Important|Partial|Moderate|LiveDockRail.tsx|Use stage-specific prerequisite copy.|Generic future-phase toast obscures real state.
Place tabs keyboard navigation|Critical|Partial|Moderate|PlacePanelLiveChrome.tsx|Test arrows and tab order.|Keyboard users need place facts.
Report modal focus trap|Critical|Partial|Moderate|LiveReportModal.tsx|Test focus on open/close and Escape.|Prevents inaccessible dialog state.
Map controls keyboard activation|Critical|Partial|Hard|LiveMapRightControls.tsx|Test zoom, compass, layers and locate.|Core map actions need keyboard access.
Low-vision map control contrast|Important|Partial|Moderate|LiveMapRightControls.tsx|Check against imagery and all styles.|Floating controls must remain visible.
Offline status banner|Critical|Partial|Moderate|LiveEmptyStateCard.tsx|Disconnect network and inspect recovery.|Avoids stale data appearing current.
Route failure card|Critical|Partial|Moderate|LiveEmptyStateCard.tsx|Simulate route provider failure.|Users need a next step.
GPS permission-denied card|Critical|Partial|Moderate|LiveEmptyStateCard.tsx|Deny permission and inspect alternatives.|Manual planning should remain available.
Toast dismissal|Important|Complete in code|Easy|LiveMapNoticeStack.tsx|Close each notice without losing state.|Keeps map uncluttered.
Persistent action success accuracy|Critical|Partial|Hard|LivePageClient.tsx|Audit all saved/sent/updated copy against real effects.|False success is a product trust defect.
`]
];

export const additions = blocks.map(([name,type,lines])=>[name,type,lines.trim().split('\n').map((line)=>{
  const [feature,importance,status,difficulty,evidence,acceptance,reason]=line.split('|');
  if([feature,importance,status,difficulty,evidence,acceptance,reason].some(v=>!v))throw Error(`Malformed addition: ${line}`);
  return [feature,status,importance,difficulty,acceptance,`Code only: ${evidence}`,reason];
})]);
