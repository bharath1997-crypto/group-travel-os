"""drop live tables

Revision ID: drop_live_tables_20260620
Revises: microsoft_calendar_20260616d
Create Date: 2026-06-20
"""

from typing import Union

from alembic import op

revision: str = "drop_live_tables_20260620"
down_revision: Union[str, None] = "microsoft_calendar_20260616d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET statement_timeout = 0")
        op.execute("SET lock_timeout = '30s'")
        op.execute("DROP TABLE IF EXISTS live_checklists CASCADE")
        op.execute("DROP TABLE IF EXISTS trip_live_plans CASCADE")
        op.execute("DROP TABLE IF EXISTS live_sessions CASCADE")


def downgrade() -> None:
    pass  # intentional — no rollback
