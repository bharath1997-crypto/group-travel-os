"""add otp fields to users

Revision ID: a8b9c0d1e2f3
Revises: 1d41f034fa67
Create Date: 2026-05-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, None] = "1d41f034fa67"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("verification_otp_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("otp_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "otp_resend_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "users",
        sa.Column("otp_resend_reset_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "otp_attempt_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "otp_attempt_count")
    op.drop_column("users", "otp_resend_reset_at")
    op.drop_column("users", "otp_resend_count")
    op.drop_column("users", "otp_expires_at")
    op.drop_column("users", "verification_otp_hash")
