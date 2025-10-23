# Storyboard Monorepo

MVP: Type a topic → get a structured comic plan, edit/preview, export PDF.

## Structure
- `apps/web` — Next.js 14 app (TS, App Router)
- `apps/api` — FastAPI (Python 3.11) with `/health`, `/generate/plan`, `/export/pdf`
- `workers/pdf` — ReportLab A4 2×2 grid export
- `db/schema.sql` — Postgres schema (Supabase-ready)
- `.github/workflows` — CI workflows
- `.env.shared`, `.env.web.local`, `.env.api.local` — sample envs (empty)

## Quickstart
- Install deps:
  - `make setup`
- Run API:
  - `make dev-api` → `curl :8000/health` returns `{ok:true}`
- Run Web:
  - `make dev-web` → open http://localhost:3000
- Export sample PDF:
  - `make export-sample` → writes `/tmp/storyboard_sample.pdf`

If your API runs elsewhere, set `NEXT_PUBLIC_API_ORIGIN` in `.env.web.local` (e.g. `http://localhost:8000`).

## Notes
- No secrets committed. Use local env files.
- Simple deterministic plan generation; no LLM/image calls yet.
