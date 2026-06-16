"""add data_import_requests table

Revision ID: data_imports_20260616b
Revises: data_exports_20260616
Create Date: 2026-06-16
"""
from __future__ import annotations

from typing import Union

from alembic import op

revision: str = "data_imports_20260616b"
down_revision: Union[str, None] = "data_exports_20260616"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS data_import_requests (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            import_type       TEXT NOT NULL,
            format            TEXT NOT NULL,
            status            TEXT NOT NULL DEFAULT 'preview',
            original_filename TEXT,
            total_items       INTEGER NOT NULL DEFAULT 0,
            valid_items       INTEGER NOT NULL DEFAULT 0,
            duplicate_items   INTEGER NOT NULL DEFAULT 0,
            error_items       INTEGER NOT NULL DEFAULT 0,
            preview_data      JSONB NOT NULL DEFAULT '{}',
            error_message     TEXT,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            imported_at       TIMESTAMPTZ,
            metadata          JSONB NOT NULL DEFAULT '{}'
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_data_imports_user ON data_import_requests(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_data_imports_status ON data_import_requests(user_id, status)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS data_import_requests")
