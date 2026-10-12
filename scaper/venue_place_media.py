"""Ticketmaster venue images → place_media (hot-link only, licensed_partner)."""
from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection

from scaper.connectors.ticketmaster import venue_image_from_embedded

TICKETMASTER_LINK_METHODS = frozenset({"geo_name", "geo_name_wide", "geo_address"})
TICKETMASTER_ATTRIBUTION = "Image: Ticketmaster"
TICKETMASTER_LICENSE = "Ticketmaster Discovery API"
TICKETMASTER_CAPTION_PREFIX = "ticketmaster:venue:"


def ticketmaster_venue_caption(external_id: str) -> str:
    return f"{TICKETMASTER_CAPTION_PREFIX}{external_id}"


def _place_key(gers_id: str) -> str:
    return f"gers:{gers_id}"


def has_priority_place_photo(conn: Connection, place_key: str) -> bool:
    """True when an approved user or Wikimedia photo should win over Ticketmaster."""
    found = conn.execute(
        text(
            """
            SELECT 1 FROM place_media
            WHERE place_key = :place_key
              AND moderation_status = 'approved'
              AND source IN ('rovvy_user', 'open_license')
            LIMIT 1
            """
        ),
        {"place_key": place_key},
    ).scalar()
    return found is not None


def upsert_ticketmaster_venue_media(
    conn: Connection,
    *,
    gers_id: str,
    venue_external_id: str,
    image_url: str,
) -> bool:
    """
    Insert or refresh a Ticketmaster hot-link row. Returns False if skipped due to
    higher-priority media or missing gers_id.
    """
    url = (image_url or "").strip()
    if not url or not gers_id or not venue_external_id:
        return False
    pk = _place_key(gers_id)
    if has_priority_place_photo(conn, pk):
        return False
    caption = ticketmaster_venue_caption(venue_external_id)
    conn.execute(
        text(
            """
            DELETE FROM place_media
            WHERE place_key = :place_key
              AND source = 'licensed_partner'
              AND caption = :caption
            """
        ),
        {"place_key": pk, "caption": caption},
    )
    conn.execute(
        text(
            """
            INSERT INTO place_media (
              id, place_key, thumbnail_url, storage_url, caption, tags, source,
              attribution, license, moderation_status, created_at
            ) VALUES (
              :id, :place_key, :thumbnail_url, :storage_url, :caption, CAST(:tags AS jsonb),
              'licensed_partner', :attribution, :license, 'approved', now()
            )
            """
        ),
        {
            "id": uuid.uuid4(),
            "place_key": pk,
            "thumbnail_url": url,
            "storage_url": url,
            "caption": caption,
            "tags": json.dumps(["ticketmaster", "licensed_partner"]),
            "attribution": TICKETMASTER_ATTRIBUTION,
            "license": TICKETMASTER_LICENSE,
        },
    )
    return True


def delete_ticketmaster_venue_media(conn: Connection, venue_external_id: str) -> int:
    caption = ticketmaster_venue_caption(venue_external_id)
    result = conn.execute(
        text(
            """
            DELETE FROM place_media
            WHERE source = 'licensed_partner'
              AND caption = :caption
            """
        ),
        {"caption": caption},
    )
    return int(result.rowcount or 0)


def sync_ticketmaster_venue_media_after_link(
    conn: Connection,
    *,
    connector: str,
    method: str,
    gers_id: str | None,
    venue_external_id: str,
    image_url: str | None,
) -> bool:
    if connector != "ticketmaster":
        return False
    if method not in TICKETMASTER_LINK_METHODS:
        return False
    if not gers_id:
        return False
    return upsert_ticketmaster_venue_media(
        conn,
        gers_id=gers_id,
        venue_external_id=venue_external_id,
        image_url=image_url or "",
    )


def purge_ticketmaster_media_on_link_removed(
    conn: Connection, connector: str, external_id: str
) -> int:
    if connector != "ticketmaster":
        return 0
    return delete_ticketmaster_venue_media(conn, external_id)


def image_url_from_ticketmaster_payload(payload: dict[str, Any], venue_external_id: str) -> str | None:
    return venue_image_from_embedded(payload, venue_external_id)
