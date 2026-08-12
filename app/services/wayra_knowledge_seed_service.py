"""Idempotent seed/update for Wayra canonical knowledge corpus."""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.wayra import WayraKnowledgeIntent, WayraKnowledgeUtterance
from app.services.wayra_knowledge_service import normalize_knowledge_query

logger = logging.getLogger(__name__)

DEFAULT_SEED_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "wayra_knowledge_seed.json"
)


def load_seed_payload(path: Path | None = None) -> dict:
    seed_path = path or DEFAULT_SEED_PATH
    data = json.loads(seed_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("intents"), list):
        raise ValueError(f"Invalid Wayra knowledge seed file: {seed_path}")
    return data


def validate_seed_payload(data: dict) -> None:
    intents = data["intents"]
    if len(intents) != 100:
        raise ValueError(f"Expected 100 intents, found {len(intents)}")
    all_norms: set[str] = set()
    total = 0
    for row in intents:
        key = row.get("intent_key")
        if not key or not isinstance(key, str):
            raise ValueError("intent_key required")
        strategy = row.get("answer_strategy")
        if strategy not in {"static", "template", "handler"}:
            raise ValueError(f"Bad strategy for {key}: {strategy}")
        if strategy == "handler" and row.get("handler_key") not in {
            "where_am_i",
            "what_can_i_do_here",
            "page_help",
        }:
            raise ValueError(f"Bad handler_key for {key}")
        utts = row.get("utterances") or []
        if len(utts) < 8:
            raise ValueError(f"Intent {key} needs at least 8 utterances")
        for u in utts:
            norm = normalize_knowledge_query(str(u.get("normalized") or u.get("utterance") or ""))
            if not norm:
                raise ValueError(f"Empty utterance on {key}")
            if norm in all_norms:
                raise ValueError(f"Duplicate normalized utterance: {norm}")
            all_norms.add(norm)
            total += 1
    if total < 800:
        raise ValueError(f"Expected ~1000 utterances, found {total}")


def seed_wayra_knowledge(db: Session, path: Path | None = None) -> dict[str, int]:
    """Upsert intents and replace utterances idempotently by intent_key."""
    data = load_seed_payload(path)
    validate_seed_payload(data)

    created = 0
    updated = 0
    utterances = 0

    for row in data["intents"]:
        intent_key = row["intent_key"]
        existing = db.execute(
            select(WayraKnowledgeIntent).where(
                WayraKnowledgeIntent.intent_key == intent_key
            )
        ).scalar_one_or_none()

        if existing is None:
            intent = WayraKnowledgeIntent(
                id=uuid.uuid4(),
                intent_key=intent_key,
                category=row["category"],
                canonical_question=row["canonical_question"],
                answer_strategy=row["answer_strategy"],
                answer_text=row.get("answer_text"),
                handler_key=row.get("handler_key"),
                required_context=row.get("required_context") or "none",
                version=1,
                is_active=True,
            )
            db.add(intent)
            db.flush()
            created += 1
        else:
            intent = existing
            intent.category = row["category"]
            intent.canonical_question = row["canonical_question"]
            intent.answer_strategy = row["answer_strategy"]
            intent.answer_text = row.get("answer_text")
            intent.handler_key = row.get("handler_key")
            intent.required_context = row.get("required_context") or "none"
            intent.version = int(intent.version or 1) + 1
            intent.is_active = True
            # Clear old utterances for clean replace
            for old in list(intent.utterances):
                db.delete(old)
            db.flush()
            updated += 1

        seen_norm: set[str] = set()
        for u in row.get("utterances") or []:
            text = str(u.get("utterance") or "").strip()
            norm = normalize_knowledge_query(str(u.get("normalized") or text))
            if not text or not norm or norm in seen_norm:
                continue
            seen_norm.add(norm)
            db.add(
                WayraKnowledgeUtterance(
                    id=uuid.uuid4(),
                    intent_id=intent.id,
                    utterance_text=text,
                    normalized_text=norm,
                    style_tag=u.get("style_tag"),
                )
            )
            utterances += 1

    db.commit()
    logger.info(
        "Wayra knowledge seed complete: created=%s updated=%s utterances=%s",
        created,
        updated,
        utterances,
    )
    return {"created": created, "updated": updated, "utterances": utterances}
