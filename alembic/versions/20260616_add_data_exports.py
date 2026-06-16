"""add data_export_requests and user_integrations tables

Revision ID: data_exports_20260616
Revises: geocoding_quota_20260615
Create Date: 2026-06-16
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "data_exports_20260616"
down_revision: Union[str, None] = "geocoding_quota_20260615"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS data_export_requests (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            export_type   TEXT NOT NULL DEFAULT 'full',
            format        TEXT NOT NULL DEFAULT 'zip',
            status        TEXT NOT NULL DEFAULT 'pending',
            file_url      TEXT,
            file_size_kb  INTEGER,
            error_message TEXT,
            requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            ready_at      TIMESTAMPTZ,
            expires_at    TIMESTAMPTZ,
            metadata      JSONB NOT NULL DEFAULT '{}'
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_data_exports_user_status ON data_export_requests(user_id, status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_data_exports_expires ON data_export_requests(expires_at) WHERE status = 'ready'")

    op.execute("""
        CREATE TABLE IF NOT EXISTS user_integrations (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider          TEXT NOT NULL,
            access_token      TEXT,
            refresh_token     TEXT,
            token_expires_at  TIMESTAMPTZ,
            scopes            TEXT[],
            external_user_id  TEXT,
            is_active         BOOLEAN NOT NULL DEFAULT true,
            last_synced_at    TIMESTAMPTZ,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(user_id, provider)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON user_integrations(user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS data_export_requests")
    op.execute("DROP TABLE IF EXISTS user_integrations")
