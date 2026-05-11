"""create location_hashtags table

Revision ID: loc_hash_20260510
Revises: admin_flag_20260509
Create Date: 2026-05-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "loc_hash_20260510"
down_revision: Union[str, None] = "admin_flag_20260509"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "location_hashtags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("country", sa.String(length=100), nullable=False),
        sa.Column("state", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("landmark", sa.String(length=200), nullable=True),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("hashtags", JSONB(), nullable=False, server_default="[]"),
        sa.Column("youtube_channel_ids", JSONB(), nullable=False, server_default="[]"),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="city"),
        sa.Column("population", sa.Integer(), nullable=True),
        sa.Column("geonames_id", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_location_hashtags_country", "location_hashtags", ["country"])
    op.create_index("ix_location_hashtags_state", "location_hashtags", ["state"])
    op.create_index("ix_location_hashtags_city", "location_hashtags", ["city"])
    op.create_unique_constraint("uq_location_hashtags_geonames_id", "location_hashtags", ["geonames_id"])


def downgrade() -> None:
    op.drop_table("location_hashtags")
