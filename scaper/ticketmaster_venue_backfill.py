"""One-off / maintenance backfill for Ticketmaster venue photos on linked Overture places."""
from __future__ import annotations

import json
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.engine import Engine

from scaper.connectors.ticketmaster import venue_image_from_embedded
from scaper.venue_place_media import TICKETMASTER_LINK_METHODS, upsert_ticketmaster_venue_media


@dataclass
class BackfillStats:
    candidates: int = 0
    with_image: int = 0
    inserted: int = 0


def backfill_ticketmaster_venue_photos(engine: Engine, *, dry_run: bool = True) -> BackfillStats:
    stats = BackfillStats()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT l.external_id AS venue_external_id,
                       p.gers_id::text AS gers_id,
                       (
                         SELECT rr.payload
                         FROM public.events e
                         JOIN ingest.raw_records rr
                           ON rr.connector = 'ticketmaster'
                          AND rr.external_id = e.external_id
                         WHERE e.venue_place_id = l.place_id
                           AND e.provider = 'ticketmaster'
                         ORDER BY e.fetched_at DESC NULLS LAST
                         LIMIT 1
                       ) AS payload
                FROM ingest.place_links l
                JOIN places p ON p.id = l.place_id
                WHERE l.connector = 'ticketmaster'
                  AND l.method = ANY(:methods)
                  AND p.gers_id IS NOT NULL
                """
            ),
            {"methods": list(TICKETMASTER_LINK_METHODS)},
        ).mappings().all()

    stats.candidates = len(rows)
    with engine.begin() as conn:
        for row in rows:
            payload = row["payload"]
            if isinstance(payload, str):
                payload = json.loads(payload)
            if not isinstance(payload, dict):
                continue
            image_url = venue_image_from_embedded(payload, str(row["venue_external_id"]))
            if not image_url:
                continue
            stats.with_image += 1
            if dry_run:
                continue
            gers_id = row["gers_id"]
            if not gers_id:
                continue
            if upsert_ticketmaster_venue_media(
                conn,
                gers_id=gers_id,
                venue_external_id=str(row["venue_external_id"]),
                image_url=image_url,
            ):
                stats.inserted += 1
    return stats
