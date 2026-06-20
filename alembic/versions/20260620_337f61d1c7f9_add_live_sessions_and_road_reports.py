"""add live sessions and road reports

Revision ID: 337f61d1c7f9
Revises: drop_live_tables_20260620
Create Date: 2026-06-20 04:05:19.026042

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


revision: str = "337f61d1c7f9"
down_revision: Union[str, None] = "drop_live_tables_20260620"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())
    if "live_sessions" in existing:
        op.drop_table("live_sessions")

    op.create_table(
        "live_sessions",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("trip_id", UUID(as_uuid=True), nullable=True),
        sa.Column("started_by", UUID(as_uuid=True), nullable=False),
        sa.Column("mode", sa.Enum("solo", "group", name="livemode"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["started_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "road_reports",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("reporter_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "report_type",
            sa.Enum(
                "accident",
                "traffic",
                "closure",
                "police",
                "pothole",
                "flood",
                "construction",
                "hazard",
                "stopped_vehicle",
                "weather",
                name="reporttype",
            ),
            nullable=False,
        ),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("description", sa.String(length=200), nullable=True),
        sa.Column("confirmed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("dismissed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_road_reports_lat_lng", "road_reports", ["lat", "lng"])
    op.create_index("ix_road_reports_is_active", "road_reports", ["is_active"])
    op.create_index("ix_road_reports_expires_at", "road_reports", ["expires_at"])

    op.create_table(
        "report_confirmations",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("report_id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["road_reports.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("report_id", "user_id", name="uq_report_confirmation"),
    )


def downgrade() -> None:
    op.drop_table("report_confirmations")
    op.drop_index("ix_road_reports_expires_at", table_name="road_reports")
    op.drop_index("ix_road_reports_is_active", table_name="road_reports")
    op.drop_index("ix_road_reports_lat_lng", table_name="road_reports")
    op.drop_table("road_reports")
    op.drop_table("live_sessions")
    sa.Enum(name="reporttype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="livemode").drop(op.get_bind(), checkfirst=True)
