"""add place_registry and place_media tables for lazy Live place media

Revision ID: place_media_20260630
Revises: e8a4177f590c
Create Date: 2026-06-30

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "place_media_20260630"
down_revision: Union[str, None] = "e8a4177f590c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "place_registry",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("place_key", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=120), nullable=True),
        sa.Column("country", sa.String(length=120), nullable=True),
        sa.Column("category", sa.String(length=120), nullable=True),
        sa.Column("osm_type", sa.String(length=20), nullable=True),
        sa.Column("osm_id", sa.BigInteger(), nullable=True),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="osm"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_place_registry_place_key", "place_registry", ["place_key"], unique=True)

    op.create_table(
        "place_media",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("place_key", sa.String(length=320), nullable=False),
        sa.Column("thumbnail_url", sa.Text(), nullable=False),
        sa.Column("storage_url", sa.Text(), nullable=False),
        sa.Column("caption", sa.String(length=500), nullable=True),
        sa.Column("tags", JSONB(), nullable=False, server_default="[]"),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("attribution", sa.String(length=500), nullable=True),
        sa.Column("license", sa.String(length=120), nullable=True),
        sa.Column("moderation_status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_place_media_place_key", "place_media", ["place_key"])
    op.create_index("ix_place_media_moderation_status", "place_media", ["moderation_status"])


def downgrade() -> None:
    op.drop_index("ix_place_media_moderation_status", table_name="place_media")
    op.drop_index("ix_place_media_place_key", table_name="place_media")
    op.drop_table("place_media")
    op.drop_index("ix_place_registry_place_key", table_name="place_registry")
    op.drop_table("place_registry")
