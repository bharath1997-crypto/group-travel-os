"""Add geocoding_quota table for Geoapify/OpenCage monthly call tracking.

Revision ID: geocoding_quota_20260615
Revises: search_logs_20260614
Create Date: 2026-06-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "geocoding_quota_20260615"
down_revision: Union[str, None] = "search_logs_20260614"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS geocoding_quota (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service TEXT NOT NULL,
        month TEXT NOT NULL,
        call_count INT DEFAULT 0,
        monthly_limit INT DEFAULT 3000,
        safety_threshold INT DEFAULT 2800,
        status TEXT DEFAULT 'active',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(service, month)
    );
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_geocoding_quota_service_month "
        "ON geocoding_quota(service, month)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_geocoding_quota_service_month")
    op.execute("DROP TABLE IF EXISTS geocoding_quota")
