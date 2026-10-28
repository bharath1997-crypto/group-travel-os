-- API calls per Scaper run, so a daily budget (Ticketmaster allows 5,000/day) can be enforced.
-- Additive and safe to run twice. The Scaper tolerates the column being absent (it logs a
-- warning and cannot enforce the budget until this is applied), so deploy order is not critical.

ALTER TABLE ingest.runs ADD COLUMN IF NOT EXISTS api_calls integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ingest_runs_started_idx ON ingest.runs (started_at);
