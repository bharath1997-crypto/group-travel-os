"""users avatar_url and profile_picture to TEXT (large data URLs, long provider URLs)

Revision ID: f0a1b2c3d4e5
Revises: d5e6f7a8b9c0
Create Date: 2026-04-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f0a1b2c3d4e5"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "avatar_url",
        existing_type=sa.String(length=2048),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "users",
        "profile_picture",
        existing_type=sa.String(length=2048),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "avatar_url",
        existing_type=sa.Text(),
        type_=sa.String(length=2048),
        existing_nullable=True,
    )
    op.alter_column(
        "users",
        "profile_picture",
        existing_type=sa.Text(),
        type_=sa.String(length=2048),
        existing_nullable=True,
    )
