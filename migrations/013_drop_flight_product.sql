-- ORDER MATTERS: apply AFTER the code that no longer reads users.home_airport/deal_* is deployed.
-- The currently deployed API (revision 00311) still selects those columns; dropping them first breaks login.
-- Remove the dropped flight product from the database (owner decision: no flights at all).
-- Alembic history (20260512_*, 20260808_*) is unchanged. Verified 2026-10-14 before applying:
-- flight_bookings 0 rows, bookings 0 rows, home_airport / deal_alerts_enabled unused.
BEGIN;

DROP TABLE IF EXISTS flight_bookings;
DROP TYPE IF EXISTS flight_booking_status;

ALTER TABLE users DROP COLUMN IF EXISTS home_airport;
ALTER TABLE users DROP COLUMN IF EXISTS deal_price_threshold;
ALTER TABLE users DROP COLUMN IF EXISTS deal_alerts_enabled;

-- booking_provider: remove the 'duffel' label (bookings is empty).
ALTER TYPE booking_provider RENAME TO booking_provider_old;
CREATE TYPE booking_provider AS ENUM ('manual_link');
ALTER TABLE bookings ALTER COLUMN provider TYPE booking_provider USING provider::text::booking_provider;
DROP TYPE booking_provider_old;

COMMIT;
