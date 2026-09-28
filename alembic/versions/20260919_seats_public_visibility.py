"""seats public visibility

Revision ID: 20260919_seats_public_visibility
Revises: 20260917_seats
Create Date: 2026-09-19

Applies migrations/004_seats_public_visibility.sql
"""
from pathlib import Path
from typing import Sequence, Union

from alembic import op

revision: str = "20260919_seats_public_visibility"
down_revision: Union[str, None] = "20260917_seats"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SQL_PATH = Path(__file__).resolve().parents[2] / "migrations" / "004_seats_public_visibility.sql"


def upgrade() -> None:
    op.execute(_SQL_PATH.read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_visibility_check;
        ALTER TABLE rides ADD CONSTRAINT rides_visibility_check
          CHECK (visibility IN ('groups', 'fof'));
        UPDATE rides SET visibility = 'fof' WHERE visibility = 'public';
        """
    )
    op.execute("DROP FUNCTION IF EXISTS seats_visible_to(uuid, uuid)")
    sql_003 = Path(__file__).resolve().parents[2] / "migrations" / "003_seats.sql"
    text = sql_003.read_text(encoding="utf-8")
    start = text.index("CREATE OR REPLACE FUNCTION seats_visible_to")
    op.execute(text[start:])
