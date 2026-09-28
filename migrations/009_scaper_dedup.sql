-- Scaper dedup: hide duplicate events, widen venue matching.
-- Spec: Scram Book/Explorer Tab/Scaper_Dedup_Spec.md (approved 2026-09-26)
-- Additive and idempotent.

-- Hide, never delete: a duplicate points at its canonical row. When the
-- canonical is purged, SET NULL makes the duplicate visible again.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS duplicate_of uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_duplicate_of_fk') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_duplicate_of_fk
      FOREIGN KEY (duplicate_of) REFERENCES public.events(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_not_self_duplicate_chk') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_not_self_duplicate_chk
      CHECK (duplicate_of IS NULL OR duplicate_of <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS events_duplicate_of_idx
  ON public.events (duplicate_of) WHERE duplicate_of IS NOT NULL;

ALTER TABLE ingest.runs
  ADD COLUMN IF NOT EXISTS deduped integer NOT NULL DEFAULT 0;  -- events newly hidden as duplicates

-- Tier A2 (250 m + normalized name) and A3 (500 m + name + street + postcode)
-- venue matches get their own methods.
ALTER TABLE ingest.place_links DROP CONSTRAINT IF EXISTS place_links_method_check;
ALTER TABLE ingest.place_links ADD CONSTRAINT place_links_method_check
  CHECK (method IN ('geo_name', 'geo_name_wide', 'geo_address', 'created', 'manual'));
