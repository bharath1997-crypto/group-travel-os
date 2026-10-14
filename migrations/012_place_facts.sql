-- Place facts: Wikipedia/Wikidata extracts + OSM tags (Chicago pilot, F50)
-- Apply manually after owner approval. Non-destructive.

CREATE TABLE IF NOT EXISTS public.place_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('wikipedia', 'osm')),
  key text NOT NULL,
  value text NOT NULL,
  source_url text,
  license text NOT NULL,
  attribution text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, source, key)
);

CREATE INDEX IF NOT EXISTS place_facts_place_id_idx ON public.place_facts (place_id);
