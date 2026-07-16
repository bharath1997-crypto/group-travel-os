"""Guest voting: nullable user_id, guest_identifier, partial unique indexes."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260717_guest_voting"
down_revision: Union[str, None] = "20260716_poll_option_dates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_votes_poll_user", "votes", type_="unique")

    op.alter_column(
        "votes",
        "user_id",
        existing_type=sa.UUID(),
        nullable=True,
    )

    op.add_column(
        "votes",
        sa.Column("guest_identifier", sa.String(length=64), nullable=True),
    )

    op.create_check_constraint(
        "ck_votes_user_or_guest",
        "votes",
        "(user_id IS NOT NULL AND guest_identifier IS NULL) "
        "OR (user_id IS NULL AND guest_identifier IS NOT NULL)",
    )

    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX uq_votes_poll_user "
            "ON votes (poll_id, user_id) WHERE user_id IS NOT NULL"
        )
    )
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX uq_votes_poll_guest "
            "ON votes (poll_id, guest_identifier) WHERE guest_identifier IS NOT NULL"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS uq_votes_poll_guest"))
    op.execute(sa.text("DROP INDEX IF EXISTS uq_votes_poll_user"))

    op.drop_constraint("ck_votes_user_or_guest", "votes", type_="check")
    op.drop_column("votes", "guest_identifier")

    op.execute(sa.text("DELETE FROM votes WHERE user_id IS NULL"))

    op.alter_column(
        "votes",
        "user_id",
        existing_type=sa.UUID(),
        nullable=False,
    )

    op.create_unique_constraint(
        "uq_votes_poll_user",
        "votes",
        ["poll_id", "user_id"],
    )
