"""add trip live plans

Revision ID: trip_live_plans_20260605
Revises: trip_plans_20260605
Create Date: 2026-06-05 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'trip_live_plans_20260605'
down_revision: Union[str, None] = 'trip_plans_20260605'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'trip_live_plans',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=True),
        sa.Column('destination', sa.String(255), nullable=True),
        sa.Column('activities', sa.JSON(), nullable=True),
        sa.Column('departure_time', sa.Time(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_trip_live_plans_trip_id'), 'trip_live_plans', ['trip_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_trip_live_plans_trip_id'), table_name='trip_live_plans')
    op.drop_table('trip_live_plans')
