"""add spectator invites

Revision ID: e8a4177f590c
Revises: 222ea30cc975
Create Date: 2026-06-21 03:27:43.863522

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e8a4177f590c"
down_revision: Union[str, None] = "222ea30cc975"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "spectator_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("host_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invite_token", sa.String(length=64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["host_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["live_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invite_token"),
    )
    op.create_index(
        "ix_spectator_invites_session_id",
        "spectator_invites",
        ["session_id"],
    )
    op.create_index(
        "ix_spectator_invites_host_user_id",
        "spectator_invites",
        ["host_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_spectator_invites_host_user_id", table_name="spectator_invites")
    op.drop_index("ix_spectator_invites_session_id", table_name="spectator_invites")
    op.drop_table("spectator_invites")
