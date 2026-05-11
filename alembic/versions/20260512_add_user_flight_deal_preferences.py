"""add home_airport deal_price_threshold deal_alerts_enabled to users

Revision ID: user_flight_prefs_20260512
Revises: live_sessions_20260511

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "user_flight_prefs_20260512"
down_revision: Union[str, None] = "live_sessions_20260511"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("home_airport", sa.String(length=3), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "deal_price_threshold",
            sa.Float(),
            nullable=True,
            server_default=sa.text("300.0"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "deal_alerts_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "deal_alerts_enabled")
    op.drop_column("users", "deal_price_threshold")
    op.drop_column("users", "home_airport")
