-- Scaper state-wide Ticketmaster sources (per-venue city_slug + state_code)
-- Design: Scram Book/Explorer Tab/Scaper_Ticketmaster_National_Spec.md
-- Additive and idempotent. Safe to re-run.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS state_code text;

CREATE INDEX IF NOT EXISTS events_state_city_start_idx
  ON public.events (state_code, city_slug, start_time);

ALTER TABLE ingest.sources
  ADD COLUMN IF NOT EXISTS state_code text;

-- Backfill event state from stored Ticketmaster venue payloads where missing.
UPDATE public.events e
SET state_code = upper(v.state_code)
FROM (
  SELECT DISTINCT ON (r.connector, r.external_id)
    r.connector,
    r.external_id,
    (r.payload #>> '{_embedded,venues,0,state,stateCode}') AS state_code
  FROM ingest.raw_records r
  WHERE r.connector = 'ticketmaster'
    AND (r.payload #>> '{_embedded,venues,0,state,stateCode}') ~ '^[A-Za-z]{2}$'
  ORDER BY r.connector, r.external_id, r.last_seen_at DESC
) v
WHERE e.provider = v.connector
  AND e.external_id = v.external_id
  AND e.state_code IS NULL;
