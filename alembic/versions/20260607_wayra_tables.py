"""create wayra tables

Revision ID: wayra_20260607
Revises: travel_cart_20260607
Create Date: 2026-06-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'wayra_20260607'
down_revision: Union[str, None] = 'travel_cart_20260607'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS wayra_personal_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      memory_type VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      source VARCHAR(50),
      source_id VARCHAR(255),
      wayra_visible BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS wayra_group_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
      wayra_enabled BOOLEAN DEFAULT TRUE,
      turned_off_at TIMESTAMP,
      turned_off_by UUID REFERENCES users(id),
      turned_on_at TIMESTAMP,
      turned_on_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(group_id)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS wayra_group_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
      memory_type VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      wayra_visible BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    """)

    op.execute("""
    ALTER TABLE lounge_chats 
    ADD COLUMN IF NOT EXISTS wayra_enabled BOOLEAN DEFAULT TRUE;
    """)

    op.execute("""
    ALTER TABLE lounge_chats
    ADD COLUMN IF NOT EXISTS wayra_off_since TIMESTAMP;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE lounge_chats DROP COLUMN IF EXISTS wayra_off_since;")
    op.execute("ALTER TABLE lounge_chats DROP COLUMN IF EXISTS wayra_enabled;")
    op.execute("DROP TABLE IF EXISTS wayra_group_memory;")
    op.execute("DROP TABLE IF EXISTS wayra_group_settings;")
    op.execute("DROP TABLE IF EXISTS wayra_personal_memory;")
