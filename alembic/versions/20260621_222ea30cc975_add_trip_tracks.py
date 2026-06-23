"""add trip tracks

Revision ID: 222ea30cc975
Revises: 3f15f1ce51c1
Create Date: 2026-06-21 02:56:20.775644

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "222ea30cc975"
down_revision: Union[str, None] = "3f15f1ce51c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trip_tracks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("trip_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("track_points", sa.JSON(), nullable=False),
        sa.Column("total_distance_m", sa.Float(), nullable=True),
        sa.Column("total_duration_s", sa.Integer(), nullable=True),
        sa.Column("max_speed_mph", sa.Float(), nullable=True),
        sa.Column("avg_speed_mph", sa.Float(), nullable=True),
        sa.Column("reports_encountered", sa.Integer(), nullable=True),
        sa.Column("cameras_passed", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["live_sessions.id"]),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trip_tracks_user_id", "trip_tracks", ["user_id"])
    op.create_index("ix_trip_tracks_session_id", "trip_tracks", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_trip_tracks_session_id", table_name="trip_tracks")
    op.drop_index("ix_trip_tracks_user_id", table_name="trip_tracks")
    op.drop_table("trip_tracks")
