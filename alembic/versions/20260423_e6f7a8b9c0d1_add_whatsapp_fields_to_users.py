"""add whatsapp_number and whatsapp_verified to users

Revision ID: e6f7a8b9c0d1
Revises: f0a1b2c3d4e5
Create Date: 2026-04-23

Note: Linear chain: d5e6f7a8b9c0 -> f0a1b2c3d4e5 -> this revision.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "f0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _user_columns() -> set[str]:
    bind = op.get_bind()
    insp = inspect(bind)
    return {c["name"] for c in insp.get_columns("users")}


def upgrade() -> None:
    cols = _user_columns()
    if "whatsapp_number" not in cols:
        op.add_column(
            "users",
            sa.Column("whatsapp_number", sa.String(length=32), nullable=True),
        )
    if "whatsapp_verified" not in cols:
        op.add_column(
            "users",
            sa.Column("whatsapp_verified", sa.Boolean(), nullable=True, server_default=sa.text("false")),
        )


def downgrade() -> None:
    cols = _user_columns()
    if "whatsapp_verified" in cols:
        op.drop_column("users", "whatsapp_verified")
    if "whatsapp_number" in cols:
        op.drop_column("users", "whatsapp_number")
