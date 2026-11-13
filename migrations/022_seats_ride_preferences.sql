-- 022: SeatShare ride preferences (departure window, luggage, rider rules,
-- driver-entered vehicle description) and a series id that links a return
-- trip or recurring rides published together.
-- Additive only: both columns are safe defaults, nothing is dropped or rewritten.
-- Apply manually BEFORE deploying the code that writes these columns.

ALTER TABLE rides
    ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS series_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_rides_series_id ON rides (series_id) WHERE series_id IS NOT NULL;
