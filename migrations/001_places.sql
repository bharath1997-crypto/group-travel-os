-- Rovvy Data Spine — places schema (Overture-first)
-- Spec: data-spine.md §2 Stage 3 + depth_tier / city_slug additions
--
-- BEFORE RUNNING: enable extensions in Supabase dashboard
--   Database → Extensions → enable "postgis" and "pg_trgm"
-- Then run this file against your project (psql, Supabase SQL editor, etc.)
--
-- NOTE: If a legacy `places` table already exists (explorer/OSM schema),
-- back it up or rename it before running. This migration creates the
-- data-spine `places` table from scratch.
--
-- On load (scripts/04_load.py): clamp confidence to [0, 1]:
--   least(confidence, 1.0)

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE places (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gers_id         text UNIQUE,          -- Overture id. Join key for re-sync.
  name            text NOT NULL,
  geog            geography(Point,4326) NOT NULL,
  basic_category  text,
  confidence      real,
  website         text,
  phone           text,
  instagram       text,                 -- extracted from socials[]
  address         jsonb,

  -- Rovvy-only. No dataset on earth carries these.
  group_capacity  int,
  price_per_head  numeric,
  split_friendly  boolean,
  notice_needed   interval,
  fit_confirmed   int DEFAULT 0,
  booking_url     text,
  photos          text[],
  enriched_at     timestamptz,
  claimed_by      uuid,

  -- Data-spine additions (beyond §2 Stage 3)
  depth_tier      smallint DEFAULT 0,   -- 0=bulk  1=operator-claimed  2=hand-enriched
  city_slug       text                  -- e.g. 'chicago'; scopes search before trigram
);

CREATE INDEX ON places USING GIST (geog);
CREATE INDEX ON places USING GIN (name gin_trgm_ops);
CREATE INDEX ON places (basic_category);
CREATE INDEX ON places (group_capacity) WHERE group_capacity IS NOT NULL;
CREATE INDEX ON places (instagram) WHERE instagram IS NOT NULL;
CREATE INDEX ON places (city_slug, depth_tier);
