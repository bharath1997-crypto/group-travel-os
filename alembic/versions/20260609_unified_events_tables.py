"""create unified_events and event_providers tables

Revision ID: unified_events_20260609
Revises: wayra_20260607
Create Date: 2026-06-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'unified_events_20260609'
down_revision: Union[str, None] = 'wayra_20260607'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS unified_events (
        id UUID PRIMARY KEY
            DEFAULT gen_random_uuid(),
        canonical_title VARCHAR(500) NOT NULL,
        normalized_title VARCHAR(500) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        subcategory VARCHAR(100),
        image_url VARCHAR(1000),
        venue_name VARCHAR(500),
        venue_address VARCHAR(500),
        city VARCHAR(200),
        state_province VARCHAR(200),
        country VARCHAR(100),
        country_code VARCHAR(10),
        lat FLOAT,
        lng FLOAT,
        start_datetime TIMESTAMP,
        end_datetime TIMESTAMP,
        timezone VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        is_free BOOLEAN DEFAULT FALSE,
        min_price FLOAT,
        max_price FLOAT,
        currency VARCHAR(10) DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_synced_at TIMESTAMP DEFAULT NOW(),
        dedup_hash VARCHAR(64) UNIQUE
    );

    CREATE TABLE IF NOT EXISTS event_providers (
        id UUID PRIMARY KEY
            DEFAULT gen_random_uuid(),
        event_id UUID REFERENCES unified_events(id)
            ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL,
        provider_event_id VARCHAR(500),
        provider_url VARCHAR(1000),
        affiliate_url VARCHAR(1000),
        min_price FLOAT,
        max_price FLOAT,
        currency VARCHAR(10),
        price_label VARCHAR(200),
        availability VARCHAR(50)
            DEFAULT 'available',
        tickets_remaining INTEGER,
        raw_data JSONB,
        last_updated TIMESTAMP DEFAULT NOW(),
        UNIQUE(provider, provider_event_id)
    );

    CREATE INDEX IF NOT EXISTS
        idx_unified_events_city
        ON unified_events(city);
    CREATE INDEX IF NOT EXISTS
        idx_unified_events_country
        ON unified_events(country_code);
    CREATE INDEX IF NOT EXISTS
        idx_unified_events_start
        ON unified_events(start_datetime);
    CREATE INDEX IF NOT EXISTS
        idx_unified_events_dedup
        ON unified_events(dedup_hash);
    CREATE INDEX IF NOT EXISTS
        idx_unified_events_location
        ON unified_events(lat, lng);
    CREATE INDEX IF NOT EXISTS
        idx_event_providers_event
        ON event_providers(event_id);
    CREATE INDEX IF NOT EXISTS
        idx_event_providers_provider
        ON event_providers(provider);
    """)


def downgrade() -> None:
    pass  # Never destructive
