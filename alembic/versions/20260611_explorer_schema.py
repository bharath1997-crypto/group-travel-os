"""Rovvy Explorer schema — places, events, activities, explorer_cache with PostGIS

Revision ID: explorer_schema_20260611
Revises: dcc34c43840b
Create Date: 2026-06-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "explorer_schema_20260611"
down_revision: Union[str, None] = "dcc34c43840b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    op.execute("""
    CREATE TABLE IF NOT EXISTS places (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        osm_id BIGINT UNIQUE,
        name TEXT NOT NULL,
        category TEXT,
        subcategory TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        geom GEOMETRY(Point, 4326),
        address JSONB,
        tags JSONB,
        website TEXT,
        phone TEXT,
        opening_hours TEXT,
        photo_url TEXT,
        source TEXT DEFAULT 'osm',
        enriched_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id TEXT,
        provider TEXT,
        title TEXT,
        venue_place_id UUID REFERENCES places(id),
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        geom GEOMETRY(Point, 4326),
        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        ticket_url TEXT,
        price_min NUMERIC,
        price_max NUMERIC,
        category TEXT,
        raw JSONB,
        fetched_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id TEXT,
        provider TEXT DEFAULT 'viator',
        title TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        geom GEOMETRY(Point, 4326),
        price_from NUMERIC,
        duration_minutes INT,
        booking_url TEXT,
        raw JSONB,
        fetched_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS explorer_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cache_key TEXT UNIQUE,
        bbox JSONB,
        result_ids JSONB,
        fetched_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ
    );
    """)

    # Idempotent column adds for partially-existing tables
    op.execute("""
    ALTER TABLE places ADD COLUMN IF NOT EXISTS osm_id BIGINT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS name TEXT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS subcategory TEXT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS geom GEOMETRY(Point, 4326);
    ALTER TABLE places ADD COLUMN IF NOT EXISTS address JSONB;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS tags JSONB;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS website TEXT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS opening_hours TEXT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS photo_url TEXT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'osm';
    ALTER TABLE places ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    """)

    op.execute("""
    ALTER TABLE events ADD COLUMN IF NOT EXISTS external_id TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS provider TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_place_id UUID;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS geom GEOMETRY(Point, 4326);
    ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_url TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS price_min NUMERIC;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS price_max NUMERIC;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS raw JSONB;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    """)

    op.execute("""
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS external_id TEXT;
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'viator';
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS geom GEOMETRY(Point, 4326);
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS price_from NUMERIC;
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS duration_minutes INT;
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS booking_url TEXT;
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS raw JSONB;
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    """)

    op.execute("""
    ALTER TABLE explorer_cache ADD COLUMN IF NOT EXISTS cache_key TEXT;
    ALTER TABLE explorer_cache ADD COLUMN IF NOT EXISTS bbox JSONB;
    ALTER TABLE explorer_cache ADD COLUMN IF NOT EXISTS result_ids JSONB;
    ALTER TABLE explorer_cache ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;
    ALTER TABLE explorer_cache ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    """)

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_places_geom "
        "ON places USING GIST (geom)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_geom "
        "ON events USING GIST (geom)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_activities_geom "
        "ON activities USING GIST (geom)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_places_category "
        "ON places (category)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_start_time "
        "ON events (start_time)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_explorer_cache_cache_key "
        "ON explorer_cache (cache_key)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_explorer_cache_cache_key")
    op.execute("DROP INDEX IF EXISTS idx_events_start_time")
    op.execute("DROP INDEX IF EXISTS idx_places_category")
    op.execute("DROP INDEX IF EXISTS idx_activities_geom")
    op.execute("DROP INDEX IF EXISTS idx_events_geom")
    op.execute("DROP INDEX IF EXISTS idx_places_geom")

    op.execute("DROP TABLE IF EXISTS explorer_cache")
    op.execute("DROP TABLE IF EXISTS activities")
    op.execute("DROP TABLE IF EXISTS events")
    op.execute("DROP TABLE IF EXISTS places")

    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM geometry_columns
            WHERE f_table_schema = 'public'
        ) THEN
            DROP EXTENSION IF EXISTS postgis CASCADE;
        END IF;
    END $$;
    """)
