# API region move: Cloud Run asia-south1 (Mumbai) to us-west1 (Oregon)

Status: **step 3 prepared (2026-11-09), not pushed.** Owner said "move it"; `production-ci.yml` now targets `us-west1` and `GOOGLE_REDIRECT_URI_USW1` (uncommitted). Nothing deployed. Steps 2 (secret + Google Console) must be done BEFORE the push or the deploy fails; the push is the production deploy (AGENTS.md section 5).

## 1. Why

Measured 2026-11-02 from outside (`curl`, Chicago coordinates):

| Request | Time |
|---|---|
| API `/health` (does a DB check), connect time 30 ms | 1.25 to 1.54 s every time |
| `/api/v1/explore/places` | 1.6 to 2.3 s |
| `/api/v1/explore/events` | 3.0 to 4.6 s |

The API runs in `asia-south1` (Mumbai). The database is Supabase `aws-us-west-2` (Oregon) via the pooler
(`aws-1-us-west-2.pooler.supabase.com:6543`). Every connection check (`pool_pre_ping`), `SELECT 1` and query
crosses the Pacific. The Scaper job is already in `us-west1`, and an Artifact Registry repo
`cloud-run-source-deploy` already exists there. Nearest Google region to Oregon Supabase: **us-west1 (Oregon)**.

Expectation (not a promise, to be measured): `/health` about 0.1 to 0.2 s, events about 0.3 to 0.8 s.

## 2. What references the current URL

`https://group-travel-os-api-704551807369.asia-south1.run.app`:
- `.github/workflows/production-ci.yml`: `--region asia-south1` and `API_PUBLIC_URL=...`
- `frontend/.env.production` and `.env.production`: `NEXT_PUBLIC_API_URL=.../api/v1` (baked into the frontend build)
- Vercel project env `NEXT_PUBLIC_API_URL` (owner check)
- Secret Manager `GOOGLE_REDIRECT_URI` (the OAuth callback on the API) and the Google Cloud Console OAuth client's
  authorized redirect URIs
- Scripts/docs: `scripts/deploy-cloud-run.ps1`, `scripts/fix_cors.sh`, `scripts/sync-deepseek-key.ps1`,
  `scripts/deploy_scaper_orlando_hourly.ps1`, `docs/CLOUD_RUN_ENVIRONMENT.md`, seed scripts.
- Check also: any API key (Google Routes / Maps / Places / Foursquare) restricted by IP or referrer.

New URL is predictable: `https://group-travel-os-api-704551807369.us-west1.run.app` (same service name, new region).

## 3. Steps (blue/green; the old service stays up until the end)

1. **Baseline** (done 2026-11-02, table above). Re-run the same `curl` set after each phase.
2. **New OAuth secret** (owner, Secret Manager): create `GOOGLE_REDIRECT_URI_USW1` =
   `https://group-travel-os-api-704551807369.us-west1.run.app/api/v1/auth/oauth/google/callback`.
   Do NOT change the existing `GOOGLE_REDIRECT_URI` (the old service reads it). In Google Cloud Console, OAuth client:
   **add** the new redirect URI, keep the old one.
3. **Workflow change** (Claude prepares, owner pushes): in `production-ci.yml` set `--region us-west1`,
   `API_PUBLIC_URL` to the new URL, and map `GOOGLE_REDIRECT_URI=GOOGLE_REDIRECT_URI_USW1:latest`. Push deploys a NEW service
   in us-west1; the Mumbai service is untouched. Cost: two always-on instances (`--min-instances=1`) for the overlap; estimate
   about USD 5 to 8 per month each at 512 Mi, so the overlap should be days, not weeks (budget cap USD 15 to 20).
4. **Verify the new service** before any switch: `/health`, events, places timings; log in with Google against the new URL
   (test account) and confirm CORS from rovvy.app; check IP/referrer-restricted API keys.
5. **Switch the frontend** (owner): set Vercel `NEXT_PUBLIC_API_URL` to
   `https://group-travel-os-api-704551807369.us-west1.run.app/api/v1` and update `.env.production` files; sync frontend to
   `main` (`scripts/sync-to-main.ps1`); redeploy. Existing logins stay valid (same `SECRET_KEY`, same JWTs).
6. **Observe 24 to 72 h**: Cloud Run request logs on the new service; errors; timings.
7. **Retire the old service** (owner approval): first `--min-instances=0` on the Mumbai service (stops the cost, keeps the
   rollback), then delete it after about 7 days. Remove old redirect URI from Google Console afterwards.
8. **Housekeeping** (Claude): replace `asia-south1` in the four scripts and `docs/CLOUD_RUN_ENVIRONMENT.md`.

## 4. Rollback

Before step 7: set `NEXT_PUBLIC_API_URL` back to the Mumbai URL and redeploy the frontend. The old service and its OAuth
secret were never changed. After step 7 (min-instances 0): scale the Mumbai service back up, then repeat the same switch.

## 5. Risks

- Short OAuth failure window if the secret/console steps are skipped or done in the wrong order (steps 2 then 3).
- A clock gap where some clients still call the old URL (cached bundles): old service stays up through step 6.
- IP-restricted third-party keys may fail from the new region (check in step 4).
- Cold start on a brand-new service: first request after deploy can be slow; `--min-instances=1` keeps one warm.

## 6. Separate and cheaper: connection overhead

`pool_pre_ping=True` adds one round trip per checkout. After the region move this is negligible; before it, it is part of
the 1.3 to 1.5 s. Do not change pooling until the move is measured.
