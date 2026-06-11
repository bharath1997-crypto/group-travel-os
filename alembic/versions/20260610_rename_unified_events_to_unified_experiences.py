"""rename unified_events to unified_experiences

Revision ID: unified_experiences_20260610
Revises: scraper_health_20260609
Create Date: 2026-06-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "unified_experiences_20260610"
down_revision: Union[str, None] = "scraper_health_20260609"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table("unified_events", "unified_experiences")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_class
                WHERE relname = 'unified_events_id_seq'
            ) THEN
                ALTER SEQUENCE unified_events_id_seq
                    RENAME TO unified_experiences_id_seq;
            END IF;
        END $$;
        """
    )
    op.execute(
        "ALTER INDEX IF EXISTS unified_events_pkey "
        "RENAME TO unified_experiences_pkey"
    )
    op.execute(
        "ALTER INDEX IF EXISTS idx_unified_events_city "
        "RENAME TO idx_unified_experiences_city"
    )
    op.execute(
        "ALTER INDEX IF EXISTS idx_unified_events_country "
        "RENAME TO idx_unified_experiences_country"
    )
    op.execute(
        "ALTER INDEX IF EXISTS idx_unified_events_start "
        "RENAME TO idx_unified_experiences_start"
    )
    op.execute(
        "ALTER INDEX IF EXISTS idx_unified_events_dedup "
        "RENAME TO idx_unified_experiences_dedup"
    )
    op.execute(
        "ALTER INDEX IF EXISTS idx_unified_events_location "
        "RENAME TO idx_unified_experiences_location"
    )


def downgrade() -> None:
    op.execute(
        "ALTER INDEX IF EXISTS idx_unified_experiences_location "
        "RENAME TO idx_unified_events_location"
    )
    op.execute(
        "ALTER INDEX IF EXISTS idx_unified_experiences_dedup "
        "RENAME TO idx_unified_events_dedup"
    )
    op.execute(
        "ALTER INDEX IF EXISTS idx_unified_experiences_start "
        "RENAME TO idx_unified_events_start"
    )
    op.execute(
        "ALTER INDEX IF EXISTS idx_unified_experiences_country "
        "RENAME TO idx_unified_events_country"
    )
    op.execute(
        "ALTER INDEX IF EXISTS idx_unified_experiences_city "
        "RENAME TO idx_unified_events_city"
    )
    op.execute(
        "ALTER INDEX IF EXISTS unified_experiences_pkey "
        "RENAME TO unified_events_pkey"
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_class
                WHERE relname = 'unified_experiences_id_seq'
            ) THEN
                ALTER SEQUENCE unified_experiences_id_seq
                    RENAME TO unified_events_id_seq;
            END IF;
        END $$;
        """
    )
    op.rename_table("unified_experiences", "unified_events")
