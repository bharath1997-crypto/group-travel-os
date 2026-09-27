"""seats — intercity seat sharing tables

Revision ID: 20260917_seats
Revises: 20260917_user_collections
Create Date: 2026-09-17

Runs migrations/003_seats.sql (PostGIS required).
"""
from pathlib import Path
from typing import Sequence, Union

from alembic import op

revision: str = "20260917_seats"
down_revision: Union[str, None] = "20260917_user_collections"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SQL_PATH = Path(__file__).resolve().parents[2] / "migrations" / "003_seats.sql"


def upgrade() -> None:
    sql = _SQL_PATH.read_text(encoding="utf-8")
    op.execute(sql)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS seats_visible_to(uuid, uuid)")
    for table in (
        "split_entries",
        "ride_watches",
        "ride_bookings",
        "ride_stops",
        "rides",
        "connection_paths",
        "fuel_prices",
        "vehicles",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
