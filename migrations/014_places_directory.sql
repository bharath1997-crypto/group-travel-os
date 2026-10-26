-- US state + city directory for Explore location pages (owner approval required before apply).
-- Slugs align with app.services.explore_scaper_events.city_slug for event joins.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.places_directory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('state', 'city')),
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    state_code CHAR(2),
    state_slug TEXT NOT NULL DEFAULT '',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    population INTEGER,
    wikidata_qid TEXT,
    wikipedia_title TEXT,
    wikipedia_extract TEXT,
    wikipedia_url TEXT,
    wikipedia_fetched_at TIMESTAMPTZ,
    source TEXT NOT NULL DEFAULT 'us_census_wikidata',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT places_directory_kind_state_slug_slug_key UNIQUE (kind, state_slug, slug)
);

CREATE INDEX IF NOT EXISTS places_directory_state_cities_idx
    ON public.places_directory (state_slug, kind, population DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS places_directory_city_slug_idx
    ON public.places_directory (slug)
    WHERE kind = 'city';

CREATE INDEX IF NOT EXISTS places_directory_name_trgm_idx
    ON public.places_directory USING gin (name gin_trgm_ops);
