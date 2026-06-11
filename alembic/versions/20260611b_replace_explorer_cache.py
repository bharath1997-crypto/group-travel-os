"""replace explorer_cache with bbox/cache_key schema

Revision ID: explorer_cache_replace_20260611b
Revises: explorer_schema_20260611
Create Date: 2026-06-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "explorer_cache_replace_20260611b"
down_revision: Union[str, None] = "explorer_schema_20260611"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS explorer_cache CASCADE")

    op.execute("""
    CREATE TABLE explorer_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cache_key TEXT UNIQUE NOT NULL,
        bbox JSONB,
        result_ids JSONB,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
    );
    """)

    op.execute(
        "CREATE INDEX idx_explorer_cache_key ON explorer_cache(cache_key)"
    )
    op.execute(
        "CREATE INDEX idx_explorer_cache_expires ON explorer_cache(expires_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_explorer_cache_expires")
    op.execute("DROP INDEX IF EXISTS idx_explorer_cache_key")
    op.execute("DROP TABLE IF EXISTS explorer_cache CASCADE")
