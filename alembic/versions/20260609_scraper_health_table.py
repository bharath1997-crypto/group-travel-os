"""create scraper_health table

Revision ID: scraper_health_20260609
Revises: unified_events_20260609
Create Date: 2026-06-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'scraper_health_20260609'
down_revision: Union[str, None] = 'unified_events_20260609'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS scraper_health (
        id UUID PRIMARY KEY
            DEFAULT gen_random_uuid(),
        provider VARCHAR(50) NOT NULL UNIQUE,
        status VARCHAR(20) DEFAULT 'healthy',
        last_success_at TIMESTAMP,
        last_failure_at TIMESTAMP,
        consecutive_failures INTEGER DEFAULT 0,
        last_error TEXT,
        events_fetched_today INTEGER DEFAULT 0,
        is_enabled BOOLEAN DEFAULT TRUE,
        blocked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
    """)


def downgrade() -> None:
    pass  # Never destructive
