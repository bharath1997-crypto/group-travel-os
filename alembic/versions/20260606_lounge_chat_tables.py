"""create lounge chat tables

Revision ID: lounge_chats_20260606
Revises: trip_live_plans_20260605
Create Date: 2026-06-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'lounge_chats_20260606'
down_revision: Union[str, None] = 'trip_live_plans_20260605'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS lounge_chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(20) NOT NULL,
      name VARCHAR(255),
      trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      last_message_preview VARCHAR(255),
      last_message_at TIMESTAMP,
      avatar_url VARCHAR(500)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS lounge_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID REFERENCES lounge_chats(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT NOW(),
      is_admin BOOLEAN DEFAULT FALSE,
      drive_backup_enabled BOOLEAN DEFAULT TRUE,
      drive_backup_interval VARCHAR(20) DEFAULT '24h',
      UNIQUE(chat_id, user_id)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS lounge_drive_sync (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      chat_id UUID REFERENCES lounge_chats(id) ON DELETE CASCADE,
      drive_file_id VARCHAR(255),
      last_synced_at TIMESTAMP,
      UNIQUE(user_id, chat_id)
    );
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS lounge_drive_sync;")
    op.execute("DROP TABLE IF EXISTS lounge_members;")
    op.execute("DROP TABLE IF EXISTS lounge_chats;")
