"""live sos and subscriptions

Revision ID: live_sos_sub_20260604
Revises: explore_idx_20260530
Create Date: 2026-06-04 15:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'live_sos_sub_20260604'
down_revision: Union[str, None] = 'explore_idx_20260530'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create sos_events table
    op.create_table(
        'sos_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sos_events_trip_id'), 'sos_events', ['trip_id'], unique=False)
    op.create_index(op.f('ix_sos_events_user_id'), 'sos_events', ['user_id'], unique=False)

    # 2. Update subscriptions table:
    # Drop unique index 'ix_subscriptions_user_id' and recreate it as a non-unique index.
    op.drop_index('ix_subscriptions_user_id', table_name='subscriptions')
    op.create_index('ix_subscriptions_user_id', 'subscriptions', ['user_id'], unique=False)

    # Add columns: trip_id, plan_type, expires_at, created_at
    op.add_column('subscriptions', sa.Column('trip_id', sa.UUID(), nullable=True))
    op.add_column('subscriptions', sa.Column('plan_type', sa.String(length=50), nullable=True))
    op.add_column('subscriptions', sa.Column('expires_at', sa.DateTime(), nullable=True))
    op.add_column('subscriptions', sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')))
    op.create_index(op.f('ix_subscriptions_trip_id'), 'subscriptions', ['trip_id'], unique=False)
    op.create_foreign_key('fk_subscriptions_trip_id', 'subscriptions', 'trips', ['trip_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    # 1. Drop subscriptions additions
    op.drop_constraint('fk_subscriptions_trip_id', 'subscriptions', type_='foreignkey')
    op.drop_index(op.f('ix_subscriptions_trip_id'), table_name='subscriptions')
    op.drop_column('subscriptions', 'created_at')
    op.drop_column('subscriptions', 'expires_at')
    op.drop_column('subscriptions', 'plan_type')
    op.drop_column('subscriptions', 'trip_id')

    # Recreate unique index on user_id
    op.drop_index('ix_subscriptions_user_id', table_name='subscriptions')
    op.create_index('ix_subscriptions_user_id', 'subscriptions', ['user_id'], unique=True)

    # 2. Drop sos_events
    op.drop_index(op.f('ix_sos_events_user_id'), table_name='sos_events')
    op.drop_index(op.f('ix_sos_events_trip_id'), table_name='sos_events')
    op.drop_table('sos_events')
