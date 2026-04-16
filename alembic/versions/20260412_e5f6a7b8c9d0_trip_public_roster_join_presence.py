"""trip roster, join requests, profile_public, member presence

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "profile_public",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "group_members",
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "trip_roster",
        sa.Column("trip_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("trip_id", "user_id"),
    )
    op.create_index(op.f("ix_trip_roster_trip_id"), "trip_roster", ["trip_id"], unique=False)
    op.create_index(op.f("ix_trip_roster_user_id"), "trip_roster", ["user_id"], unique=False)

    op.create_table(
        "trip_join_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("trip_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trip_id", "user_id", name="uq_trip_join_requests_trip_user"),
    )
    op.create_index(op.f("ix_trip_join_requests_trip_id"), "trip_join_requests", ["trip_id"], unique=False)
    op.create_index(op.f("ix_trip_join_requests_user_id"), "trip_join_requests", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_trip_join_requests_user_id"), table_name="trip_join_requests")
    op.drop_index(op.f("ix_trip_join_requests_trip_id"), table_name="trip_join_requests")
    op.drop_table("trip_join_requests")

    op.drop_index(op.f("ix_trip_roster_user_id"), table_name="trip_roster")
    op.drop_index(op.f("ix_trip_roster_trip_id"), table_name="trip_roster")
    op.drop_table("trip_roster")

    op.drop_column("group_members", "last_seen_at")
    op.drop_column("users", "profile_public")
