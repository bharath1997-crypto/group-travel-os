"""buddy_trips and buddy_requests tables

Revision ID: buddy_trips_20260513
Revises: user_flight_prefs_20260512
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "buddy_trips_20260513"
down_revision: Union[str, None] = "user_flight_prefs_20260512"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "buddy_trips",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organizer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("destination", sa.String(length=200), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("max_size", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("current_size", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "vibe_tags",
            postgresql.ARRAY(sa.String(length=80)),
            nullable=False,
            server_default=sa.text("'{}'::varchar[]"),
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["organizer_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_buddy_trips_organizer_id"),
        "buddy_trips",
        ["organizer_id"],
        unique=False,
    )

    op.create_table(
        "buddy_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("buddy_trip_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["buddy_trip_id"], ["buddy_trips.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_buddy_requests_buddy_trip_id"),
        "buddy_requests",
        ["buddy_trip_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_buddy_requests_requester_id"),
        "buddy_requests",
        ["requester_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_buddy_requests_requester_id"), table_name="buddy_requests")
    op.drop_index(op.f("ix_buddy_requests_buddy_trip_id"), table_name="buddy_requests")
    op.drop_table("buddy_requests")
    op.drop_index(op.f("ix_buddy_trips_organizer_id"), table_name="buddy_trips")
    op.drop_table("buddy_trips")
