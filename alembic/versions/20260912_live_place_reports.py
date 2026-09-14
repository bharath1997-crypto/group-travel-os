"""add live place reports (L2 vibe reports)

Revision ID: 20260912_live_place_reports
Revises: 20260808_flight_bookings
Create Date: 2026-09-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


revision: str = "20260912_live_place_reports"
down_revision: Union[str, None] = "20260808_flight_bookings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "live_place_reports" in inspector.get_table_names():
        return

    op.create_table(
        "live_place_reports",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("reporter_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "report_type",
            sa.Enum(
                "long_line",
                "packed",
                "quiet",
                "price_changed",
                "closed_early",
                "no_parking",
                name="liveplacereporttype",
            ),
            nullable=False,
        ),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("place_name", sa.String(length=200), nullable=True),
        sa.Column("place_key", sa.String(length=200), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_live_place_reports_lat_lng", "live_place_reports", ["lat", "lng"])
    op.create_index("ix_live_place_reports_expires_at", "live_place_reports", ["expires_at"])
    op.create_index("ix_live_place_reports_place_key", "live_place_reports", ["place_key"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "live_place_reports" not in inspector.get_table_names():
        return

    op.drop_index("ix_live_place_reports_place_key", table_name="live_place_reports")
    op.drop_index("ix_live_place_reports_expires_at", table_name="live_place_reports")
    op.drop_index("ix_live_place_reports_lat_lng", table_name="live_place_reports")
    op.drop_table("live_place_reports")
    op.execute("DROP TYPE IF EXISTS liveplacereporttype")
