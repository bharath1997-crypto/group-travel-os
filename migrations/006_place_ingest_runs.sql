-- Overture places ingest run metadata (hot-index freshness + R2 handoff)

CREATE TABLE IF NOT EXISTS place_ingest_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset         text NOT NULL DEFAULT 'overture_places',
  release_id      text NOT NULL,
  region_key      text,
  city_slug       text,
  schema_version  text NOT NULL DEFAULT '1',
  status          text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  row_count       integer,
  artifact_key    text,
  artifact_sha256 text,
  error_summary   text
);

CREATE TABLE IF NOT EXISTS place_ingest_run_cities (
  run_id     uuid NOT NULL REFERENCES place_ingest_runs(id) ON DELETE CASCADE,
  city_slug  text NOT NULL,
  PRIMARY KEY (run_id, city_slug)
);

CREATE INDEX IF NOT EXISTS place_ingest_runs_dataset_release_status_idx
  ON place_ingest_runs (dataset, release_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS place_ingest_runs_succeeded_scope_uidx
  ON place_ingest_runs (
    dataset,
    release_id,
    COALESCE(region_key, ''),
    COALESCE(city_slug, ''),
    schema_version
  )
  WHERE status = 'succeeded';

CREATE UNIQUE INDEX IF NOT EXISTS place_ingest_runs_running_scope_uidx
  ON place_ingest_runs (
    dataset,
    release_id,
    COALESCE(region_key, ''),
    COALESCE(city_slug, ''),
    schema_version
  )
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS place_ingest_run_cities_city_slug_idx
  ON place_ingest_run_cities (city_slug);

CREATE INDEX IF NOT EXISTS place_ingest_runs_region_city_completed_idx
  ON place_ingest_runs (region_key, city_slug, completed_at DESC)
  WHERE status = 'succeeded';
