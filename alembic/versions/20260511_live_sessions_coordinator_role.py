"""live sessions, checklists, member_role coordinator

Revision ID: live_sessions_20260511
Revises: loc_hash_20260510
Create Date: 2026-05-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


revision: str = "live_sessions_20260511"
down_revision: Union[str, None] = "loc_hash_20260510"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'coordinator'"))

    op.create_table(
        "live_sessions",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("trip_id", UUID(as_uuid=True), nullable=False),
        sa.Column("started_by", UUID(as_uuid=True), nullable=False),
        sa.Column("session_code", sa.String(length=8), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pre_live"),
        sa.Column("meet_radius_meters", sa.Integer(), nullable=False, server_default="200"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["started_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_live_sessions_trip_id"), "live_sessions", ["trip_id"])
    op.create_index(op.f("ix_live_sessions_started_by"), "live_sessions", ["started_by"])
    op.create_index(
        op.f("ix_live_sessions_session_code"),
        "live_sessions",
        ["session_code"],
        unique=True,
    )

    op.create_table(
        "live_checklists",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_accepted", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["session_id"], ["live_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "session_id",
            "user_id",
            name="uq_live_checklists_session_user",
        ),
    )
    op.create_index(op.f("ix_live_checklists_session_id"), "live_checklists", ["session_id"])
    op.create_index(op.f("ix_live_checklists_user_id"), "live_checklists", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_live_checklists_user_id"), table_name="live_checklists")
    op.drop_index(op.f("ix_live_checklists_session_id"), table_name="live_checklists")
    op.drop_table("live_checklists")
    op.drop_index(op.f("ix_live_sessions_session_code"), table_name="live_sessions")
    op.drop_index(op.f("ix_live_sessions_started_by"), table_name="live_sessions")
    op.drop_index(op.f("ix_live_sessions_trip_id"), table_name="live_sessions")
    op.drop_table("live_sessions")
    # Note: PostgreSQL retains `coordinator` in member_role enum if it was added.
