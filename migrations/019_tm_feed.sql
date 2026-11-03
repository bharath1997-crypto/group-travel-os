-- Ticketmaster Discovery Feed staging + feed_state + dedup queue (bulk-feed spec §4).
-- Additive and idempotent — safe to run twice.

CREATE TABLE IF NOT EXISTS ingest.feed_state (
  provider      text NOT NULL,
  country       char(2) NOT NULL,
  last_md5      text,
  last_updated  timestamptz,
  num_events    integer,
  loaded_at     timestamptz,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'unchanged', 'succeeded', 'partial', 'failed')),
  PRIMARY KEY (provider, country)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'ingest' AND c.relname = 'tm_feed_staging'
  ) THEN
    CREATE UNLOGGED TABLE ingest.tm_feed_staging (
      event_id        text NOT NULL,
      legacy_id       text,
      title             text NOT NULL,
      description       text,
      category          text,
      start_time        timestamptz,
      end_time          timestamptz,
      timezone          text,
      status            text,
      url               text,
      image_url         text,
      venue_id          text,
      venue_name        text,
      venue_street      text,
      venue_city        text,
      venue_state       text,
      venue_zip         text,
      country_code      char(2) NOT NULL,
      lat               double precision,
      lng               double precision
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tm_feed_staging_event_idx ON ingest.tm_feed_staging (event_id);
CREATE INDEX IF NOT EXISTS tm_feed_staging_venue_idx ON ingest.tm_feed_staging (venue_id);
CREATE INDEX IF NOT EXISTS tm_feed_staging_country_idx ON ingest.tm_feed_staging (country_code);

CREATE TABLE IF NOT EXISTS ingest.dedup_queue (
  city_slug   text NOT NULL,
  queued_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (city_slug)
);

INSERT INTO ingest.sources (connector, name, config, city_slug, state_code, enabled, interval_minutes)
VALUES (
  'ticketmaster_feed',
  'ticketmaster:feed:us',
  '{"country": "US", "horizon_days": 365}'::jsonb,
  NULL,
  NULL,
  false,
  1440
)
ON CONFLICT (name) DO NOTHING;
