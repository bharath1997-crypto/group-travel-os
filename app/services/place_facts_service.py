"""Read and upsert provider place facts."""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.schemas.place_facts import PlaceFactOut

logger = logging.getLogger(__name__)

_FACTS_SELECT = """
    SELECT key, value, source, source_url, license, attribution
    FROM place_facts
    WHERE place_id = :place_id
    ORDER BY source ASC, key ASC
"""

_UPSERT = """
    INSERT INTO place_facts (
      place_id, source, key, value, source_url, license, attribution, fetched_at
    ) VALUES (
      :place_id, :source, :key, :value, :source_url, :license, :attribution, now()
    )
    ON CONFLICT (place_id, source, key) DO UPDATE SET
      value = EXCLUDED.value,
      source_url = EXCLUDED.source_url,
      license = EXCLUDED.license,
      attribution = EXCLUDED.attribution,
      fetched_at = EXCLUDED.fetched_at
"""


class PlaceFactsService:
    @staticmethod
    def facts_for_place_uuid(db: Session, place_id: UUID | str) -> list[PlaceFactOut]:
        try:
            rows = db.execute(text(_FACTS_SELECT), {"place_id": str(place_id)}).mappings().all()
        except ProgrammingError:
            db.rollback()
            logger.debug("place_facts table unavailable", exc_info=True)
            return []
        return [
            PlaceFactOut(
                key=str(r["key"]),
                value=str(r["value"]),
                source=str(r["source"]),
                source_url=r.get("source_url"),
                license=str(r["license"]),
                attribution=str(r["attribution"]),
            )
            for r in rows
        ]

    @staticmethod
    def facts_for_gers_id(db: Session, gers_id: str) -> list[PlaceFactOut]:
        row = db.execute(
            text("SELECT id FROM places WHERE gers_id = :gers_id LIMIT 1"),
            {"gers_id": gers_id.strip()},
        ).first()
        if row is None:
            return []
        return PlaceFactsService.facts_for_place_uuid(db, row[0])

    @staticmethod
    def upsert_fact(db: Session, place_id: UUID | str, fact: dict[str, Any]) -> None:
        db.execute(
            text(_UPSERT),
            {
                "place_id": str(place_id),
                "source": fact["source"],
                "key": fact["key"],
                "value": fact["value"],
                "source_url": fact.get("source_url") or None,
                "license": fact["license"],
                "attribution": fact["attribution"],
            },
        )
