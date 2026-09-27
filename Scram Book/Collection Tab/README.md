# Collection Tab (My Space)

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
