-- Scaper owner-removal blocklist (spec item 9)
-- Additive and idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS ingest.blocklist (
  provider     text NOT NULL,
  external_id  text NOT NULL,
  reason       text,
  blocked_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, external_id)
);

CREATE INDEX IF NOT EXISTS blocklist_provider_idx ON ingest.blocklist (provider);
