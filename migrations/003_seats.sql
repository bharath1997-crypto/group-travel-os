-- Rovvy Seats — intercity seat sharing (India-first)
-- Requires PostGIS (enable in Supabase dashboard before running)
-- Authoritative spec: handoff/seats-backend.md

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── Vehicles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  make         text NOT NULL,
  model        text NOT NULL,
  plate        text NOT NULL,
  mileage_kmpl numeric(4,1) NOT NULL CHECK (mileage_kmpl > 0),
  seats        smallint NOT NULL CHECK (seats BETWEEN 2 AND 8),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_vehicles_user_id ON vehicles (user_id);

-- ── Fuel / toll config (reproducible cost basis) ─────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_prices (
  region_code                 text NOT NULL,
  effective_from              date NOT NULL,
  fuel_rate_paise_per_l       bigint NOT NULL CHECK (fuel_rate_paise_per_l > 0),
  toll_fallback_paise_per_km  bigint NOT NULL DEFAULT 150 CHECK (toll_fallback_paise_per_km >= 0),
  PRIMARY KEY (region_code, effective_from)
);

INSERT INTO fuel_prices (region_code, effective_from, fuel_rate_paise_per_l, toll_fallback_paise_per_km)
VALUES ('IN-MH', '2026-01-01', 10500, 180)
ON CONFLICT DO NOTHING;

-- ── Trust path cache (2-hop max) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connection_paths (
  viewer_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  via_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  hops         smallint NOT NULL CHECK (hops BETWEEN 0 AND 2),
  PRIMARY KEY (viewer_id, target_id)
);

CREATE INDEX IF NOT EXISTS ix_connection_paths_viewer ON connection_paths (viewer_id);

-- ── Rides ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rides (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id           uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  region_code          text NOT NULL DEFAULT 'IN-MH',
  depart_at            timestamptz NOT NULL,
  arrive_est_at        timestamptz,
  seats_offered        smallint NOT NULL CHECK (seats_offered BETWEEN 1 AND 6),
  seats_taken          smallint NOT NULL DEFAULT 0 CHECK (seats_taken >= 0),
  visibility           text NOT NULL CHECK (visibility IN ('groups', 'fof', 'public')),
  approval             text NOT NULL CHECK (approval IN ('instant', 'manual')),
  status               text NOT NULL DEFAULT 'open'
                         CHECK (status IN ('draft','open','full','departed','completed','cancelled')),
  route_geom           geography(LineString, 4326),
  distance_km          numeric(7,2) NOT NULL CHECK (distance_km > 0),
  cost_total_paise     bigint NOT NULL CHECK (cost_total_paise >= 0),
  max_per_seat_paise   bigint NOT NULL CHECK (max_per_seat_paise >= 0),
  price_per_seat_paise bigint NOT NULL CHECK (price_per_seat_paise >= 0),
  cost_basis           jsonb NOT NULL,
  note                 text,
  driver_cancel_count  int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seats_sane CHECK (seats_taken <= seats_offered),
  CONSTRAINT price_capped CHECK (price_per_seat_paise <= max_per_seat_paise)
);

CREATE INDEX IF NOT EXISTS ix_rides_status_depart ON rides (status, depart_at);
CREATE INDEX IF NOT EXISTS ix_rides_driver ON rides (driver_id);
CREATE INDEX IF NOT EXISTS ix_rides_route_geom ON rides USING GIST (route_geom);

-- ── Stops (ordered — matching keys) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ride_stops (
  ride_id   uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  seq       smallint NOT NULL,
  label     text NOT NULL,
  lat       double precision NOT NULL,
  lon       double precision NOT NULL,
  geog      geography(Point, 4326) NOT NULL,
  eta       timestamptz,
  PRIMARY KEY (ride_id, seq)
);

CREATE INDEX IF NOT EXISTS ride_stops_geog_idx ON ride_stops USING GIST (geog);

-- ── Bookings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ride_bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id       uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rider_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seats         smallint NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 4),
  board_seq     smallint NOT NULL,
  alight_seq    smallint NOT NULL,
  status        text NOT NULL
                  CHECK (status IN ('requested','held','confirmed','declined',
                                    'cancelled_rider','cancelled_driver','completed','no_show')),
  price_paise   bigint NOT NULL CHECK (price_paise >= 0),
  expires_at    timestamptz,
  message       text,
  trust_path    jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz,
  CONSTRAINT leg_order CHECK (board_seq < alight_seq),
  CONSTRAINT one_live_per_rider
    EXCLUDE (ride_id WITH =, rider_id WITH =)
    WHERE (status IN ('requested','held','confirmed'))
);

CREATE INDEX IF NOT EXISTS ix_ride_bookings_ride_status ON ride_bookings (ride_id, status);
CREATE INDEX IF NOT EXISTS ix_ride_bookings_rider_status ON ride_bookings (rider_id, status);

-- ── Route watches ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ride_watches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_lat    double precision NOT NULL,
  from_lon    double precision NOT NULL,
  to_lat      double precision NOT NULL,
  to_lon      double precision NOT NULL,
  from_geog   geography(Point, 4326) NOT NULL,
  to_geog     geography(Point, 4326) NOT NULL,
  geohash_key text NOT NULL,
  radius_m    int NOT NULL DEFAULT 25000,
  date_from   date,
  date_to     date,
  seats       smallint NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 4),
  active      boolean NOT NULL DEFAULT true,
  last_alert_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, geohash_key, date_from)
);

CREATE INDEX IF NOT EXISTS ride_watches_from_geog_idx ON ride_watches USING GIST (from_geog);
CREATE INDEX IF NOT EXISTS ride_watches_to_geog_idx ON ride_watches USING GIST (to_geog);

-- ── Splits handoff (peer debts, no trip required) ─────────────────────────────
CREATE TABLE IF NOT EXISTS split_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid REFERENCES groups(id) ON DELETE SET NULL,
  from_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_paise  bigint NOT NULL CHECK (amount_paise > 0),
  reason        text NOT NULL,
  source_type   text NOT NULL,
  source_id     uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS ix_split_entries_from ON split_entries (from_user_id);
CREATE INDEX IF NOT EXISTS ix_split_entries_to ON split_entries (to_user_id);

-- ── visible_to helper (trust gating) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION seats_visible_to(p_ride_id uuid, p_viewer uuid) RETURNS boolean AS $$
DECLARE
  r rides%ROWTYPE;
BEGIN
  SELECT * INTO r FROM rides WHERE id = p_ride_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF r.driver_id = p_viewer THEN RETURN true; END IF;
  IF r.visibility = 'groups' THEN
    RETURN EXISTS (
      SELECT 1 FROM group_members a
      JOIN group_members b USING (group_id)
      WHERE a.user_id = r.driver_id AND b.user_id = p_viewer
    );
  END IF;
  IF r.visibility = 'public' THEN
    RETURN true;
  END IF;
  IF r.visibility = 'fof' THEN
    RETURN EXISTS (
      SELECT 1 FROM friend_requests fr1
      JOIN friend_requests fr2
        ON fr2.sender_id = fr1.receiver_id OR fr2.receiver_id = fr1.receiver_id
      WHERE fr1.status = 'accepted' AND fr2.status = 'accepted'
        AND (
          (fr1.sender_id = r.driver_id AND (fr2.sender_id = p_viewer OR fr2.receiver_id = p_viewer))
          OR (fr1.receiver_id = r.driver_id AND (fr2.sender_id = p_viewer OR fr2.receiver_id = p_viewer))
        )
        AND fr1.sender_id IN (r.driver_id, fr1.receiver_id)
    ) OR EXISTS (
      SELECT 1 FROM friend_requests fr
      WHERE fr.status = 'accepted'
        AND (
          (fr.sender_id = r.driver_id AND fr.receiver_id = p_viewer)
          OR (fr.receiver_id = r.driver_id AND fr.sender_id = p_viewer)
        )
    );
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;
