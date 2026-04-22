"""add plaintext verification_token columns to users

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f8
Create Date: 2026-04-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "a1b2c3d4e5f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "verification_token",
            sa.String(length=255),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "verification_token_expires",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_users_verification_token",
        "users",
        ["verification_token"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_users_verification_token", table_name="users")
    op.drop_column("users", "verification_token_expires")
    op.drop_column("users", "verification_token")
