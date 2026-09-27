-- Wikidata enrichment columns (scripts/05_enrich_wikidata.py)

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS wikidata_qid text,
  ADD COLUMN IF NOT EXISTS short_description text;

CREATE UNIQUE INDEX IF NOT EXISTS places_wikidata_qid_idx
  ON places (wikidata_qid)
  WHERE wikidata_qid IS NOT NULL;
