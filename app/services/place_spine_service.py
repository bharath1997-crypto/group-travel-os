"""Overture data-spine place detail for PlacePanel."""
from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.place_spine import PlaceSpineDetail, PlaceSpinePhoto
from app.utils.exceptions import AppException

_GERS_ID_RE = re.compile(r"^[0-9a-f]{16,64}$", re.IGNORECASE)


def _format_category_label(basic_category: str | None) -> tuple[str, str]:
    raw = (basic_category or "place").strip().lower()
    slug = raw.replace(" ", "_")
    label = slug.replace("_", " ").strip().title()
    return slug, label or "Place"


def _format_address(address: Any) -> str | None:
    if address is None:
        return None
    if isinstance(address, str):
        cleaned = address.strip()
        return cleaned or None
    if isinstance(address, dict):
        line1 = " ".join(
            part
            for part in (
                address.get("house_number") or address.get("number"),
                address.get("road") or address.get("street"),
            )
            if part
        )
        line2 = ", ".join(
            part
            for part in (
                address.get("city") or address.get("town") or address.get("locality"),
                address.get("state") or address.get("region"),
                address.get("postcode") or address.get("postal_code"),
            )
            if part
        )
        formatted = ", ".join(part for part in (line1, line2) if part)
        if formatted:
            return formatted
        for key in ("freeform", "formatted", "label"):
            val = address.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
        try:
            return json.dumps(address, ensure_ascii=False)
        except (TypeError, ValueError):
            return None
    return str(address).strip() or None


def _iso_or_empty(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _photos_from_db(raw: Any) -> list[PlaceSpinePhoto]:
    if not raw:
        return []
    items: list[str] = []
    if isinstance(raw, (list, tuple)):
        items = [str(x) for x in raw if x]
    elif isinstance(raw, str):
        items = [raw]
    photos: list[PlaceSpinePhoto] = []
    for index, key in enumerate(items):
        key_prefix = key.strip()
        if not key_prefix:
            continue
        photos.append(
            PlaceSpinePhoto(
                id=f"{index + 1}",
                key_prefix=key_prefix,
            )
        )
    return photos


_SPINE_SELECT = """
                  gers_id,
                  name,
                  ST_Y(geog::geometry) AS lat,
                  ST_X(geog::geometry) AS lon,
                  basic_category,
                  website,
                  instagram,
                  address,
                  city_slug,
                  depth_tier,
                  short_description,
                  wikidata_qid,
                  enriched_at,
                  claimed_by,
                  photos
"""

DEFAULT_SPINE_NEAR_RADIUS_M = 50.0


def _detail_from_row(row: Any) -> PlaceSpineDetail:
    category, category_label = _format_category_label(row.get("basic_category"))
    wikidata_qid = row.get("wikidata_qid")
    short_description = row.get("short_description")
    claimed_by = row.get("claimed_by")
    enriched_at = row.get("enriched_at")

    description_source: str | None = None
    description_url: str | None = None
    if wikidata_qid:
        description_source = "Wikidata"
        description_url = f"https://www.wikidata.org/wiki/{wikidata_qid}"
    elif claimed_by:
        description_source = "Operator"

    updated_at = _iso_or_empty(enriched_at)

    return PlaceSpineDetail(
        gers_id=str(row["gers_id"]),
        name=str(row["name"]),
        category=category,
        category_label=category_label,
        lat=float(row["lat"]),
        lon=float(row["lon"]),
        neighborhood=None,
        city_slug=row.get("city_slug"),
        address=_format_address(row.get("address")),
        depth_tier=int(row.get("depth_tier") or 0),
        short_description=short_description,
        description_source=description_source,
        description_url=description_url,
        website=row.get("website"),
        instagram=row.get("instagram"),
        hours=None,
        claimed=claimed_by is not None,
        photos=_photos_from_db(row.get("photos")),
        would_return_pct=None,
        review_count=0,
        group_tags=[],
        latest_review=None,
        bookable=False,
        next_slot=None,
        slots_tonight=None,
        updated_at=updated_at,
    )


class PlaceSpineService:
    @staticmethod
    def get_by_gers_id(db: Session, gers_id: str) -> PlaceSpineDetail:
        normalized = (gers_id or "").strip()
        if not normalized or not _GERS_ID_RE.match(normalized):
            AppException.bad_request("Invalid gers_id")

        row = db.execute(
            text(
                f"""
                SELECT
                {_SPINE_SELECT}
                FROM places
                WHERE gers_id = :gers_id
                LIMIT 1
                """
            ),
            {"gers_id": normalized},
        ).mappings().first()

        if row is None:
            AppException.not_found("Place not found")

        return _detail_from_row(row)

    @staticmethod
    def get_nearest(
        db: Session,
        lat: float,
        lon: float,
        radius_meters: float = DEFAULT_SPINE_NEAR_RADIUS_M,
    ) -> PlaceSpineDetail:
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            AppException.bad_request("Invalid coordinates")
        radius = float(radius_meters)
        if radius <= 0 or radius > 500:
            AppException.bad_request("Invalid radius_meters")

        row = db.execute(
            text(
                f"""
                SELECT
                {_SPINE_SELECT}
                FROM places
                WHERE ST_DWithin(
                  geog,
                  ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                  :radius_m
                )
                ORDER BY ST_Distance(
                  geog,
                  ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                ) ASC
                LIMIT 1
                """
            ),
            {"lat": lat, "lon": lon, "radius_m": radius},
        ).mappings().first()

        if row is None:
            AppException.not_found("Place not found")

        return _detail_from_row(row)
