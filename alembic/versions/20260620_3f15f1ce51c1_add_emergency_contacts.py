"""add emergency contacts

Revision ID: 3f15f1ce51c1
Revises: 337f61d1c7f9
Create Date: 2026-06-20

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "3f15f1ce51c1"
down_revision = "337f61d1c7f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "emergency_contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_emergency_contacts_user_id"),
        "emergency_contacts",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_emergency_contacts_user_id"), table_name="emergency_contacts")
    op.drop_table("emergency_contacts")
