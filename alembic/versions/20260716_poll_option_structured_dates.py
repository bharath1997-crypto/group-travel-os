"""poll_options structured start_date and end_date columns

Revision ID: 20260716_poll_option_dates
Revises: 20260714_trip_lock
Create Date: 2026-07-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260716_poll_option_dates"
down_revision: Union[str, None] = "20260714_trip_lock"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "poll_options",
        sa.Column("start_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "poll_options",
        sa.Column("end_date", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("poll_options", "end_date")
    op.drop_column("poll_options", "start_date")
