"""Add bookings table for trip-scoped provider checkout links."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260717_bookings"
down_revision: Union[str, None] = "20260717_guest_voting"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

booking_provider = postgresql.ENUM(
    "duffel",
    "manual_link",
    name="booking_provider",
    create_type=False,
)
booking_status = postgresql.ENUM(
    "pending",
    "confirmed",
    "failed",
    "cancelled",
    name="booking_status",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE booking_provider AS ENUM ('duffel', 'manual_link');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE booking_status AS ENUM (
                    'pending', 'confirmed', 'failed', 'cancelled'
                );
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )

    op.create_table(
        "bookings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("trip_id", sa.UUID(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("provider", booking_provider, nullable=False),
        sa.Column("provider_reference", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            booking_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("booking_url", sa.String(length=500), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default="USD",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_bookings_trip_id"), "bookings", ["trip_id"], unique=False)
    op.create_index(
        op.f("ix_bookings_created_by"), "bookings", ["created_by"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_bookings_created_by"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_trip_id"), table_name="bookings")
    op.drop_table("bookings")
    op.execute(sa.text("DROP TYPE IF EXISTS booking_status"))
    op.execute(sa.text("DROP TYPE IF EXISTS booking_provider"))
