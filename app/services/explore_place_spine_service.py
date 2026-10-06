"""Explore hub places from Overture Postgres hot index (places table)."""
from __future__ import annotations

import re
from urllib.parse import quote
from typing import Any, Literal

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.services.place_spine_service import _format_address
from app.services.places_overture_categories import (
    ATTRACTION_BASIC_CATEGORIES,
    RESTAURANT_BASIC_CATEGORIES,
)
from app.utils.exceptions import AppException

ExplorePlacesCategory = Literal["attractions", "restaurants"]

MAX_PLACES_LIMIT = 100
DEFAULT_PLACES_LIMIT = 48
MAX_RADIUS_M = 100_000
MIN_RADIUS_M = 100

_HTTP_URL = re.compile(r"^https?://", re.IGNORECASE)

# Nearest-first via the GiST index (`<->` KNN) instead of sorting every row in the
# radius: a 100 km Chicago query fell from ~5-30 s to <0.5 s with identical results.
# `<->` ranks by sphere distance, ST_Distance by spheroid; the inner scan over-fetches
# (:knn_lim) so the exact outer re-sort cannot drop a boundary row.
SPATIAL_PLACES_SQL = """
    SELECT * FROM (
      SELECT
        p.gers_id,
        p.name,
        p.basic_category,
        p.confidence,
        p.website,
        p.phone,
        p.address,
        p.photos,
        m.thumbnail_url AS media_thumbnail_url,
        m.attribution AS media_attribution,
        m.license AS media_license,
        m.caption AS media_caption,
        m.source AS media_source,
        ST_Y(p.geog::geometry) AS lat,
        ST_X(p.geog::geometry) AS lng,
        ST_Distance(
          p.geog,
          ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
        ) AS distance_m
      FROM (
        SELECT gers_id, name, basic_category, confidence, website, phone, address, photos, geog
        FROM places
        WHERE gers_id IS NOT NULL
          AND basic_category = ANY(:cats)
        ORDER BY geog <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
        LIMIT :knn_lim
      ) p
      LEFT JOIN LATERAL (
        SELECT thumbnail_url, attribution, license, caption, source
        FROM place_media
        WHERE place_key = 'gers:' || p.gers_id AND moderation_status = 'approved'
        ORDER BY created_at DESC
        LIMIT 1
      ) m ON true
    ) nearest
    WHERE distance_m <= :radius_m
    ORDER BY
      distance_m ASC,
      confidence DESC NULLS LAST,
      gers_id ASC
    LIMIT :lim
"""

CITY_PLACES_SQL = """
    SELECT
      p.gers_id,
      p.name,
      p.basic_category,
      p.confidence,
      p.website,
      p.phone,
      p.address,
      p.photos,
      m.thumbnail_url AS media_thumbnail_url,
      m.attribution AS media_attribution,
      m.license AS media_license,
      m.caption AS media_caption,
      m.source AS media_source,
      ST_Y(p.geog::geometry) AS lat,
      ST_X(p.geog::geometry) AS lng,
      NULL::double precision AS distance_m
    FROM places p
    LEFT JOIN LATERAL (
      SELECT thumbnail_url, attribution, license, caption, source
      FROM place_media
      WHERE place_key = 'gers:' || p.gers_id AND moderation_status = 'approved'
      ORDER BY created_at DESC
      LIMIT 1
    ) m ON true
    WHERE p.gers_id IS NOT NULL
      AND p.city_slug = :city_slug
      AND p.basic_category = ANY(:cats)
    ORDER BY
      p.confidence DESC NULLS LAST,
      p.name ASC,
      p.gers_id ASC
    LIMIT :lim
"""


def normalize_city_slug(city: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", city.strip().lower())
    return slug.strip("-") or "unknown"


def _category_list_param(bucket: ExplorePlacesCategory) -> list[str]:
    if bucket == "restaurants":
        return sorted(RESTAURANT_BASIC_CATEGORIES)
    return sorted(ATTRACTION_BASIC_CATEGORIES)


def _format_category_label(basic_category: str | None) -> str:
    raw = (basic_category or "place").strip().lower()
    return raw.replace("_", " ").strip().title() or "Place"


def _website_url(raw: str | None) -> str | None:
    if not raw:
        return None
    url = raw.strip()
    if not url:
        return None
    if _HTTP_URL.match(url):
        return url
    if url.startswith("www."):
        return f"https://{url}"
    return None


def _photo_url_from_spine(raw: Any) -> str | None:
    if not raw:
        return None
    if isinstance(raw, (list, tuple)):
        for item in raw:
            if isinstance(item, str) and item.strip().startswith("http"):
                return item.strip()
        return None
    if isinstance(raw, str) and raw.strip().startswith("http"):
        return raw.strip()
    return None


def _coordinate_from_row(row: dict[str, Any], key: str, *, sql_alias: str | None = None) -> float | None:
    raw = row.get(key)
    if raw is None and sql_alias:
        raw = row.get(sql_alias)
    if raw is None:
        return None
    return float(raw)


def _media_thumbnail(row: dict[str, Any]) -> str | None:
    url = row.get("media_thumbnail_url")
    return str(url) if isinstance(url, str) and _HTTP_URL.match(url) else None


def _media_credit(row: dict[str, Any]) -> dict[str, Any]:
    """Author/license credit for approved place_media (required for CC BY / BY-SA photos)."""
    if not _media_thumbnail(row) or _photo_url_from_spine(row.get("photos")):
        return {}
    credit: dict[str, Any] = {
        "image_attribution": row.get("media_attribution") or None,
        "image_license": row.get("media_license") or None,
        "image_source_url": None,
    }
    caption = row.get("media_caption")
    if row.get("media_source") == "open_license" and isinstance(caption, str) and caption.strip():
        credit["image_source_url"] = (
            "https://commons.wikimedia.org/wiki/File:" + quote(caption.strip().replace(" ", "_"))
        )
    return credit


def map_spine_row_to_explore_place(row: dict[str, Any]) -> dict[str, Any]:
    gers_id = str(row["gers_id"])
    website = _website_url(row.get("website"))
    out: dict[str, Any] = {
        "id": gers_id,
        "gers_id": gers_id,
        "name": str(row["name"]),
        "category": _format_category_label(row.get("basic_category")),
        "address": _format_address(row.get("address")),
        "lat": _coordinate_from_row(row, "lat"),
        "lng": _coordinate_from_row(row, "lng", sql_alias="lon"),
        "source": "overture",
        "source_label": "Overture",
        "confidence": float(row["confidence"]) if row.get("confidence") is not None else None,
        "url": website,
        "phone": (str(row["phone"]).strip() or None) if row.get("phone") else None,
        "image_url": _photo_url_from_spine(row.get("photos")) or _media_thumbnail(row),
        **_media_credit(row),
    }
    if row.get("distance_m") is not None:
        out["distance_m"] = float(row["distance_m"])
    return out


def spine_database_ready(db: Session) -> bool:
    """Overture hot index requires PostgreSQL + PostGIS (places.geog)."""
    bind = db.get_bind()
    if isinstance(bind, Engine):
        return bind.dialect.name == "postgresql"
    return getattr(getattr(bind, "dialect", None), "name", "") == "postgresql"


class ExplorePlacesSpineUnavailable(Exception):
    """Places hot index cannot run on this database or schema."""


class ExplorePlaceSpineService:
    @staticmethod
    def validate_query_params(
        *,
        lat: float | None,
        lon: float | None,
        radius_m: float | None,
        limit: int | None,
    ) -> tuple[float | None, float | None, float | None, int]:
        if (lat is None) ^ (lon is None):
            AppException.bad_request("lat and lon must be supplied together")
        if lat is not None:
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                AppException.bad_request("Invalid coordinates")
        radius: float | None = None
        if lat is not None:
            radius = float(radius_m if radius_m is not None else 32_000)
            if radius < MIN_RADIUS_M or radius > MAX_RADIUS_M:
                AppException.bad_request("radius_m out of allowed range")
        lim = int(limit if limit is not None else DEFAULT_PLACES_LIMIT)
        if lim < 1 or lim > MAX_PLACES_LIMIT:
            AppException.bad_request("limit out of allowed range")
        return lat, lon, radius, lim

    @staticmethod
    def search_places(
        db: Session,
        *,
        city: str,
        category: ExplorePlacesCategory,
        lat: float | None = None,
        lon: float | None = None,
        radius_m: float | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        if not spine_database_ready(db):
            raise ExplorePlacesSpineUnavailable("PostgreSQL PostGIS places index required")

        lat, lon, radius, lim = ExplorePlaceSpineService.validate_query_params(
            lat=lat,
            lon=lon,
            radius_m=radius_m,
            limit=limit,
        )
        cats = _category_list_param(category)
        params: dict[str, Any] = {"cats": cats, "lim": lim}

        if lat is not None and lon is not None and radius is not None:
            params["lat"] = lat
            params["lon"] = lon
            params["radius_m"] = radius
            params["knn_lim"] = lim * 2 + 10
            sql = SPATIAL_PLACES_SQL
        else:
            params["city_slug"] = normalize_city_slug(city)
            sql = CITY_PLACES_SQL

        rows = db.execute(text(sql), params).mappings().all()
        return [map_spine_row_to_explore_place(dict(r)) for r in rows]
