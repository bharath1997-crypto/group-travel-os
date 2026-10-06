## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

# Rovvy — shared rule book (all AI tools)

This file is the single rule book for every assistant working in this repo
(Claude Code via CLAUDE.md, Cursor via .cursorrules, Gemini/Antigravity via
GEMINI.md, Codex). Tool files may add tool-specific behavior but must not
contradict this file. Last consolidated: 2026-10-05.

## 1. Scram Book protocol (read before, record after)

`D:\group travel os\Scram Book` is the authoritative product record (the
spelling `Scram` is intentional). Each product tab has a folder with a
workbook (`Rovvy_<Tab>_Scrum_Book.xlsx`) and a `README.md` log.

Before work:
- Read the matching tab folder: workbook rows for the feature, README log,
  and any spec in that folder. Travel/Flights → `Scram Book\Travel Tab`
  (Flights Scrum plan + detailed product report).
- Do not contradict recorded decisions, acceptance criteria or gates.

After verified work, in the same tab folder:
1. **Workbook row** for each feature you developed (tasks sheet):
   - Prefix the Task / feature cell with the completion date: `[YYYY-MM-DD] Title`.
     Replace an older date prefix rather than stacking them.
   - **Complete** (acceptance met and verified): set Status `Complete in code`
     and fill the Task cell **green** `#DDF3E3`.
   - **Partial**: date prefix, Status `Partial`, fill **yellow** `#FFF2B3`;
     write the remaining gap in Acceptance / next action.
   - Prepend `YYYY-MM-DD: <what changed + how verified>` to the Evidence cell.
   - Append one dated row per updated feature to the `Cursor Context Log` sheet.
2. **README.md** entry (newest first): date, context, goals, result,
   verification (tests + numbers), risks, next action.
3. Never mark green or "complete" without evidence (tests run, browser/API
   check). Never record test/sandbox data as live data.
4. Do not create roadmaps or reports outside `Scram Book`. Add a new tab
   folder only when none fits. Back up a workbook before scripted edits and
   keep its formulas and conditional formatting intact.

## 2. Stack (approved — do not redesign unasked)

- Backend: FastAPI (Python 3.13), SQLAlchemy 2.0 `select()` style only,
  Pydantic v2 `ConfigDict` only, APScheduler.
- DB: PostgreSQL + PostGIS on Supabase (source of truth). Raw SQL files live
  in `migrations/NNN_*.sql` (unique numbers; applied manually).
- Frontend: Next.js + TypeScript. Follow the styling of the surrounding
  code (Tailwind in most pages; Explore uses `explore.module.css`).
- Maps: MapLibre GL + OpenStreetMap / OpenFreeMap tiles (not Google Maps
  rendering). Real-time: Firebase RTDB (ephemeral only). Auth: JWT `gt_token`.
- Ingest: `scaper/` is a separate process writing `ingest.*` and
  `public.events`; Rovvy reads. See `Scram Book/Explorer Tab/Scaper_*.md`.

## 3. Never do

- Never modify `frontend/lib/api.ts` or `frontend/lib/auth.ts`.
- Never commit `.env` or any secret; never hard-code keys. Edit env files
  only when the user explicitly asks; production config goes to Secret
  Manager / Vercel.
- Never put business logic in route handlers (Routes → Services → Models).
- Never store vote counts as columns; never keep permanent data in Firebase.
- Never store Google Maps or external geocoder coordinates in the DB.
- Never generate or invent logos/icons — official `brand/` PNGs via
  `RovvyLogo` only. Name is always "Rovvy".
- Never invent routes/services/models — search first (graphify).
- Never run destructive migrations or Alembic autogenerate unreviewed.
- Never force push. Never push to `main` during normal work.

## 4. Product data rules (decided)

- Show only provider-stated facts (Scram Book F15): no invented ratings,
  open-now, capacity, prices or "free". Unknown stays unknown.
- No background Instagram crawler in any form (`data-spine.md` §4, §10).
- Google Places Photos API: not approved (cost). Photos come from
  Wikimedia Commons (free licenses only, with author + license credit) and
  moderated user uploads (Cloudflare R2, EXIF/GPS stripped).
- **Flights are dropped (owner decision, commit c726d13; restated 2026-10-05).**
  No flight search, booking, offers, provider work or flight tests. Do not
  propose or fix flight features. Travel support is **Google-Maps-style
  directions only**: how to get from A to B (to C), e.g. a directions deep
  link or route preview — not selling or comparing flights.
- Infrastructure budget cap: USD 15–20/month (`data-spine.md` §8). Any new
  paid service or spend needs user approval with a cost estimate first.

## 5. Safety and approvals

Ask the user before: changes to the production Supabase database
(migrations, data writes outside tests), pushing to `Production-main`
(push = production deploy via `production-ci.yml`), creating paid cloud
resources, or deleting data. Run DB integration tests inside a rolled-back
transaction.

## 6. Git

- Work on `Production-main`; small commits, one verified feature each.
- Several AI sessions share this checkout: stage **only your own hunks**
  (never `git add -A`); never commit `.pnpm-store/`, `.env`, scratch files.
- Commit messages describe what was verified.

## 7. Testing

- Mock all external APIs; no real HTTP in unit tests.
- New endpoints: at minimum success, 401 unauthorized and 422 validation tests.
- Backend: `.venv\Scripts\python -m pytest -q`
  (CI env: `DATABASE_URL=sqlite:///./test.db`, `SECRET_KEY=test-secret-key-for-ci-must-be-long-enough`).
- Postgres-only suites are opt-in (e.g. `SCAPER_PG_TEST_URL`) and roll back.
- Frontend: `cd frontend; npx vitest run` and `npx tsc --noEmit`.
- Report failures honestly, including pre-existing ones.

## 8. Brand

Primary teal `#0F766E`; navy `#0F172A` sidebar only; content pages white /
`#F8FAFC`; fonts Inter + Outfit.
