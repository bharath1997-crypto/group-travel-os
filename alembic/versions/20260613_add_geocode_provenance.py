"""Add geocode provenance columns to places table.

Revision ID: geocode_provenance_20260613
Revises: photo_source_20260612
Create Date: 2026-06-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "geocode_provenance_20260613"
down_revision: Union[str, None] = "photo_source_20260612"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE places ADD COLUMN IF NOT EXISTS city_source TEXT")
    op.execute("ALTER TABLE places ADD COLUMN IF NOT EXISTS state_source TEXT")
    op.execute("ALTER TABLE places ADD COLUMN IF NOT EXISTS postcode_source TEXT")
    op.execute("ALTER TABLE places ADD COLUMN IF NOT EXISTS geocode_confidence TEXT")
    op.execute(
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS geocode_updated_at TIMESTAMPTZ"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE places DROP COLUMN IF EXISTS geocode_updated_at")
    op.execute("ALTER TABLE places DROP COLUMN IF EXISTS geocode_confidence")
    op.execute("ALTER TABLE places DROP COLUMN IF EXISTS postcode_source")
    op.execute("ALTER TABLE places DROP COLUMN IF EXISTS state_source")
    op.execute("ALTER TABLE places DROP COLUMN IF EXISTS city_source")
