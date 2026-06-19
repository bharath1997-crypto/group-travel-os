"""google_calendar: scopes->JSONB, trips.google_calendar_event_id

Revision ID: google_calendar_20260616c
Revises: data_imports_20260616b
Create Date: 2026-06-16
"""
from __future__ import annotations

from typing import Union

from alembic import op

revision: str = "google_calendar_20260616c"
down_revision: Union[str, None] = "data_imports_20260616b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change scopes column from TEXT[] to JSONB so SQLAlchemy JSON type works cleanly
    op.execute("""
        ALTER TABLE user_integrations
        ALTER COLUMN scopes TYPE JSONB
        USING to_jsonb(scopes)
    """)

    # Add google_calendar_event_id to trips for tracking synced events
    op.execute("""
        ALTER TABLE trips
        ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE trips
        DROP COLUMN IF EXISTS google_calendar_event_id
    """)
    op.execute("""
        ALTER TABLE user_integrations
        ALTER COLUMN scopes TYPE TEXT[]
        USING ARRAY(SELECT jsonb_array_elements_text(scopes))
    """)
