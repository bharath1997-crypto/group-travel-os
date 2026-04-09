"""add group_join_requests table

Revision ID: 3c7e9a1b2d45
Revises: 8f2c1d9ab7e4
Create Date: 2026-04-08 12:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3c7e9a1b2d45"
down_revision: Union[str, None] = "8f2c1d9ab7e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "group_join_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "group_id",
            "user_id",
            name="uq_group_join_requests_group_user",
        ),
    )
    op.create_index(
        op.f("ix_group_join_requests_group_id"),
        "group_join_requests",
        ["group_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_group_join_requests_user_id"),
        "group_join_requests",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_group_join_requests_user_id"),
        table_name="group_join_requests",
    )
    op.drop_index(
        op.f("ix_group_join_requests_group_id"),
        table_name="group_join_requests",
    )
    op.drop_table("group_join_requests")
