# Collection Tab (My Space)

## Artifacts

| File | Description |
|------|-------------|
| [Rovvy_Collection_Scrum_Book.xlsx](./Rovvy_Collection_Scrum_Book.xlsx) | 287-item Collection feature, UI and graphics inventory (C001–C287, 170 Features) in the Live/Seats tracker format. **Collection Tasks** column **L** = Cursor development plan per row; worksheet **Cursor Context Log** = full raw log (287 rows). Other tabs: `Sprint Plan`, `Review`, `UI Likes & Dislikes`, `User Review`. |

---

## 2026-11-15 — Collection bug audit: 82 proven bugs registered, 50 fixed

**Context:** Owner expected at least 250 bugs and asked for each to be registered with a solution. The whole tab was audited: backend routes and services, link safety, the place extractor, and every page, component and helper in `frontend/app/(dashboard)/collection`. Method: live API probes, probes of the extractor and link guard, a Node check of the link helpers, and a full read of the code. A bug is listed only if it was reproduced or the code shows it.

**Goals:** find real bugs, give each a solution, fix what is safe now, and keep the rest visible.

**Result:**
- New sheet **Bug Register** in `Rovvy_Collection_Scrum_Book.xlsx`: 82 bugs (9 High, 34 Medium, 39 Low), each with how it was found, the solution, status and test. 50 Fixed, 32 Open (marked yellow with the reason). Backup: `Rovvy_Collection_Scrum_Book.backup-2026-11-15-bug-audit.xlsx`. One Cursor Context Log row added (status Partial).
- **The count is 82, not 250.** The rest of the 250 was not found; padding the list would hide the real ones.
- Worst fixed: blank names saved (B01, B02); a link read held a database connection for up to 10 s on a pool shared with production (B12); link clean-up deleted real parameters such as a forum thread id (F01); links over 500 characters were cut and saved broken (F05); about 14 real venue names dropped as headings (X01); typing in a card was lost on every star tap (F13); a broken shared link crashed the receive page (F15); a stale tag filter left an empty page with no way out (F09).
- Biggest still open: no paging on the list (B17), one notification per place when saving several with friends (B20), the YouTube daily cap and read limit live in one process's memory (B24), the map shows made-up positions (F29), undo re-creates a row (F12), and nothing is tested on a real phone (F42).

**Verification:** backend `pytest` full suite passed (new `tests/test_collection_audit.py`, 33 tests); frontend `vitest` full suite 1006 passed (new `collection-audit.test.ts`, 12 tests); `tsc` and `eslint` clean for the Collection folder. **Not verified in a browser:** the local site could not build (another session's Wayra files are missing: `WayraMessageList`, `WayraComposer`) and the API was down, so the page changes (F05 to F28) are covered by unit tests and code reading only.

**Risks:** the page changes are untested in a browser; the new group check (B04) and the `rollback` before a link read (B12) have not run against Postgres; B08 (403 vs 404) was left as is because existing tests and the recorded design expect 403.

**Next action:** re-run the stubbed browser check once the Wayra files exist; then work the Open rows by severity, starting with B17, B20 and B24; run the real-device checks (F42).

---

## 2026-11-14 — Sprint C4 (share in, tags, send to friends, preview), first pass

**Context:** Owner described two capture flows: (1) on a phone, share a reel/video from Instagram, YouTube or X straight into Rovvy and tag friends; (2) on the web, paste the link in the Collection tab, see it, save it and tag friends. Owner chose the **clipboard stopgap for iPhone** (iOS has no share target for web apps). Gemini's source report was checked against AGENTS.md first; its Instagram/TikTok oEmbed claims are unverified, so those stay link-only.

**Result:**
- **Share target:** `manifest.json` share_target now opens `/collection/share` (the old `/cart/extract` route no longer exists and scraped Instagram). The page takes the link from `url`, `text` or `title`, opens `/collection?q=<link>&shared=1` and reads it once. iPhone: "Paste copied link" button reads the clipboard on tap and reads the link.
- **Tags:** table `collection_item_tags`, `tags` on create/patch/list, `?tag=` filter, tag facet; UI: tag field on the result and on every card, tag chips filter, `#tags` shown on cards, kept on undo.
- **Send to friends:** `POST /collection/items/{id}/share` copies a save into each accepted friend's Unsorted (source Friend, `shared_by_user_id`), without note, stars, collection or tags; idempotent; 403 for non-friends or pending requests; in-app notification plus push. UI: friend picker on the paste result (save and send in one step) and on each card; friend's card says "Shared by <name>".
- **Preview:** YouTube shows the whole thumbnail (hot-linked), channel, title, tap-to-play in YouTube's embedded player, Open original, YouTube Terms and Google Privacy links; nothing stored. Instagram/TikTok/articles: label and link only.
- Migration `migrations/024_collection_tags_shares.sql` written, **not applied** to production.
- Workbook: C112 and C179 Complete in code; C037, C038, C046, C216, C277 Partial. Backup `Rovvy_Collection_Scrum_Book.backup-2026-11-14-c4.xlsx`.
- Fixed an old test (`test_extract_link_success`) that was silently querying the real database; it is now mocked.

**Verification:** backend `pytest` link reader + collection + tags/share: 73 passed (16 new, in-memory SQLite, no real database, push mocked). Frontend `vitest` full suite: 739 passed (9 new); `tsc` shows no Collection errors (other errors are in Explore files from other sessions). Browser, signed in with the API stubbed in the page: Android-style share with the link inside text lands on Collection and reads once; tags and a friend saved and sent in one click; tag chip filters; card tag edit saves one PATCH; send from a card; "Shared by Tomas"; YouTube play opens `youtube.com/embed/<id>` with strict-origin-when-cross-origin at 480x270; clipboard button with a link, no link and a blocked clipboard; no horizontal overflow at 375 px.

**Risks:** Not tried on a real phone: the Android share needs the PWA installed; iOS clipboard prompt behaviour is unverified. Migration 024 is required before this works in production (the list query selects `shared_by_user_id`, so deploying the code without the migration breaks Collection). The YouTube policy question on deriving places from video text is still open. Friend list uses `/social/connections` (accepted friends only). The paste-result tags/friends apply to every place saved from that link.

**Next action:** Owner approval to apply migration 024 and run the Postgres test (rolled back); install the PWA on an Android phone and share from Instagram/YouTube; show `collection_share` notifications with a link to Unsorted (C277); decide on Instagram/TikTok embeds after a terms check; fill `places_directory` (GeoNames + Overture Divisions) so cities show "sure".

### Addendum 2026-11-15 (newest) — share a place OUT (C125)

**Owner request:** from a place, tap the external share button and the phone's share menu opens; the receiver gets a link that opens Rovvy. **Built:** a Share button on every saved card (Web Share API; falls back to copying the link). The link is `/collection/add?name&city&country&category&from` and carries only the place and its original source link, never the note, stars, tags or collection. New page `/collection/add` ("A friend shared a place"): editable name/city/category, "Save to Unsorted" (source Friend, one save per link; signed-out users go to login and return), "Not now". The old "Send to friends" button is renamed "Send to Rovvy friends" (in-app, C179).

**Verification:** frontend vitest 767 passed (8 new share-link tests); tsc and eslint clean for Collection. Browser, API stubbed with a mocked share menu: Share called with title, text and the Rovvy link; clipboard fallback copied it; opening the link showed the filled form; Save created one Unsorted Friend row with no note or tags. **Not done:** real WhatsApp/Messages on a phone; whether the link opens the installed web app or the browser depends on the phone. C125 marked Partial for that reason.

### Addendum 2026-11-15 (latest) — every link and reel is saved automatically

**Owner request:** all links and reels must be saved in the app. Before, an Instagram/TikTok link or a link with no found place was only saved if the user clicked "Keep link in Unsorted". Now `handleReadLink` saves the link to Unsorted first, then reads it, so nothing is lost when the site blocks us, the read fails or is rate limited, or the platform is Instagram/TikTok (never read). Details: share-tracking parameters are stripped (`canonicalLink`) so the same reel shared twice is one save; Instagram/TikTok rows get source Reel, others Link; the name is the title when known, else "Instagram reel <code>" or the host and path; after a read the row is renamed to the real title. Tags and friends picked later are applied to the saved link ("Add tags / send to friends"). The phone share target goes through the same path.

**Verification:** frontend vitest 759 passed (collection suite 31, 5 new helper tests), tsc and eslint clean for Collection. Browser, API stubbed: Instagram reel with `?igsh=` saved before the read; same reel with different tracking saved once; YouTube row renamed to its title; a failing read still left the link saved with "Your link is saved in Unsorted"; TikTok link tagged and sent to a friend after saving; share-sheet text containing an Instagram link created the row. Backend unchanged.

**Risks:** the link row stays next to any place rows saved from it (one extra card per source; remove it if unwanted). Stripping parameters treats `?t=` as tracking except on YouTube; unknown sites with a meaningful `s` or `ref` parameter lose it. Dedupe is by exact cleaned link. Not tried on a real phone.

### Addendum 2026-11-15 (later) — Gemini removed from the link reader

**Owner decision:** Gemini is kept for Wayra only; using it per pasted link would cost too much. The link reader no longer calls any AI model. New `app/services/place_extractor.py` finds places with rules: articles use schema.org JSON-LD (ItemList, Restaurant, TouristAttraction...), then numbered or list-style headings; YouTube uses chapter lines (`3:45 Name`), pin lines (`📍 Name`) and `Location:` lines from the description; the city comes from the page's address data or a title like "... in Lisbon". Generic lines (Intro, FAQ, Where to stay, Sponsor...) are dropped. Instagram/TikTok are unchanged (link-only). Also: `safe_fetch_text` now has a hard wall-clock limit (a live site held one request for 63 s despite 8 s inner timeouts; now 10 s at most).

**Verification:** 83 backend tests pass (10 new rule tests, a hard-timeout test; the Gemini prompt, JSON and token tests were removed with the code). Live check of 7 article URLs, no AI: 1 read correctly (10 places), 5 refused or not found by the site, 1 timed out. This is **not** the 9 of 10 Gemini reached; accuracy on real pages is untested and likely lower, because rules cannot read plain prose. Every result is still shown for the user to check and edit before saving.

**Gaps and next action:** places only mentioned in sentences are missed; YouTube chapters can be activities, not venues; a title without "in <city>" leaves the city empty (goes to Unsorted). Re-score on 10 real links (articles and chaptered YouTube videos); if too weak, options are a free open-source name matcher against Overture/GeoNames, or letting the user type the place. `places_directory` still needs filling.

### Addendum 2026-11-15 — link reading speed

Owner reported pasted YouTube/Instagram links felt slow. Measured server time per link: Instagram and TikTok about 0.3 s (no outside call; Rovvy never fetches them); articles 0.5-1.3 s plus the page's own speed (limit 8 s); YouTube 4-8 s, almost all of it the Gemini call (old gRPC SDK with thinking on). Changes: Gemini now called over plain HTTPS with thinking off (YouTube read 4-8 s down to about 1 s, same places on the test text); one database lookup for the link and all its places instead of one per place. 73 backend tests pass (the route test now also asserts a single lookup). Finding: the Supabase session pooler allows only 15 clients and is shared with production, so dev runs sometimes get EMAXCONNSESSION and wait; that is a separate cause of slowness and is not fixed here.

### Addendum 2026-11-14 — migration 024 applied to production

Owner approved. `migrations/024_collection_tags_shares.sql` ran in one transaction against Supabase and was committed: table `collection_item_tags` and column `collection_items.shared_by_user_id` now exist (before: neither). New test `test_tags_filter_and_share_with_friend` plus the 5 existing Collection tests ran on real Postgres inside a rolled-back transaction: 6 passed, and afterwards 0 rows left in tags, shares, test users or notifications. C216 is now Complete in code; the "not applied" risk above is closed. Still open: real-phone share check, notification UI (C277), Instagram/TikTok embeds, `places_directory`. Backup `Rovvy_Collection_Scrum_Book.backup-2026-11-14-c4-migrated.xlsx`.

---

## 2026-11-14 — Sprint C3 (link reader v1), first pass

**Context:** Owner asked to start Sprint C3. No separate "video plan" exists for this tab; the old cart route `/cart/extract-from-url` scrapes Instagram (Instaloader) and YouTube (yt-dlp), which AGENTS.md section 4 does not allow, so it was NOT reused. Owner decisions today: (1) coordinates are **city only**, no venue coordinates stored (no external geocoder); (2) **Instagram/TikTok links are kept link-only**, never read.

**Result:**
- `app/services/link_safety.py`: SSRF guard and bounded fetch (public addresses only on every hop, standard ports, no credentials, max 3 redirects, 1.5 MB, HTML/text only, 8 s).
- `app/services/link_reader_service.py`: YouTube via the official Data API `videos.list` only (title + description, own cap 1,000 units/day, nothing stored from the API); public articles via the safe fetcher and bs4; Gemini (existing key) extracts up to 10 named places from the text, told to ignore instructions in the page; city/country normalised against `places_directory`; per-user limit of 10 reads/hour (429).
- `POST /collection/extract-link` now returns `source_url`, `link_only`, `link_saved` and per-candidate `already_saved`; each candidate has its own `saved_from` (`link#place=slug`) so several places from one link all save.
- Frontend: `CollectionLinkResult.tsx` (editable name/city/category, Save, Save all, Saved ✓, "City not confirmed, goes to Unsorted", Keep link in Unsorted), `collection-link.ts`, clickable From link, new consent copy on the paste card.
- Workbook: 13 rows Complete in code, 4 Partial (C051, C053, C054, C045). Backup `Rovvy_Collection_Scrum_Book.backup-2026-11-14-c3.xlsx`.

**Verification:** `pytest tests/test_link_reader.py tests/test_collection.py tests/test_collection_idempotent_save.py`: 53 passed (network and model mocked; 41 new cover SSRF, redirects, limits, parsing, rate limit, route 401/422/429). `vitest` collection: 17 passed (6 new). Live check of the fetcher: example.com read; localhost:3000, 127.0.0.1:8000, 169.254.169.254 refused. Browser, signed in with the API stubbed in the page: multi-place result, edit then save, Save all (3 rows, the city-less one to Unsorted), re-read shows Already saved, Instagram link-only kept in Unsorted, From link opens in a new tab, no overflow.

**Risks:** No live Gemini or YouTube API call was made, so extraction quality is unmeasured (the sprint exit test, 10 real links at 80%, is NOT done). Place names from YouTube descriptions are used transiently; nothing from the API is stored except what the user saves (name/city), but the YouTube policy question on deriving data from video text is open. DNS rebinding window remains between the address check and connect. In-memory rate limit and YouTube counter are per process (reset on deploy, not shared across instances). Pins stay unplaced until a venue source is chosen. Link-only saves use the link as the name.

**Next action:** Run the 10-link test with real keys (needs owner OK for Gemini/YouTube calls), then C066/C067 (collection picker and note at capture), C046 (preview, subject to the YouTube 30-day storage rule), and the remaining C1/C2 leftovers.

### Addendum 2026-11-14 — live 10-link test (real Gemini + YouTube API, nothing saved)

**Run:** 13 real links (YouTube videos and public articles), through `read_link` only; no rows written, no Instagram/TikTok fetched.
**Result:** 3 sites refused or timed out an honest-UA fetch (falstaff 403, questoapp 429, theculturetrip timeout); we did not spoof a browser, and the message now reads "That website does not allow Rovvy to read it." On the readable pages, **9 of 10 gave correct place lists (about 90%)**; counting blocked sites, 9 of 13 (about 69%). The 80% target is met on readable pages only. Scoring is my own judgement (no recall measure); the prompt was tuned on the first 10 links, and 3 fresh articles then passed 3 of 3.
**Fixes made because of the test:** Gemini JSON was truncated because thinking tokens shared the 2,048-token limit; the reader now has its own call (8,192 tokens, JSON mime type, temperature 0) plus a salvage parser for cut-off output; the prompt now excludes cities, neighbourhoods, regions, sponsors, incidental hotels, universities, people, brands and passing mentions. 45 tests in `tests/test_link_reader.py` pass.
**Known gaps:** video W_nm_V4BGFY still returns the sponsor resort instead of nothing; long lists are cut (12,000 characters of text, 10 candidates; one article has 21 places and only 5 fit); `places_directory` in production is almost empty (2 cities, 2 admin1, 1 country; Lisbon, New Orleans, Austin do not resolve), so most candidates show "City not confirmed" and go to Unsorted until the directory is filled or a venue source is chosen; YouTube policy question on deriving places from video text remains open.

## 2026-11-13 — Sprint C2 (editable and organised saves), first pass

**Context:** Owner asked to start Sprint C2 after C1 was committed (9d80bee).

**Goals addressed:** Notes, stars, rename, move, remove with undo, named collections list, Explore saves visible, unsorted saves visible.

**Result:**
- Backend unchanged (PATCH `/items/{id}` and GET `/collections` already existed); only tests added.
- Frontend: `updateCollectionItem` and `fetchCollections` in `collection-api.ts`; new `CollectionCardEditor.tsx` and `collection-edit.ts`. Open a save to tap stars (tap again clears), edit name/city/category/note (one PATCH of changed fields), pick a collection, File it (unsorted), or Remove with an 8-second Undo toast that re-creates the row.
- Collection chips above the grid (All saves + named collections) filter the page; New collection is an in-app form and selects the new chip. Empty collection has its own message.
- Unsorted saves show in an Unsorted section at the top (old bottom banner removed).
- Explore saves (`explore-hub-save.ts`) now go straight to the grid (known city) and no longer put the listing summary in the note. Test updated.
- Workbook: 14 rows Complete in code, 3 Partial (C158, C078, C217). Backup `Rovvy_Collection_Scrum_Book.backup-2026-11-13-c2.xlsx`.

**Verification:** `npx vitest run` collection + explore-hub-save: 16 passed (5 new in collection-edit). `pytest tests/test_collection.py tests/test_collection_idempotent_save.py`: 12 passed (6 new: PATCH 401/422/success, other user's PATCH and DELETE 403, collections list). `tsc` shows no Collection errors. Browser, signed in with the API stubbed in the page (no account, no database write): star, edit, move, chip filter, File it, remove + Undo, new collection all sent the expected PATCH/POST/DELETE and the page updated; no horizontal overflow.

**Risks:** Not run against the real API or Postgres (no Postgres test yet, C262). Undo creates a new row id and created_at. Edits are not optimistic: the list reloads after each change. The Explore save path was checked by unit test, not by clicking Save in Explore. Collection rename/delete, per-collection view, sort control, multi-select and pagination are still pending.

**Postgres test (added same day):** `tests/test_collection_pg.py`, 5 tests driving the real routes against PostgreSQL inside one rolled-back transaction (opt-in `COLLECTION_PG_TEST_URL`, marker `collection_postgres`). Covers create/list/patch/delete, country filter with unfiltered totals, unsorted counts, same-`saved_from` dedupe, named collections and move, another user's data returning 403 or empty, and ON DELETE SET NULL. Without the URL: 5 skipped. **Run against Supabase, rolled back (owner-approved):** 5 passed. Afterwards 0 leftover test users and the collection tables already existed, so no DDL was needed. C262 is Complete in code. The local Postgres 18 needed a password we did not have.

**Next action:** Sort control and per-collection grouping, then finish C1 leftovers (skeleton loading, removable filter chips) before Sprint C3 (link reader).

---

## 2026-11-13 — Sprint C1 (truthful states), first pass

**Context:** Owner asked to start Sprint C1 on `/collection`. There is no separate video plan for this tab; the YouTube/reel reader belongs to Sprint C3.

**Goals addressed:** Show nothing fake or broken: sample data only for guests and labelled, real empty/no-match/error states, real dates, unwired controls hidden, honest filters, filter dialog accessibility, link kept through login.

**Result (frontend only, no backend or database change):**
- Guests see "A sample collection" with a Sample banner and sign-in button. Signed-in users never see sample places: 0 saves gives "Nothing saved yet", no match gives "No saves match" with Clear filters, a load error gives the error with Try again.
- `formatSavedWhen` now returns real dates; the "From" line hides `explore:listing:` keys.
- Removed: sponsored card, fake Shared badge and AR/TK avatars, To a vote, Move, Add a place, Sort them out, New collection, empty note box and star row, platform tags, "we find the place in it" copy. Paste card says link reading is not switched on yet.
- Filters work for guests; map pins and counts follow what is shown (pin positions are still illustrative, real map is C4). Filter dialog: aria-modal, takes focus, Esc closes and returns focus. aria-expanded on cards, aria-pressed on toggles and chips. Enter submits the link; a guest's link survives login via `?q=`.
- Workbook: 13 rows Complete in code, 15 Partial (dated, coloured, Evidence and Cursor Context Log updated). Backup: `Rovvy_Collection_Scrum_Book.backup-2026-11-13.xlsx`.

**Verification:** `npx vitest run app/(dashboard)/collection`: 6 passed (4 new). `npx tsc --noEmit`: clean. Browser, `localhost:3000/collection`, logged out: sample headline and banner, no sponsored/shared/dead buttons, 11 aria-expanded, no horizontal overflow, Portugal filter showed only Lisbon, Esc closed the dialog and focus returned, Read it went to `/login?next=/collection?q=<link>`.

**Signed-in check (same day):** with the API stubbed in the page (no account, no database write; the local API points at production Supabase): 0 saves gives "Nothing saved yet"; 1 and 50 saves show only their own cards; Portugal gives "25 of 50"; no-match shows "No saves match" and Clear filters restores all; a forced 500 shows the error with Try again, which reloads; Enter runs the link read; real date "3 days ago" and From "Explore" shown. Six more rows (C032, C138, C162, C223, C224, C229) moved to Complete in code.

**Risks:** Signed-in text search (C019) and return after a real login (C035) are not checked, so those rows stay Partial. Focus is not trapped in the dialog. Unsorted saves are still hidden from the grid until C2. Sample cards keep invented ratings and hours, but only inside the labelled sample.

**Next action:** Finish C1 leftovers (skeleton loading, removable filter chips, contrast, headings) and start Sprint C2 (wire PATCH and collections list).

---

## 2026-09-27 — Collection Scrum-book analysis and UI review

**Context:** The owner asked for a Scrum-book analysis of the built Collection frontend in the same column format as the other tabs. It should rate every feature, list the UI likes and dislikes, include evidence, and give a detailed user review. The stated purpose is to save places, dinners and experiences seen on Instagram, YouTube and similar apps as a collection of interests for future travel and as a travel memory.

**Goals addressed:** Catalogue every control, display, action and backend behavior. Include missing capabilities needed for the stated purpose. Separate status, importance and difficulty. Record evidence and acceptance checks. Rank Critical findings. Define the sprint order and the test plan.

**Result:** Created `Rovvy_Collection_Scrum_Book.xlsx` with **287 rows**: 170 Feature, 93 UI extension and 24 Graphic. Status: **72 Complete in code, 74 Partial, 141 Pending**. Importance: **57 Critical, 157 Important, 73 Later**. The rows fall into 29 workstreams, from Page shell to Analytics.

**Critical findings (not fixed in this review):**
1. **F1 Demo data shown as the user's own.** Guests, new users, users whose filter has no matches, and users after an API error all see 10 fixture places headlined "places you kept" (`page.tsx:192`).
2. **F2 The link reader is a stub.** `extract_link` always returns zero candidates and stores nothing, yet the UI says "Link saved for review".
3. **F3 Many dead controls.** Note, stars, Move, To a vote, Sort them out, Add a place and the sponsored buttons do nothing. PATCH `/items/{id}` and GET `/collections` exist but are never called.
4. **F4 Explore saves vanish.** They are written with `is_unsorted=true`, and unsorted items are hidden from both grid and map. Live saves are not synced.
5. **F5 Wrong memory cues.** `formatSavedWhen` hard-codes "last Tuesday", "in May" and similar. Explore saves show a raw `explore:listing:` key and put the listing summary into "Your note".
6. **F6 The map is a CSS picture.** Pins sit at hard-coded positions and ignore filters.
7. **F7 Fake signals.** The shared badge and AR/TK avatars appear on any "Chicago" or "Food" section, and a hard-coded sponsored card is shown to everyone.
8. **F8 Multi-place links collapse to one save.** The server dedupes on `saved_from`.

**Verification:**
- Browser, `localhost:3000/collection`, logged out, ~400 px pane. Demo headline and sponsored card seen. Card open had no `aria-expanded`. Filter modal: Esc did not close it, `aria-modal` absent. Country=Portugal still showed "10 of 10" with Chicago cards. Map view had 0 canvas. Search `jazz` gave "1 of 10". The paste box rejects free text. Guest "Read it" went to `/login?next=%2Fcollection` and dropped the query and link. No horizontal overflow. Screenshots timed out in the pane, so checks used DOM reads. Nothing was submitted.
- `npx vitest run app/(dashboard)/collection`: **1 file, 2 passed**.
- `pytest tests/test_collection.py`: **5 passed** (mocked service, no Postgres). `GET /api/v1/collection/items` with no token → 401.
- The workbook reopened with 287 unique, fully populated IDs, table `A6:K293`, and dropdowns and COUNTIFs to row 293. LibreOffice isn't installed, so formulas recalculate on open. The workbook was not rendered visually.

**Unresolved risks:** Signed-in flows, Postgres behavior, devices, dark mode and screen readers were not exercised. Rows with "Source:" evidence need runtime checks. Priorities for missing capabilities need product-owner confirmation. No application code was changed. The `graphify` CLI is not installed in this shell.

**Sprint plan (added same day at owner's request):** The `Sprint Plan` tab places every row in a phase and sprint: C0 Baseline re-verify (72 rows); Phase 1: C1 Truthful states, wk 1–2 (56 rows) and C2 Editable saves, wk 3–4 (27); Phase 2: C3 Link reader v1, wk 5–7 (25) and C4 Phone capture, photos and real map, wk 8–9 (28); Phase 3: C5 Plan and remember, wk 10–11 (18) and C6 Group and sharing, wk 12–13 (11); Phase 4: C7 Memory, growth and polish, wk 14+ (50). Every Critical row falls in C0–C6. Week estimates assume one full-stack developer and are review judgments, not commitments.

**Next action:** Sprint C1 (truthful states): demo rules, empty, no-match and error states, real dates, hide unwired buttons, filter modal accessibility, and keeping the link through login. Then Sprint C2: wire PATCH and the collections list so saves are editable.

---

## 2026-09-17 — Collection MVP (backend + frontend)

**Context:** Replace top-nav Trips entry with Collection / My Space per design prototype `Rovvy Collection.dc.html`.

**Goals addressed:**
- Persistent saved places with city/country/category metadata
- Paste-link extract endpoint (stub; manual confirm flow)
- Grid + map views, filter modal, group by city/category
- Named collections API (create + list)

**Result:**
- Backend: `user_collections`, `collection_items` tables; `/api/v1/collection/*` routes
- Frontend: `/collection` page with design-aligned cream UI
- Nav: top bar **Collection** → `/collection`; Trips remains at `/trips` in sidebar subs

**Verification:**
- Backend: `pytest tests/test_collection.py -q` → 5 passed
- Frontend: `vitest run collection-grouping.test.ts` → 2 passed; `tsc --noEmit` → 0 errors

**Risks / next:**
- Link extraction is URL-parse stub only — no LLM/article parsing yet
- Live local saves (`live-saved-places-store`) not synced to server collection
- Run Alembic migration `20260917_user_collections` on production DB before deploy

**Next action:** Wire Live “Save to collection” handoff + real place extraction pipeline.
