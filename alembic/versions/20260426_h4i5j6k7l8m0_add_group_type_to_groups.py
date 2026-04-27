"""add group_type to groups

Revision ID: h4i5j6k7l8m0
Revises: g2h3i4j5k6l7
Create Date: 2026-04-26
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "h4i5j6k7l8m0"
down_revision: Union[str, None] = "g2h3i4j5k6l7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "groups",
        sa.Column(
            "group_type",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'regular'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("groups", "group_type")
