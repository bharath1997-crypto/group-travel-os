-- Scaper ingest layer + public.events evolution
-- Design: Scram Book/Explorer Tab/Scaper_Connector_Architecture.md
--
-- Additive and idempotent. Safe to re-run.
--   * Creates schema `ingest` (sources, runs, raw_records, place_links).
--   * Does NOT create a second `places` table — Scaper links venues to the
--     existing Overture spine (001_places.sql) via ingest.place_links.
--   * `public.events` already exists in Supabase (read by
--     GET /api/v2/explorer/events). CREATE IF NOT EXISTS mirrors its live
--     shape for fresh environments; everything after that is ADD COLUMN.
--
-- Requires: postgis, pg_trgm (see 001_places.sql).

CREATE SCHEMA IF NOT EXISTS ingest;

-- ── ingest.sources — configured targets ──────────────────────────────────
CREATE TABLE IF NOT EXISTS ingest.sources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector         text NOT NULL,              -- 'eventbrite', 'ticketmaster', ...
  name              text NOT NULL UNIQUE,       -- human key, e.g. 'eventbrite:org:celine-orlando'
  config            jsonb NOT NULL DEFAULT '{}'::jsonb,  -- validated by the connector
  city_slug         text,                       -- stamped onto events / created places
  enabled           boolean NOT NULL DEFAULT true,
  interval_minutes  integer NOT NULL DEFAULT 360 CHECK (interval_minutes >= 15),
  last_run_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sources_due_idx
  ON ingest.sources (last_run_at NULLS FIRST) WHERE enabled;

-- ── ingest.runs — scrape job history ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingest.runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id      uuid NOT NULL REFERENCES ingest.sources(id) ON DELETE CASCADE,
  status         text NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  fetched        integer NOT NULL DEFAULT 0,
  unchanged      integer NOT NULL DEFAULT 0,
  inserted       integer NOT NULL DEFAULT 0,
  updated        integer NOT NULL DEFAULT 0,
  rejected       integer NOT NULL DEFAULT 0,
  failed         integer NOT NULL DEFAULT 0,
  purged         integer NOT NULL DEFAULT 0,   -- past Scaper events deleted after this run
  error_summary  text
);

ALTER TABLE ingest.runs ADD COLUMN IF NOT EXISTS purged integer NOT NULL DEFAULT 0;

-- Single-flight: at most one running run per source.
CREATE UNIQUE INDEX IF NOT EXISTS runs_one_running_per_source_uidx
  ON ingest.runs (source_id) WHERE status = 'running';

CREATE INDEX IF NOT EXISTS runs_source_started_idx
  ON ingest.runs (source_id, started_at DESC);

-- ── ingest.raw_records — provider payloads, one row per external entity ──
CREATE TABLE IF NOT EXISTS ingest.raw_records (
  id                 bigserial PRIMARY KEY,
  connector          text NOT NULL,
  external_id        text NOT NULL,
  source_id          uuid REFERENCES ingest.sources(id) ON DELETE SET NULL,
  last_run_id        uuid REFERENCES ingest.runs(id) ON DELETE SET NULL,
  payload            jsonb NOT NULL,
  payload_sha256     text NOT NULL,             -- change detection; unchanged payloads skip extraction
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  extraction_status  text NOT NULL DEFAULT 'pending'
                     CHECK (extraction_status IN ('pending', 'extracted', 'rejected', 'failed')),
  extraction_error   text,
  extracted_at       timestamptz,
  UNIQUE (connector, external_id)
);

CREATE INDEX IF NOT EXISTS raw_records_pending_idx
  ON ingest.raw_records (connector, id) WHERE extraction_status IN ('pending', 'failed');

-- ── ingest.place_links — provider venue id → public.places row ───────────
CREATE TABLE IF NOT EXISTS ingest.place_links (
  connector    text NOT NULL,
  external_id  text NOT NULL,
  place_id     uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  method       text NOT NULL CHECK (method IN ('geo_name', 'created', 'manual')),
  score        real,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connector, external_id)
);

CREATE INDEX IF NOT EXISTS place_links_place_idx ON ingest.place_links (place_id);

-- ── public.events — what's happening, linked to places ───────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     text,
  provider        text,
  title           text,
  venue_place_id  uuid,
  lat             double precision,
  lng             double precision,
  geom            geometry(Point, 4326),
  start_time      timestamptz,
  end_time        timestamptz,
  ticket_url      text,
  price_min       numeric,
  price_max       numeric,
  category        text,
  raw             jsonb,
  fetched_at      timestamptz,
  expires_at      timestamptz
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS description    text,
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS is_free        boolean,
  ADD COLUMN IF NOT EXISTS currency       text,
  ADD COLUMN IF NOT EXISTS image_url      text,
  ADD COLUMN IF NOT EXISTS venue_name     text,
  ADD COLUMN IF NOT EXISTS timezone       text,
  ADD COLUMN IF NOT EXISTS city_slug      text,
  ADD COLUMN IF NOT EXISTS source_id      uuid,
  ADD COLUMN IF NOT EXISTS raw_record_id  bigint,
  ADD COLUMN IF NOT EXISTS first_seen_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_status_chk') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_status_chk
      CHECK (status IN ('scheduled', 'sold_out', 'postponed', 'cancelled', 'completed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_venue_place_fk') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_venue_place_fk
      FOREIGN KEY (venue_place_id) REFERENCES public.places(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_source_fk') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_source_fk
      FOREIGN KEY (source_id) REFERENCES ingest.sources(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_raw_record_fk') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_raw_record_fk
      FOREIGN KEY (raw_record_id) REFERENCES ingest.raw_records(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Idempotent upsert key for every connector.
CREATE UNIQUE INDEX IF NOT EXISTS events_provider_external_id_uidx
  ON public.events (provider, external_id);

-- Live DB already has idx_events_geom (gist) and idx_events_start_time.
CREATE INDEX IF NOT EXISTS idx_events_geom          ON public.events USING gist (geom);
CREATE INDEX IF NOT EXISTS events_city_start_idx   ON public.events (city_slug, start_time);
CREATE INDEX IF NOT EXISTS events_venue_place_idx   ON public.events (venue_place_id) WHERE venue_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_live_end_idx
  ON public.events (COALESCE(end_time, start_time))
  WHERE status IN ('scheduled', 'sold_out', 'postponed');
