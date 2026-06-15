"""Add search_logs table for geocoding waterfall audit.

Revision ID: search_logs_20260614
Revises: geocode_provenance_20260613
Create Date: 2026-06-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "search_logs_20260614"
down_revision: Union[str, None] = "geocode_provenance_20260613"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS search_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        source TEXT NOT NULL,
        results_count INT DEFAULT 0,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_search_logs_user "
        "ON search_logs(user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_search_logs_created "
        "ON search_logs(created_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_search_logs_created")
    op.execute("DROP INDEX IF EXISTS idx_search_logs_user")
    op.execute("DROP TABLE IF EXISTS search_logs")
