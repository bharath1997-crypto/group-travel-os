# Explore feature priority and completion audit

Date: 2026-09-22. Scope: current working-tree implementation of the main /explore page, its drawers/sheets, destination directory, and direct backend dependencies.

## Decision

Prioritize trustworthy local discovery: correct location, real inventory, working dates/filters, honest prices/availability, and a real provider handoff. Finish persistent saving and practical planning next. Defer social proof, commitment modes, voting, splitting, and destination polish; hide unsupported promises immediately even when their full implementation is deferred.

## Method and limits

The earlier 12 areas are expanded into 58 auditable capabilities and user-facing data promises. Related button variants are grouped when they implement the same capability. This includes shared navigation as one supporting feature, but not every feature of other product tabs or every separate Explore category page. It is not a line-by-line audit of the entire repository.

Reviewed the project overview and main route registration, queried the knowledge graph, and traced the main Explore UI through fetching/mapping, events/places, hero/geocoding, and candidate reuse in Collection, Cart, group invitations, polls, expenses, and Wayra. The implementation snapshot takes precedence over older product-record claims. Existing concurrent working-tree changes were preserved.

- Complete = the precisely named behavior is implemented in code, with no blocking gap found for that narrow behavior. It does not mean every feature was tested end-to-end or is production-verified.
- Partial = real behavior exists, but an integration or correctness gap remains.
- Pending = the advertised outcome has no functional implementation, even if a visual/button/demo exists.
- Critical = repair before presenting Explore as a reliable usable product; no new feature should take priority over these gaps.
- Important = core utility to finish after blockers; retain already working pieces.
- Later = optional enhancement. Remove misleading fixtures now, but defer building the full feature.

Counts are unweighted feature counts, not engineering-effort estimates. A GPS control and a real booking handoff are not equally expensive to build.

## Completion snapshot

| Status | Count | Share |
|---|---:|---:|
| Complete in code | 15 | 25.9% |
| Partly implemented | 22 | 37.9% |
| Pending functional outcome | 21 | 36.2% |
| Total | 58 | 100% |

43 of 58 capabilities still need work. The Venn diagram uses set A = some functional behavior implemented (37), set B = more implementation required (43). A-only = complete; intersection = partial; B-only = pending. Circle areas are schematic, not proportional.

## Architecture findings that affect the plan

1. Main flow: Next.js Explore page -> useExploreHub -> fetchExploreHub -> /api/v1/explore/events and /api/v1/explore/places -> event/cache and place-provider services -> frontend mapping/cards. Hero independently calls Next.js /api/hero and shared geocoding. The fetched pool is limited again to 24 cards.
2. Separate /explorer/live-feed and /api/v2/explorer routes exist, but the main hub does not consume them. Their existence does not complete hub features. The v2 route also has authenticated contracts, unlike browse-first hub fetching.
3. Collection and Cart have real persistence-oriented services/routes. Use them according to bookmark versus actionable-plan semantics, with authentication and field compatibility handled. The old /explorer/items/{id}/save and /vote routes merely log intent and return success; they are not a persistence solution.
4. Existing group invitations are group-membership invitations, not automatically activity RSVP invitations. Poll and expense infrastructure likewise needs explicit adaptation; it is not wired to the sheet/bar.
5. Wayra assistant service exists elsewhere. Main-page Plan it currently performs local keyword matching and never calls that service. A model migration alone will not fix Explore planning.
6. Fresh places fallback has two source-level defects: undefined tag in the Overpass query and use of the HTTP client after its context exits. Network reproduction was not performed. Events can also introduce AI-generated seasonal rows; frontend labels must not imply these are verified bookable inventory.
7. Older documentation says the feed is live and OSM-backed. Current code instead mixes caches/provider responses and potential generated fallback, while places try Foursquare before OSM. These distinctions must be reflected in the product.

## Critical: 17 capabilities

| ID | Feature | Status | Verified implementation / gap | Next action |
|---:|---|---|---|---|
| 1 | Selected city and remembered location | Partial | The hub now has scoped selection and a request-sequence guard. Only the city name persists; state/country scope is lost on reload. The hero can still show its earlier GPS photo, weather, and place after the feed switches destination; hero/geocode replies are not guarded as the hub replies are. | Use one authoritative selected scope for hero and feed; preserve explicit scope across reload/URL navigation, and ignore stale hero/geocode replies. |
| 2 | Nearby results and distance | Partial | Feed uses a fixed city-coordinate map and 200-mile radius, not the actual selected GPS point; backend may expand to 500 miles. | Pass selected coordinates and visible radius; label distances from the actual origin. |
| 3 | Venue discovery | Partial | Places endpoint is connected, but the Foursquare-to-OSM fallback references undefined tag and reuses an exited HTTP client. | Repair and test empty-provider fallback before relying on venues. |
| 4 | Verified event inventory | Partial | Events endpoint can synthesize seasonal AI fallback rows with today's date, noon, and zero prices. | Separate editorial suggestions from verified events; never label generated rows as live/free inventory. |
| 5 | Provider/source labels | Partial | Place cards are labeled OpenStreetMap even though backend tries Foursquare first. | Preserve per-record provider provenance through the API and mapper. |
| 6 | Freshness and live status | Partial | Updated time is the browser fetch timestamp; cache age is not propagated. | Show provider/cache timestamp and distinguish cached from verified current data. |
| 7 | Loading, failures, retry, empty inventory | Partial | Loading/retry UI exists; each provider rejection becomes an empty array, concealing outages. | Differentiate empty results, partial failure, and total failure; prevent stale-city results. |
| 8 | Listing/category counts | Partial | Counts use the fetched pool, while only 24 items enter the feed; Free tonight is not date-filtered and Landmarks can count all places. | Make counts match scope, selected dates, and actual category definitions. |
| 9 | Tonight / Tomorrow / Weekend / Next week | Pending | Selection changes local state only; no date parameter or predicate uses it. | Connect date ranges to queries and use destination timezone. |
| 10 | Category filters | Partial | Basic keyword filtering exists for Events, Food & drink, Live music, Outdoors, Landmarks, Free tonight; In database has no dedicated behavior. | Use normalized categories, explicit all-items behavior, and correct OR/AND grouping. |
| 11 | Price filters | Pending | Free / Under $25 / $25–60 / $60+ search text; no numeric price comparison. | Filter numeric price and currency; keep unknown prices distinct. |
| 12 | Zero-match filter behavior | Partial | Feed, ranking, plan candidates, and count fall back to all slots when filteredSlots is empty. | Preserve zero matches and show a clear reset action. |
| 13 | Price, currency, and fee accuracy | Partial | Provider prices are displayed, rounded and dollar-prefixed; unknown values become zero for totals; all-in copy overpromises fees. | Retain currency, minimum/range/unknown states and verified fee inclusion. |
| 14 | Authentic ratings and review counts | Pending | pseudoRating hashes the listing ID/name to generate stars and review counts. | Remove synthetic ratings now; later accept verified provider ratings only. |
| 15 | Open-now / availability / capacity | Pending | Places receive Open now and Open without hours checks; ticket capacity is not confirmed. | Show unknown availability unless hours or provider status verify it. |
| 16 | Booking / provider handoff | Pending | Drawer and saved-bar Book buttons only change labels; sourceUrl is dropped in drawer mapping. | Retain validated provider URL and complete external handoff or disable the action. |
| 17 | Truthful success and product claims | Pending | Saved-to-day, invited, shared, and split confirmations are local label changes; hero promises provider coverage and friend availability. | Remove or label demos immediately; only show success after a real result. |

## Important: 25 capabilities

| ID | Feature | Status | Verified implementation / gap | Next action |
|---:|---|---|---|---|
| 18 | Automatic GPS detection | Complete | Browser geolocation is requested and supplied to the hero API. | Keep existing behavior; verify permission UX in release QA. |
| 19 | Approximate IP fallback | Complete | Denied/unavailable GPS falls back to hero IP resolution with approximate labeling. | Keep fallback and nullable state behavior. |
| 20 | City / postcode / neighbourhood search | Complete | Location sheet calls shared geocoding and applies the selected result. | Keep search; selected-city synchronization is tracked separately. |
| 21 | Use my exact location action | Complete | Manual retry requests high-accuracy coordinates and refreshes the hero. | Keep no-login location correction. |
| 22 | Prompt composer and preset prompts | Complete | Text input, auto-height, three presets, and submit interaction are implemented. | Keep the UI; planning intelligence is tracked separately. |
| 23 | Understand budget, party size, timing, walkability | Partial | Plan it performs any-word substring matching on local listings; no structured constraints or AI call. | Parse supported constraints and use verified inventory; connect Wayra only where needed. |
| 24 | Low-key / Best fit / Big night options | Partial | Up to three matching single listings receive static tier names; they are not composed itineraries. | Generate genuinely different, constraint-valid options; avoid claiming three when fewer exist. |
| 25 | Take this night / save plan to day | Pending | Button only changes its label. | Persist plan/day or create a real cart/trip handoff. |
| 26 | Fetch and render event cards | Complete | Hub calls the events API, deduplicates IDs, maps event cards, and opens details. | Keep integration; provenance and correctness gaps are tracked separately. |
| 27 | Balanced feed and browsing beyond 24 | Partial | First 24 events can consume the whole feed and exclude places; no load-more controls exist. | Mix categories intentionally and connect pagination. |
| 28 | Vibe matching | Partial | Seven vibes map to keywords; no preference model, novelty history, or validated cost/availability semantics. | Keep as approximate discovery tags or define verifiable matching rules. |
| 29 | Practical filters | Pending | Bookable now / Walk-in OK / Indoor use text matching rather than structured availability/venue facts. | Add factual fields and filter only when known. |
| 30 | Refine panel / chip state / clear / apply | Complete | Panel opens/closes, chips toggle, Clear all resets selection. | Keep controls; filtering correctness is tracked separately. |
| 31 | Listing photos and card presentation | Complete | Provider image URLs render with lazy loading; missing images show a placeholder. | Keep rendering; add broken-image QA and avoid implying generic photos depict the venue. |
| 32 | Ranked listing table | Partial | Table sorts up to six items, but ranking is driven by synthetic stars. | Use an honest ranking basis such as relevance/distance; genuine reviews only when available. |
| 33 | Open/close listing detail and basic metadata | Complete | Drawer receives listing title, description, tags, source, and price labels. | Keep the interaction; data truth and other drawer features are tracked separately. |
| 34 | Save listings persistently | Partial | Save stores IDs in page state; reload loses them and city changes can break saved-item lookup. | Choose Collection for bookmarks and Cart for actionable selections; persist snapshots and deduplicate. |
| 35 | Saved bar / clear selection / party size | Complete | Saved count, clearing, and 1–16 person stepper are implemented locally. | Keep controls; storage and totals accuracy are tracked separately. |
| 36 | Group cost estimate | Partial | Basic multiplication works but treats unknown prices as zero and assumes one per-person price/currency. | Handle unknown, mixed-currency, fee, quantity, and per-group prices correctly. |
| 37 | Invite real friends / send invitations | Pending | Sheet opens and fixture checkboxes work; send changes a label only. | Connect real eligible recipients, selected activity, invitation delivery, and failures. |
| 38 | Share listing to group chat | Pending | Share changes a success label with no message operation. | Connect a selected group and real message payload, or provide ordinary link sharing. |
| 39 | Share invitation link | Pending | Share a link instead has no handler. | Create a scoped invitation link and copy/share flow. |
| 40 | Keyboard-complete dialogs | Pending | Location has Escape handling; drawer/invite lack visible focus trap/restore and Escape support in these components. | Verify keyboard navigation and add consistent modal focus behavior. |
| 41 | Destination click / deep link / reset | Partial | City selection and query-string handoff exist; GPS can overwrite selection and reset is always Chicago. | Preserve explicit destination and return to user's actual previous location. |
| 42 | Shared navigation and responsive layout | Complete | Explore uses the shared app header/dashboard shell and responsive stylesheet. | Retain layout; browser/mobile QA was not rerun in this audit. |

## Later: 16 capabilities

| ID | Feature | Status | Verified implementation / gap | Next action |
|---:|---|---|---|---|
| 43 | Location hero photo and attribution | Complete | Hero API supplies geographically checked imagery with fallback/credit display. | Keep; defer additional image polish. |
| 44 | Local weather display | Complete | Hero weather is rendered with an unavailable state. | Keep; no forecast expansion needed for core discovery. |
| 45 | Suggested-question cards | Complete | Feed prompts fill/submit the same Plan it interaction. | Keep simple shortcuts; intelligence is tracked separately. |
| 46 | Late events / starting-soon shortcut | Partial | Card submits a fixed prompt; it has no actual start-time/open-hours query. | Hide misleading time claims or connect a real time window. |
| 47 | Drawer photo | Pending | Drawer displays a detail-photo placeholder rather than listing media. | Pass verified image URL when core data is stable. |
| 48 | Drawer map / directions | Pending | Drawer map is a labeled decorative block without coordinates or navigation. | Reuse the existing Live/map handoff when useful. |
| 49 | Who's going / friend quote / social proof | Pending | Drawer names, +9 attendees, and Tomas quote are fixtures. | Hide now; implement only with real consented attendance data. |
| 50 | Friends-going filter | Pending | No friend attendance dataset is used by this filter. | Defer until attendance is connected; hide the option meanwhile. |
| 51 | Hold / Commit / Open invitation modes | Pending | Buttons have no mode-changing behavior or persisted semantics. | Define the real group workflow before connecting these controls. |
| 52 | RSVP deadline / majority vote | Pending | Thursday 8 PM is fixed; Change has no handler and no poll is created. | Reuse authenticated poll infrastructure after activity invites work. |
| 53 | Split cost / create expense | Pending | Split changes its label but creates no expense or settlement. | Connect a real group/expense contract only after a confirmed cost exists. |
| 54 | Region tabs and destination carousel | Complete | USA, Canada, Mexico, Europe, Oceania tabs and reel scroll controls work on curated data. | Keep curated browsing; no global expansion required for core Explore. |
| 55 | All countries destination directory | Partial | Directory works for five curated regions; it is not all countries. | Rename to supported destinations or expand later. |
| 56 | Surprise me destination choice | Partial | Random city selection works; copy calls it a Wayra pick although no AI runs. | Label as random or later add preference-based selection. |
| 57 | Destination popularity / trending / flight-time badges | Pending | Badge strings such as You're here, Trending, Festival week, 2 hr flight are static. | Remove unsupported factual claims; defer real popularity scoring. |
| 58 | Destination reel imagery | Pending | City cards show reel 600×870 placeholders. | Add licensed/location-relevant images after functional priorities. |

## Evidence index

Paths without another prefix are under frontend/app/(dashboard)/explore/.

- 1. Selected city and remembered location: `use-explore-hub.ts; HeroLocationWidget.tsx; page.tsx`.
- 2. Nearby results and distance: `explore-hub-data.ts; app/services/events_service.py`.
- 3. Venue discovery: `app/services/explore_city_extended_service.py: _fetch_osm_places`.
- 4. Verified event inventory: `app/routes/explore.py: explore_events`.
- 5. Provider/source labels: `explore-hub-data.ts: placeToSlot; app/services/explore_city_extended_service.py`.
- 6. Freshness and live status: `explore-hub-data.ts: fetchedAt; page.tsx`.
- 7. Loading, failures, retry, empty inventory: `explore-hub-data.ts: fetchExploreHub; use-explore-hub.ts`.
- 8. Listing/category counts: `explore-hub-data.ts: buildStats, fetchExploreHub`.
- 9. Tonight / Tomorrow / Weekend / Next week: `page.tsx: when; app/routes/explore.py: date_from/date_to`.
- 10. Category filters: `explore-hub-v6-map.ts: CHIP_TO_CATEGORY, filterHubSlotsByChips`.
- 11. Price filters: `page.tsx: FILTER_GROUPS; explore-hub-v6-map.ts`.
- 12. Zero-match filter behavior: `page.tsx: filteredSlots.length ? filteredSlots : allSlots`.
- 13. Price, currency, and fee accuracy: `frontend/lib/explore-events.ts: formatPrice; explore-hub-data.ts: slotAmount`.
- 14. Authentic ratings and review counts: `frontend/lib/explore-events.ts: pseudoRating`.
- 15. Open-now / availability / capacity: `explore-hub-data.ts: placeToSlot, eventToSlot`.
- 16. Booking / provider handoff: `ExploreDetailDrawer.tsx; ExploreSavedBar.tsx; hubSlotToDetail`.
- 17. Truthful success and product claims: `page.tsx; ExploreWayraPlanCard.tsx; ExploreInviteSheet.tsx; ExploreSavedBar.tsx; ExploreDetailDrawer.tsx`.
- 18. Automatic GPS detection: `HeroLocationWidget.tsx; explore-hero-location.ts`.
- 19. Approximate IP fallback: `HeroLocationWidget.tsx; frontend/lib/hero-server.ts`.
- 20. City / postcode / neighbourhood search: `HeroLocationWidget.tsx; explore-hero-location.ts`.
- 21. Use my exact location action: `HeroLocationWidget.tsx: useExactLocation`.
- 22. Prompt composer and preset prompts: `page.tsx; explore-fixtures.ts`.
- 23. Understand budget, party size, timing, walkability: `explore-hub-data.ts: filterSlotsByPrompt; page.tsx: ask`.
- 24. Low-key / Best fit / Big night options: `explore-hub-v6-map.ts: slotsToWayraPlans`.
- 25. Take this night / save plan to day: `ExploreWayraPlanCard.tsx`.
- 26. Fetch and render event cards: `explore-hub-data.ts; ExploreSlotCard.tsx`.
- 27. Balanced feed and browsing beyond 24: `explore-hub-data.ts: eventSlots, placeSlots`.
- 28. Vibe matching: `explore-hub-v6-map.ts: VIBE_KEYWORDS`.
- 29. Practical filters: `page.tsx: FILTER_GROUPS; filterHubSlotsByChips`.
- 30. Refine panel / chip state / clear / apply: `page.tsx; ExploreFilterChip.tsx`.
- 31. Listing photos and card presentation: `ExploreSlotCard.tsx`.
- 32. Ranked listing table: `explore-hub-v6-map.ts: hubSlotsToRanking`.
- 33. Open/close listing detail and basic metadata: `ExploreDetailDrawer.tsx; hubSlotToDetail`.
- 34. Save listings persistently: `page.tsx: savedIds; ExploreSavedBar.tsx; app/routes/collection.py; app/routes/cart.py`.
- 35. Saved bar / clear selection / party size: `ExploreSavedBar.tsx`.
- 36. Group cost estimate: `ExploreSavedBar.tsx; explore-hub-data.ts: slotAmount`.
- 37. Invite real friends / send invitations: `ExploreInviteSheet.tsx; app/routes/invitations.py`.
- 38. Share listing to group chat: `ExploreDetailDrawer.tsx`.
- 39. Share invitation link: `ExploreInviteSheet.tsx`.
- 40. Keyboard-complete dialogs: `HeroLocationWidget.tsx; ExploreDetailDrawer.tsx; ExploreInviteSheet.tsx`.
- 41. Destination click / deep link / reset: `ExploreDestinationsSection.tsx; destinations/page.tsx; page.tsx`.
- 42. Shared navigation and responsive layout: `frontend/app/(dashboard)/layout.tsx; frontend/components/RovvyAppHeader.tsx; explore.module.css`.
- 43. Location hero photo and attribution: `HeroLocationWidget.tsx; frontend/lib/hero-server.ts`.
- 44. Local weather display: `HeroLocationWidget.tsx; frontend/lib/hero-server.ts`.
- 45. Suggested-question cards: `ExploreAskCard.tsx; page.tsx`.
- 46. Late events / starting-soon shortcut: `page.tsx: liveCard`.
- 47. Drawer photo: `ExploreDetailDrawer.tsx`.
- 48. Drawer map / directions: `ExploreDetailDrawer.tsx; hubSlotToDetail`.
- 49. Who's going / friend quote / social proof: `ExploreDetailDrawer.tsx; explore-fixtures.ts`.
- 50. Friends-going filter: `page.tsx: FILTER_GROUPS; filterHubSlotsByChips`.
- 51. Hold / Commit / Open invitation modes: `ExploreInviteSheet.tsx`.
- 52. RSVP deadline / majority vote: `ExploreInviteSheet.tsx; app/main.py: polls routers`.
- 53. Split cost / create expense: `ExploreSavedBar.tsx; app/services/expense_service.py`.
- 54. Region tabs and destination carousel: `ExploreDestinationsSection.tsx; explore-destinations.ts`.
- 55. All countries destination directory: `destinations/page.tsx; explore-destinations.ts`.
- 56. Surprise me destination choice: `ExploreDestinationsSection.tsx: surprise`.
- 57. Destination popularity / trending / flight-time badges: `explore-destinations.ts; ExploreCityReelCard.tsx`.
- 58. Destination reel imagery: `ExploreCityReelCard.tsx`.

## Recommended execution order and acceptance gates

1. **Truth and reliability first:** remove synthetic reviews, unsupported open-now/all-in/attendance claims, and fake success states; separate generated suggestions from inventory. Gate: unknowns remain unknown and no unsupported success appears.
2. **Discovery correctness:** repair places fallback; propagate selected coordinates, country, radius, dates, provider, currency, cache timestamps; fix zero-result behavior and request races. Gate: a location/date/filter matrix produces correct results and genuine empty/error states.
3. **Finish the basic journey:** correct details -> provider link -> persistent save. Gate: a real listing opens its verified provider URL; saves survive reload and city switches under the intended account/guest behavior.
4. **Useful plans:** support budget/party/time constraints, diverse options, and actual save-to-day/cart behavior. Gate: accepted plans satisfy input constraints and use verified listing IDs. Connect Wayra only after deterministic contracts are reliable.
5. **Optional group and destination expansion:** adapt invitations/polls/expenses, then improve directory coverage and imagery. Gate each independently on durable backend results, permissions, and error handling.

## Verification performed in this audit

- Graph query: successful via .venv/Scripts/python.exe -m graphify.
- Frontend TypeScript: node node_modules/typescript/bin/tsc --noEmit --incremental false; exit 0.
- Explore helpers: Vitest, 3 files / 9 tests passed.
- Hero/location/photo helpers: Vitest, 3 files / 16 tests passed.
- Total focused tests executed: 25 passed. These tests do not exercise checkout, invitation delivery, production provider freshness, or every React interaction.
- No browser/mobile session, production API/provider call, full backend test suite, database mutation, or deployment was performed. Backend availability and live city coverage remain unverified.
- No application code changed in this audit. Graph update is not needed for this documentation-only change.

## Record and next action

Goals addressed: clarify every main-page feature, prioritize delivery, and distinguish implemented UI from completed user outcomes. Result: this dated audit and a derived in-conversation completion diagram. No feature was marked complete merely because a historical document claimed it or a button displayed success.

Next action: implement Critical items first, beginning with unsupported claims and the location/filter/provider correctness defects. Recompute these counts after verified changes; do not treat this snapshot as a permanent project completion percentage.

## 2026-09-22 follow-up — selected location discussion

The first row above reflects a later working-tree implementation than the original audit. `useExploreHub` now accepts a location scope, and `requestSeq` prevents an older hub response from replacing a newer one. The earlier wording that all hub requests lack stale-response protection was incorrect for the current code. This follow-up does not re-audit or change the other 57 rows or the overall counts.

Proposed behavior for a clean Explore location experience:

1. Represent the selection as one scope: stable location ID when available, full label, city, state/region, country, optional in-memory coordinates, and source (`link`, `manual`, `saved`, `gps`, or `ip`). Use the same scope for heading, hero media/weather, listing query, counts, and filters. Keep a separate `currentLocation` so the user can return to GPS without losing an explicitly browsed destination.
2. On page load, precedence is explicit URL location > remembered manual choice > browser GPS > approximate IP > honest unselected/default state. Automatic GPS/IP can suggest a location but must not replace a deliberate destination selection. The explicit `Use my current location` action may switch the active scope at any time.
3. Persist the intentional choice as city/region/country or a catalog ID, not a city string alone. Do not store precise GPS coordinates by default: the location sheet promises that Rovvy does not keep them. Resolve the destination coordinates as needed, keep GPS coordinates in memory, and offer `Forget chosen location` or `Use my current location` in the location sheet. A signed-in account preference can come later if users want cross-device sync.
4. Keep the URL synchronized with explicit destination choices so a shared link and browser Back/Forward reproduce the same scope. After the user changes the city, the old `?city=` must not reapply it on navigation or refresh. Reset should return to the previous/current location, not hard-coded Chicago.
5. Give hero, geocoding, and inventory requests a selection version and abort signal where supported. Ignore results from older versions. While a new destination loads, label existing results as belonging to the previous location or hide them; never show a Paris heading with Chicago cards, weather, or photo.
6. Make the location control readable: `Exploring Paris, France` plus `Change` and `Use my current location`; show `Approximate` only for IP-based location. If no imagery/weather exists for the destination, show a neutral background and `Weather unavailable` instead of reusing another city's media.

Acceptance scenarios: (a) a bookmarked Paris link beats saved Chicago and auto-GPS; (b) choosing Tokyo after GPS Chicago updates header, hero, inventory, counts, and URL together; (c) a slow Chicago response arriving after Tokyo cannot repaint any of them; (d) reload restores a chosen `Paris, France` scope without exposing precise GPS; (e) browser Back restores the prior scope; (f) manual `Use my current location` returns to current GPS/IP and updates the URL; (g) a failed destination fetch preserves the chosen scope and shows a retry with no other-city data.

Verification for this follow-up: read-only inspection of current Explore page, hero, scope, fetch hook, and product record. No new tests, browser run, or application change was made.
