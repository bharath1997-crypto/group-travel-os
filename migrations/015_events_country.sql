-- Country on Scaper events (needed before any non-US source is enabled).
-- City slugs repeat across countries (Birmingham GB/US, London GB/CA), so readers
-- filter on (country_code, city_slug). NULL is read as 'US' for legacy rows.
-- Verified 2026-10-25 (read-only): all 9,189 existing Scaper events are US venues
-- (Ticketmaster 9,094; Eventbrite 95), so the backfill below is exact.
-- Additive and safe to run twice. Apply BEFORE deploying the Scaper job image that writes country_code.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS country_code text;

UPDATE public.events
SET country_code = 'US'
WHERE source_id IS NOT NULL AND country_code IS NULL;

CREATE INDEX IF NOT EXISTS events_country_city_start_idx
    ON public.events (country_code, city_slug, start_time)
    WHERE source_id IS NOT NULL;
