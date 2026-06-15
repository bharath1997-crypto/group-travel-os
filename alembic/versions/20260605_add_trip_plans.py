"""add trip plans

Revision ID: trip_plans_20260605
Revises: live_sos_sub_20260604
Create Date: 2026-06-05 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'trip_plans_20260605'
down_revision: Union[str, None] = 'live_sos_sub_20260604'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'trip_plans',
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('plan_json', sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('trip_id')
    )


def downgrade() -> None:
    op.drop_table('trip_plans')
