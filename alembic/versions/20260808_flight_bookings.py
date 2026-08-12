"""Add flight_bookings table for standalone flight checkout."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260808_flight_bookings"
down_revision: Union[str, None] = "20260805_wayra_knowledge"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

flight_booking_status = postgresql.ENUM(
    "draft",
    "searched",
    "offer_selected",
    "price_confirmed",
    "travelers_completed",
    "payment_pending",
    "payment_authorized",
    "booking_pending",
    "reserved",
    "ticketing",
    "confirmed",
    "payment_failed",
    "booking_failed",
    "ticketing_failed",
    "cancellation_pending",
    "cancelled",
    "refund_pending",
    "refunded",
    name="flight_booking_status",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE flight_booking_status AS ENUM (
                    'draft', 'searched', 'offer_selected', 'price_confirmed',
                    'travelers_completed', 'payment_pending', 'payment_authorized',
                    'booking_pending', 'reserved', 'ticketing', 'confirmed',
                    'payment_failed', 'booking_failed', 'ticketing_failed',
                    'cancellation_pending', 'cancelled', 'refund_pending', 'refunded'
                );
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )

    op.create_table(
        "flight_bookings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("trip_id", sa.UUID(), nullable=True),
        sa.Column("rovvy_reference", sa.String(length=16), nullable=False),
        sa.Column(
            "provider",
            sa.String(length=32),
            nullable=False,
            server_default="duffel",
        ),
        sa.Column("provider_offer_id", sa.String(length=120), nullable=True),
        sa.Column("provider_order_id", sa.String(length=120), nullable=True),
        sa.Column("airline_pnr", sa.String(length=32), nullable=True),
        sa.Column("eticket_number", sa.String(length=64), nullable=True),
        sa.Column(
            "status",
            flight_booking_status,
            nullable=False,
            server_default="draft",
        ),
        sa.Column("search_params", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("offer_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("priced_amount", sa.Float(), nullable=True),
        sa.Column("search_price", sa.Float(), nullable=True),
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default="USD",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rovvy_reference"),
    )
    op.create_index(
        op.f("ix_flight_bookings_user_id"), "flight_bookings", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_flight_bookings_trip_id"), "flight_bookings", ["trip_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_flight_bookings_trip_id"), table_name="flight_bookings")
    op.drop_index(op.f("ix_flight_bookings_user_id"), table_name="flight_bookings")
    op.drop_table("flight_bookings")
    op.execute(sa.text("DROP TYPE IF EXISTS flight_booking_status"))
