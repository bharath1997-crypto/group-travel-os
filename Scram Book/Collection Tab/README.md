# Collection Tab (My Space)

## Artifacts

| File | Description |
|------|-------------|
| [Rovvy_Collection_Scrum_Book.xlsx](./Rovvy_Collection_Scrum_Book.xlsx) | 287-item Collection feature, UI and graphics inventory (C001–C287, 170 Features) in the Live/Seats tracker format. **Collection Tasks** column **L** = Cursor development plan per row; worksheet **Cursor Context Log** = full raw log (287 rows). Other tabs: `Sprint Plan`, `Review`, `UI Likes & Dislikes`, `User Review`. |

---

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
