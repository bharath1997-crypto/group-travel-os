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
- Prereqs: Node 20+, Python 3.11+, pnpm (via corepack), curl
- Install deps:
  - `make setup`
- Run API:
  - `make dev-api` → `curl :8000/health` returns `{ok:true}`
  - Back-compat alias: `make dev:api`
- Run Web:
  - `make dev-web` → open http://localhost:3000
  - Back-compat alias: `make dev:web`
- Export sample PDF (no servers required):
  - `make export-sample` → writes `/tmp/storyboard_sample.pdf`
  - Back-compat alias: `make export:sample`

If your API runs elsewhere, set `NEXT_PUBLIC_API_ORIGIN` in `.env.web.local` (e.g. `http://localhost:8000`).

## How to use (UI)
1) Open the web app at http://localhost:3000
2) Enter a topic, choose pages (5/10/15) and style
3) Click “Generate Plan” to see structured JSON preview
4) Click “Export PDF” to request a PDF from the API

## Environment
- Secrets are never committed. Use these local files:
  - `.env.shared`, `.env.web.local`, `.env.api.local` (all empty by default)
- Web → API origin: `NEXT_PUBLIC_API_ORIGIN` in `.env.web.local`

## Make targets
- `make setup` — install web and api deps
- `make dev-api` / `make dev:api` — run FastAPI at :8000
- `make dev-web` / `make dev:web` — run Next.js at :3000
- `make test-api` / `make test:api` — curl API health
- `make export-sample` / `make export:sample` — write sample PDF to /tmp
- `make clean` — remove venv and web artifacts

## CI
- Builds web and checks API `/health` on push/PR via GitHub Actions

## Notes
- No secrets committed. Use local env files.
- Simple deterministic plan generation; no LLM/image calls yet.
