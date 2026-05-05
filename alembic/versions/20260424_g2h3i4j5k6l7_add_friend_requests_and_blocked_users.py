"""add friend_requests and blocked_users tables

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2026-04-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g2h3i4j5k6l7"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "friend_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("sender_id", sa.UUID(), nullable=False),
        sa.Column("receiver_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["receiver_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sender_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "sender_id",
            "receiver_id",
            name="uq_friend_requests_sender_receiver",
        ),
    )
    op.create_index(
        "ix_friend_requests_sender_id",
        "friend_requests",
        ["sender_id"],
        unique=False,
    )
    op.create_index(
        "ix_friend_requests_receiver_id",
        "friend_requests",
        ["receiver_id"],
        unique=False,
    )
    op.create_index(
        "ix_friend_requests_receiver_pending",
        "friend_requests",
        ["receiver_id", "status"],
        unique=False,
    )

    op.create_table(
        "blocked_users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("blocker_id", sa.UUID(), nullable=False),
        sa.Column("blocked_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["blocked_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["blocker_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "blocker_id",
            "blocked_id",
            name="uq_blocked_users_blocker_blocked",
        ),
    )
    op.create_index(
        "ix_blocked_users_blocker_id",
        "blocked_users",
        ["blocker_id"],
        unique=False,
    )
    op.create_index(
        "ix_blocked_users_blocked_id",
        "blocked_users",
        ["blocked_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_blocked_users_blocked_id", table_name="blocked_users")
    op.drop_index("ix_blocked_users_blocker_id", table_name="blocked_users")
    op.drop_table("blocked_users")

    op.drop_index("ix_friend_requests_receiver_pending", table_name="friend_requests")
    op.drop_index("ix_friend_requests_receiver_id", table_name="friend_requests")
    op.drop_index("ix_friend_requests_sender_id", table_name="friend_requests")
    op.drop_table("friend_requests")
