"""add date_of_birth to users

Revision ID: f7a8b9c0d1e2
Revises: d4e5f6a7b8c9
Create Date: 2026-04-12
"""

from alembic import op
import sqlalchemy as sa


revision = "f7a8b9c0d1e2"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("date_of_birth", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "date_of_birth")
