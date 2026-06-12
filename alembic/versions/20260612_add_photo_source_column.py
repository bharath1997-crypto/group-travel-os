"""add photo_source column to places

Revision ID: photo_source_20260612
Revises: explorer_cache_replace_20260611b
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "photo_source_20260612"
down_revision: Union[str, None] = "explorer_cache_replace_20260611b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS photo_source TEXT DEFAULT NULL"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE places DROP COLUMN IF EXISTS photo_source")
