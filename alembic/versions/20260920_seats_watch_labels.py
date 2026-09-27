"""seats watch corridor labels

Revision ID: 20260920_seats_watch_labels
Revises: 20260919_seats_public_visibility
"""
from pathlib import Path
from typing import Sequence, Union

from alembic import op

revision: str = "20260920_seats_watch_labels"
down_revision: Union[str, None] = "20260919_seats_public_visibility"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SQL_PATH = Path(__file__).resolve().parents[2] / "migrations" / "005_seats_watch_labels.sql"


def upgrade() -> None:
    op.execute(_SQL_PATH.read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE ride_watches DROP COLUMN IF EXISTS from_label;
        ALTER TABLE ride_watches DROP COLUMN IF EXISTS to_label;
        """
    )
