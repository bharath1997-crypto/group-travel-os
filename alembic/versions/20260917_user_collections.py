"""add user collections and collection items

Revision ID: 20260917_user_collections
Revises: 20260912_live_place_reports
Create Date: 2026-09-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


revision: str = "20260917_user_collections"
down_revision: Union[str, None] = "20260912_live_place_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if "user_collections" not in existing:
        op.create_table(
            "user_collections",
            sa.Column("id", UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", UUID(as_uuid=True), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("group_id", UUID(as_uuid=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_user_collections_user_id"),
            "user_collections",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_user_collections_group_id"),
            "user_collections",
            ["group_id"],
            unique=False,
        )

    if "collection_items" not in existing:
        op.create_table(
            "collection_items",
            sa.Column("id", UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", UUID(as_uuid=True), nullable=False),
            sa.Column("collection_id", UUID(as_uuid=True), nullable=True),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("latitude", sa.Float(), nullable=True),
            sa.Column("longitude", sa.Float(), nullable=True),
            sa.Column("city", sa.String(length=120), nullable=True),
            sa.Column("country", sa.String(length=120), nullable=True),
            sa.Column("category", sa.String(length=80), nullable=True),
            sa.Column("subcategory", sa.String(length=80), nullable=True),
            sa.Column(
                "source",
                sa.String(length=40),
                nullable=False,
                server_default="Search",
            ),
            sa.Column("saved_from", sa.String(length=500), nullable=True),
            sa.Column("note", sa.String(length=1000), nullable=True),
            sa.Column("stars", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "match_status",
                sa.String(length=20),
                nullable=False,
                server_default="sure",
            ),
            sa.Column(
                "is_unsorted",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["collection_id"],
                ["user_collections.id"],
                ondelete="SET NULL",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_collection_items_user_id"),
            "collection_items",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_collection_items_collection_id"),
            "collection_items",
            ["collection_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_collection_items_collection_id"), table_name="collection_items")
    op.drop_index(op.f("ix_collection_items_user_id"), table_name="collection_items")
    op.drop_table("collection_items")
    op.drop_index(op.f("ix_user_collections_group_id"), table_name="user_collections")
    op.drop_index(op.f("ix_user_collections_user_id"), table_name="user_collections")
    op.drop_table("user_collections")
