# Rovvy Explorer Product Record

This folder is the authoritative Scram Book record for the Explorer hub and its discovery experience.

## 2026-09-11 — Explore v6 HTML port + global forest-green tokens

### Context

User approved porting `Rovvy Explore v6.dc.html` into production code with global (not page-scoped) forest-green tokens, Instrument Serif + Schibsted Grotesk + JetBrains Mono on all pages, fixture data from the HTML `SLOTS` object, and larger `RovvyLogo` on Explore.

### Goals addressed

- Promote Explore v6 palette to global `:root` tokens (`#0E6E5C` primary, `#FBFAF7` app background, warm muted labels).
- Replace Inter/Outfit/Playfair with Schibsted Grotesk / Instrument Serif / JetBrains Mono site-wide.
- Port full page interactions: chips, Wayra plans, masonry feed, ranking table, city reel, detail drawer, invite sheet, saved bar with party stepper.
- Use HTML fixture inventory (128 Chicago slots, 9 listing cards, 6 ranking rows) for visual verification.

### Verified result

- Global: `frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/tailwind.config.ts`, `frontend/lib/design-tokens.ts`, `frontend/lib/brand.ts`.
- Explore: `page.tsx`, `explore.module.css`, `explore-fixtures.ts`, `components/*` (8 shared components).
- `npx tsc --noEmit`: 0 errors. `vitest run lib/__tests__/design-tokens.test.ts`: 2 passed.

### Risks / limitations

- Fixture data is intentional mock Chicago content from the design file — not live DB inventory.
- `explore-hub-data.ts` / `use-explore-hub.ts` remain in repo but are not wired to the v6 page after this port.

### Next action

When DB caches populate, merge fixture shapes with live API responses while preserving empty/loading honesty.

## 2026-09-11 — Explorer v6 design implementation

### Context

Rebuilt the local `/explore` page to match the supplied `Rovvy Explore v6.dc.html` reference. The reference was treated as a visual and interaction specification; its embedded template directives were not executed or copied as application logic.

### Goals addressed

- Establish the warm cream, ink, and emerald visual system from the reference.
- Replace the carousel-led hub with a prompt-first discovery flow focused on tonight, social availability, price clarity, and group coordination.
- Preserve usable Rovvy navigation, authentication gates, detail exploration, and responsive behavior.

### Verified result

- Added a custom responsive Explorer header and removed the shared desktop dashboard header only on the exact `/explore` route.
- Added the prompt composer, date choices, live activity strip, selectable count and vibe chips, expandable filters, Wayra plan response, friend activity, four-column discovery feed, ranking table, destination rail, and group-plan call to action.
- Activity and ranking cards open the existing `ExplorerItemDetailDrawer`.
- Login-gated group actions route authenticated users and show a sign-in message to guests.
- Files affected: `frontend/app/(dashboard)/explore/page.tsx`, `frontend/app/(dashboard)/explore/explore.module.css`, and `frontend/app/(dashboard)/layout.tsx`.

### Verification

- `node node_modules/typescript/bin/tsc --noEmit`: passed with zero errors.
- Focused ESLint on the Explorer page and dashboard layout: zero errors; ten existing warnings remain in the shared layout.
- Live browser QA at `http://localhost:3000/explore`: page rendered, responsive header wrapped at the narrow in-app viewport, full content was exposed to the accessibility tree, `Plan it` opened three Wayra plan options, and `Refine` opened all filter groups.

### Data environment and limitations

The v6 reference contains explicitly mocked Chicago slot counts, social activity, rankings, availability, reviews, and price examples. This implementation preserves that supplied presentation data to match the requested design. It must not be described as live provider inventory. The prior hub-level API-fed carousels were replaced; the dedicated `/explore/events` route remains the path to the existing event experience.

### Next action

Connect the v6 slot, ranking, friend-activity, and Wayra plan shapes to verified Explorer API responses while retaining honest loading, empty, freshness, and provider states. Replace the reference image placeholders only when approved assets or provider images are available.

## 2026-09-11 — Explore hub wired to per-city database APIs

### Context

User rejected mock Chicago slot data on `/explore`. The page must read live inventory from the connected per-city database cache (events + places), not hardcoded template rows.

### Goals addressed

- Remove fake slot, stats, ranking, and social-activity data from the v6 Explore hub.
- Load city-scoped listings from existing backend endpoints.
- Keep v6 visual layout; show honest loading, empty, and source states.

### Verified result

- Added `frontend/app/(dashboard)/explore/explore-hub-data.ts` — fetches `/explore/events`, `/explore/places` (attractions + restaurants), maps to v6 card/table shapes, computes category stats from real rows.
- Added `frontend/app/(dashboard)/explore/use-explore-hub.ts` — city state via `rovvy_explore_city`, reload on city change.
- Updated `frontend/app/(dashboard)/explore/page.tsx` — removed hardcoded slots/stats/ranked/social copy; grid, stats, ranking, and Plan-it matches use API payload; empty state when DB returns zero rows.
- Removed fake pulse/friend/broadcast social rows; data-source bar shows provider labels from response.

### Verification

- `npx tsc --noEmit`: passed with zero errors on explore modules.

### Risks / limitations

- Browse-first `/explore/events` and `/explore/places` depend on backend cache population per city; empty cities show an honest empty state (not placeholders).
- v2 PostGIS `/api/v2/explorer/*` (auth-required) is not yet merged into the v6 hub grid — current feed uses v1 explore cache + places DB.
- Wayra plan panel shows top DB matches by prompt filter, not a full multi-provider stitch yet.

### Next action

Optionally add authenticated v2 nearby/events merge for logged-in users; wire friend-activity only when a real social API exists.

## 2026-09-11 — Responsive navigation correction

### Context

At narrow viewport widths, the Explorer-specific top header and the shared dashboard bottom tab bar were both visible. This duplicated the Explore, Live, and Trips destinations and reduced the usable content area.

### Verified result

- Synchronized the Explorer breakpoint with the dashboard `md` boundary at 768 CSS pixels.
- Below 768px, the Explorer-specific header is hidden and the shared bottom tab bar is the sole primary navigation.
- At 768px and above, the Explorer-specific header remains visible while the shared bottom tab bar remains hidden.

### Verification

- Live browser QA at `http://localhost:3000/explore` in the existing narrow viewport confirmed the page begins with the Explorer hero and exposes only the shared bottom navigation in the accessibility tree.

### Remaining risk

Responsive switching follows the effective CSS viewport, so browser zoom or operating-system scaling can cause a physically large window to use the mobile layout. This is expected responsive-browser behavior.

## 2026-09-11 — Live location hero

### Context

The Explore hero needed location-aware presentation without retaining a user's coordinates or blocking the page's first paint.

### Goals addressed

- Resolve browser coordinates when explicitly supplied, otherwise use an approximate request-IP location.
- Keep Nominatim, Open-Meteo, Wikimedia Commons, and optional Flickr calls on the server.
- Accept only source-geotagged photos within five kilometres, with minimum-width and title filters.
- Keep the location guess visible and correctable through a location sheet.

### Verified result

- Added `GET /api/hero`, which always returns a nullable response shape with a neutral colour fallback and HTTP 200 degradation.
- Added a one-hour in-memory cache shared by normalized city and local hour bucket. The application does not write coordinates, history, or images to the database, filesystem, or object storage.
- Nominatim calls are serialized to one request per second and use `RovvyExploreHero/1.0 (+https://rovvy.app; contact: contact@rovvy.app)`.
- Wikimedia Commons is tried first; `FLICKR_API_KEY` enables the optional server-side fallback.
- The Explore hero now paints a colour immediately, fades in a geo-verified photo, preserves the fixed contrast scrim, displays required attribution, and exposes a glass location card.
- The location sheet allows exact browser geolocation without authentication, treats denied GPS as an approximate IP choice, gates city browsing behind sign-in, and displays the promised location-retention reassurance.

### Verification

- TypeScript: passed with zero errors.
- Focused ESLint: passed with zero errors or warnings.
- Vitest: 10 tests passed across distance-band boundaries, IP fallback, GPS denial, Nominatim failure, rejected photo candidates, unknown location, and a 300-mile no-city case.
- Live API QA: an explicit Uptown coordinate resolved to `Uptown, Chicago`, current weather, and a Wikimedia photo whose source coordinates were inside the five-kilometre radius.
- Live browser QA: the IP fallback resolved to `Mundelein · approximate`; the location card opened the sheet with an unauthenticated disabled city field, inline sign-in prompt, exact-location action, and retention statement.

### Risks and next action

- IP location is approximate and, in local development, reflects the outward-facing development network address.
- Wikimedia quality varies even after geographic, dimension, aspect, and title filtering. Configure Flickr when higher-volume neighbourhood imagery is needed.
- The location card currently receives the Explore page's existing slot count. Replace that input when the broader feed gains a radius-aware live-count contract using `suggestedRadiusMiles`.
