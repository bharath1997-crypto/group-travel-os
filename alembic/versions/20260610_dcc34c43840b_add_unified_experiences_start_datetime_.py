"""add_unified_experiences_start_datetime_index

Revision ID: dcc34c43840b
Revises: unified_experiences_20260610
Create Date: 2026-06-10 14:09:43.680322

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dcc34c43840b'
down_revision: Union[str, None] = 'unified_experiences_20260610'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_unified_experiences_start_datetime "
        "ON unified_experiences(start_datetime)"
    )


def downgrade() -> None:
    op.execute(
        "DROP INDEX IF EXISTS idx_unified_experiences_start_datetime"
    )

