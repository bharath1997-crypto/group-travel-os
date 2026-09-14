"""Add Wayra canonical knowledge tables.

Revision ID: 20260805_wayra_knowledge
Revises: 20260717_bookings
Create Date: 2026-08-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260805_wayra_knowledge"
down_revision: Union[str, None] = "20260717_bookings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "wayra_knowledge_intents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("intent_key", sa.String(80), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("canonical_question", sa.Text(), nullable=False),
        sa.Column("answer_strategy", sa.String(20), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("handler_key", sa.String(50), nullable=True),
        sa.Column("required_context", sa.String(30), nullable=False, server_default="none"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("intent_key", name="uq_wayra_knowledge_intents_intent_key"),
    )
    op.create_index(
        "ix_wayra_knowledge_intents_category",
        "wayra_knowledge_intents",
        ["category"],
    )
    op.create_index(
        "ix_wayra_knowledge_intents_is_active",
        "wayra_knowledge_intents",
        ["is_active"],
    )

    op.create_table(
        "wayra_knowledge_utterances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "intent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("wayra_knowledge_intents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("utterance_text", sa.Text(), nullable=False),
        sa.Column("normalized_text", sa.String(500), nullable=False),
        sa.Column("style_tag", sa.String(40), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint(
            "intent_id",
            "normalized_text",
            name="uq_wayra_knowledge_utterance_intent_norm",
        ),
    )
    op.create_index(
        "ix_wayra_knowledge_utterances_normalized_text",
        "wayra_knowledge_utterances",
        ["normalized_text"],
    )

    op.create_table(
        "wayra_unmatched_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sanitized_text", sa.Text(), nullable=False),
        sa.Column("text_hash", sa.String(64), nullable=False),
        sa.Column("page_category", sa.String(50), nullable=True),
        sa.Column("proposed_intent_key", sa.String(80), nullable=True),
        sa.Column("proposed_confidence", sa.Float(), nullable=True),
        sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("first_seen_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("text_hash", name="uq_wayra_unmatched_text_hash"),
    )
    op.create_index(
        "ix_wayra_unmatched_occurrence_count",
        "wayra_unmatched_questions",
        ["occurrence_count"],
    )


def downgrade() -> None:
    op.drop_index("ix_wayra_unmatched_occurrence_count", table_name="wayra_unmatched_questions")
    op.drop_table("wayra_unmatched_questions")
    op.drop_index(
        "ix_wayra_knowledge_utterances_normalized_text",
        table_name="wayra_knowledge_utterances",
    )
    op.drop_table("wayra_knowledge_utterances")
    op.drop_index("ix_wayra_knowledge_intents_is_active", table_name="wayra_knowledge_intents")
    op.drop_index("ix_wayra_knowledge_intents_category", table_name="wayra_knowledge_intents")
    op.drop_table("wayra_knowledge_intents")
