"""microsoft_calendar: add trips.microsoft_calendar_event_id

Revision ID: microsoft_calendar_20260616d
Revises: google_calendar_20260616c
Create Date: 2026-06-16
"""
from __future__ import annotations

from typing import Union

from alembic import op

revision: str = "microsoft_calendar_20260616d"
down_revision: Union[str, None] = "google_calendar_20260616c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE trips
        ADD COLUMN IF NOT EXISTS microsoft_calendar_event_id TEXT
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE trips
        DROP COLUMN IF EXISTS microsoft_calendar_event_id
    """)
