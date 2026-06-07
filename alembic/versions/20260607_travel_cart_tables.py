"""create travel cart tables

Revision ID: travel_cart_20260607
Revises: lounge_chats_20260606
Create Date: 2026-06-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'travel_cart_20260607'
down_revision: Union[str, None] = 'lounge_chats_20260606'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS travel_cart (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      item_type VARCHAR(50) NOT NULL,
      item_id VARCHAR(255),
      item_name VARCHAR(500) NOT NULL,
      item_image VARCHAR(1000),
      item_category VARCHAR(100),
      place_name VARCHAR(500),
      full_address VARCHAR(1000),
      lat FLOAT DEFAULT 0,
      lng FLOAT DEFAULT 0,
      price_range VARCHAR(50),
      rating FLOAT,
      source VARCHAR(50) DEFAULT 'explore',
      source_url VARCHAR(1000),
      caption_text TEXT,
      extracted_by VARCHAR(50),
      added_at TIMESTAMP DEFAULT NOW(),
      notified_at TIMESTAMP,
      UNIQUE(user_id, item_type, item_id)
    );
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_cart_user 
    ON travel_cart(user_id);
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_cart_added 
    ON travel_cart(user_id, added_at);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_cart_added;")
    op.execute("DROP INDEX IF EXISTS idx_cart_user;")
    op.execute("DROP TABLE IF EXISTS travel_cart;")
