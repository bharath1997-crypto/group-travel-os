"""add group_invitations table

Revision ID: 5406b6865875
Revises: h4i5j6k7l8m0
Create Date: 2026-04-26 15:07:09.262852

Autogenerate was trimmed: only `group_invitations` plus `notifications` column sizes
and `ix_notifications_user_id_is_read`. Unrelated table/column drift was removed.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "5406b6865875"
down_revision: Union[str, None] = "h4i5j6k7l8m0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "group_invitations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("invited_by", sa.UUID(), nullable=False),
        sa.Column("invited_user_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["invited_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "group_id",
            "invited_user_id",
            name="uq_group_invitations_group_invited_user",
        ),
    )
    op.create_index(
        op.f("ix_group_invitations_group_id"),
        "group_invitations",
        ["group_id"],
        unique=False,
    )

    op.alter_column(
        "notifications",
        "type",
        existing_type=sa.VARCHAR(length=32),
        type_=sa.String(length=50),
        existing_nullable=False,
    )
    op.alter_column(
        "notifications",
        "title",
        existing_type=sa.VARCHAR(length=255),
        type_=sa.String(length=200),
        existing_nullable=False,
    )
    op.alter_column(
        "notifications",
        "body",
        existing_type=sa.VARCHAR(length=2000),
        type_=sa.String(length=500),
        existing_nullable=False,
    )
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.create_index(
        "ix_notifications_user_id_is_read",
        "notifications",
        ["user_id", "is_read"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_id_is_read", table_name="notifications")
    op.create_index(
        "ix_notifications_created_at",
        "notifications",
        ["created_at"],
        unique=False,
    )
    op.alter_column(
        "notifications",
        "body",
        existing_type=sa.String(length=500),
        type_=postgresql.VARCHAR(length=2000),
        existing_nullable=False,
    )
    op.alter_column(
        "notifications",
        "title",
        existing_type=sa.String(length=200),
        type_=postgresql.VARCHAR(length=255),
        existing_nullable=False,
    )
    op.alter_column(
        "notifications",
        "type",
        existing_type=sa.String(length=50),
        type_=postgresql.VARCHAR(length=32),
        existing_nullable=False,
    )

    op.drop_index(op.f("ix_group_invitations_group_id"), table_name="group_invitations")
    op.drop_table("group_invitations")
