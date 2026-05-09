"""Add explorer_cache table

Revision ID: c7d2e9a1f4b3
Revises: a4a708e5a5bf
Create Date: 2026-05-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c7d2e9a1f4b3"
down_revision: Union[str, None] = "a4a708e5a5bf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "explorer_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "cache_scope",
            sa.String(length=50),
            nullable=False,
            server_default="explorer",
        ),
        sa.Column("country_code", sa.String(length=10), nullable=False),
        sa.Column("city_slug", sa.String(length=120), nullable=False),
        sa.Column("module", sa.String(length=50), nullable=False),
        sa.Column("radius_bucket", sa.String(length=20), nullable=False),
        sa.Column("geo_bucket", sa.String(length=50), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "country_code",
            "city_slug",
            "module",
            "radius_bucket",
            "geo_bucket",
            "cache_scope",
            name="uq_explorer_cache_scope_key",
        ),
    )
    op.create_index(
        op.f("ix_explorer_cache_cache_scope"),
        "explorer_cache",
        ["cache_scope"],
        unique=False,
    )
    op.create_index(
        op.f("ix_explorer_cache_country_code"),
        "explorer_cache",
        ["country_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_explorer_cache_city_slug"),
        "explorer_cache",
        ["city_slug"],
        unique=False,
    )
    op.create_index(
        op.f("ix_explorer_cache_module"),
        "explorer_cache",
        ["module"],
        unique=False,
    )
    op.create_index(
        op.f("ix_explorer_cache_radius_bucket"),
        "explorer_cache",
        ["radius_bucket"],
        unique=False,
    )
    op.create_index(
        op.f("ix_explorer_cache_geo_bucket"),
        "explorer_cache",
        ["geo_bucket"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_explorer_cache_geo_bucket"), table_name="explorer_cache")
    op.drop_index(op.f("ix_explorer_cache_radius_bucket"), table_name="explorer_cache")
    op.drop_index(op.f("ix_explorer_cache_module"), table_name="explorer_cache")
    op.drop_index(op.f("ix_explorer_cache_city_slug"), table_name="explorer_cache")
    op.drop_index(op.f("ix_explorer_cache_country_code"), table_name="explorer_cache")
    op.drop_index(op.f("ix_explorer_cache_cache_scope"), table_name="explorer_cache")
    op.drop_table("explorer_cache")
