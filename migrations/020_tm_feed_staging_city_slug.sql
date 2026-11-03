-- Add city_slug to feed staging for set-based event upsert (Python slug, not SQL).
ALTER TABLE ingest.tm_feed_staging ADD COLUMN IF NOT EXISTS city_slug text;
