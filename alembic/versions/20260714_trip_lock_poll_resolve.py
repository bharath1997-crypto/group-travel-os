"""trip locked status, locked_at, polls.resolved_option_id

Revision ID: 20260714_trip_lock
Revises: 20260630_add_place_registry_media
Create Date: 2026-07-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260714_trip_lock"
down_revision: Union[str, None] = "place_media_20260630"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'locked'"))

    op.add_column(
        "trips",
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.add_column(
        "polls",
        sa.Column("resolved_option_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_polls_resolved_option_id",
        "polls",
        "poll_options",
        ["resolved_option_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_polls_resolved_option_id",
        "polls",
        ["resolved_option_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_polls_resolved_option_id", table_name="polls")
    op.drop_constraint("fk_polls_resolved_option_id", "polls", type_="foreignkey")
    op.drop_column("polls", "resolved_option_id")
    op.drop_column("trips", "locked_at")
    # PostgreSQL cannot remove enum values safely; locked trips must be migrated first.
