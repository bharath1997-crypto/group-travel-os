"""add password_reset_token and password_reset_expires to users

Revision ID: a1b2c3d4e5f8
Revises: f7a8b9c0d1e2
Create Date: 2026-04-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f8"
down_revision: Union[str, None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_reset_token", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("password_reset_expires", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_users_password_reset_token",
        "users",
        ["password_reset_token"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_users_password_reset_token", table_name="users")
    op.drop_column("users", "password_reset_expires")
    op.drop_column("users", "password_reset_token")
