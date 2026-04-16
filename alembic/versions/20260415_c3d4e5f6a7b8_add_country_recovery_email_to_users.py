"""add country and recovery_email to users for profile completion

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("country", sa.String(length=80), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("recovery_email", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "recovery_email")
    op.drop_column("users", "country")
