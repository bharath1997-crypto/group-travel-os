"""add oauth provider ids to users

Revision ID: a1b2c3d4e5f6
Revises: bde563ef2e0a
Create Date: 2026-04-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "bde563ef2e0a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("google_sub", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("facebook_sub", sa.String(length=255), nullable=True),
    )
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True)
    op.create_index(
        op.f("ix_users_facebook_sub"), "users", ["facebook_sub"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_facebook_sub"), table_name="users")
    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.drop_column("users", "facebook_sub")
    op.drop_column("users", "google_sub")
