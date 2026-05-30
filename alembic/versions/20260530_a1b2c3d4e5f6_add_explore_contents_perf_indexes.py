"""add_explore_contents_perf_indexes

Revision ID: explore_idx_20260530
Revises: 8271b3940b89
Create Date: 2026-05-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "explore_idx_20260530"
down_revision: Union[str, None] = "8271b3940b89"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_explore_contents_venue_lat_lon "
        "ON explore_contents (venue_lat, venue_lon)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_explore_contents_start_date "
        "ON explore_contents (start_date)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_explore_contents_source "
        "ON explore_contents (source)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_explore_contents_source")
    op.execute("DROP INDEX IF EXISTS idx_explore_contents_start_date")
    op.execute("DROP INDEX IF EXISTS idx_explore_contents_venue_lat_lon")
