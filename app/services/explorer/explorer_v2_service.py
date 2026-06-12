from __future__ import annotations

import hashlib
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.explorer_v2 import (
    ExploreNearbyResponse,
    ExploreViewportResponse,
    PlaceResult,
)
from app.services.explorer.explorer_service import explorer_service

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 3600

SECTION_CATEGORIES: dict[str, list[str]] = {
    "landmark": ["landmark", "photo_spot"],
    "trekking": ["trekking", "nature"],
    "gaming": ["gaming"],
    "amusement": ["amusement"],
    "restaurant": ["restaurant"],
    "park": ["park"],
    "nightlife": ["nightlife"],
    "sports": ["sports"],
    "shopping": ["shopping"],
    "entertainment": ["entertainment"],
}


def _resolve_categories(categories: list[str] | None) -> list[str] | None:
    """Expand explorer section keys into underlying place categories."""
    if not categories:
        return None

    resolved: list[str] = []
    for category in categories:
        mapped = SECTION_CATEGORIES.get(category)
        if mapped:
            resolved.extend(mapped)
        else:
            resolved.append(category)

    return list(dict.fromkeys(resolved))


def _build_cache_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _row_to_place(row: dict[str, Any]) -> PlaceResult:
    return PlaceResult(
        id=row["id"],
        name=row["name"],
        category=row.get("category"),
        subcategory=row.get("subcategory"),
        lat=float(row["lat"]),
        lng=float(row["lng"]),
        address=row.get("address"),
        website=row.get("website"),
        phone=row.get("phone"),
        opening_hours=row.get("opening_hours"),
        photo_url=row.get("photo_url"),
        source=row.get("source") or "osm",
        distance_m=(
            float(row["distance_m"]) if row.get("distance_m") is not None else None
        ),
    )


def _category_clause(categories: list[str] | None) -> tuple[str, dict[str, Any]]:
    if categories:
        return "AND category = ANY(:categories)", {"categories": categories}
    return "", {}


def _fetch_places_by_ids(
    db: Session,
    place_ids: list[str],
    lat: float | None = None,
    lng: float | None = None,
) -> list[PlaceResult]:
    if not place_ids:
        return []

    if lat is not None and lng is not None:
        sql = text(
            """
            SELECT id, name, category, subcategory, lat, lng, address,
                   website, phone, opening_hours, photo_url, source,
                   ST_Distance(
                       geom::geography,
                       ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                   ) AS distance_m
            FROM places
            WHERE id = ANY(CAST(:place_ids AS uuid[]))
            ORDER BY distance_m ASC
            """
        )
        params: dict[str, Any] = {
            "place_ids": place_ids,
            "lat": lat,
            "lng": lng,
        }
    else:
        sql = text(
            """
            SELECT id, name, category, subcategory, lat, lng, address,
                   website, phone, opening_hours, photo_url, source,
                   NULL AS distance_m
            FROM places
            WHERE id = ANY(CAST(:place_ids AS uuid[]))
            """
        )
        params = {"place_ids": place_ids}

    rows = db.execute(sql, params).mappings().all()
    return [_row_to_place(dict(row)) for row in rows]


class ExplorerV2Service:
    def get_nearby(
        self,
        lat: float,
        lng: float,
        radius_m: float,
        categories: list[str] | None,
        limit: int,
        db: Session,
    ) -> ExploreNearbyResponse:
        cats = sorted(categories or [])
        cache_key = _build_cache_key(
            f"nearby:{lat:.4f}:{lng:.4f}:{radius_m}:{cats}:{limit}"
        )

        cached_ids = explorer_service.get_cache(db, cache_key)
        if cached_ids is not None:
            places = _fetch_places_by_ids(db, cached_ids, lat=lat, lng=lng)
            return ExploreNearbyResponse(
                places=places,
                cached=True,
                total=len(places),
            )

        resolved_categories = _resolve_categories(categories)
        category_sql, category_params = _category_clause(resolved_categories)
        query = text(
            f"""
            SELECT id, name, category, subcategory, lat, lng, address,
                   website, phone, opening_hours, photo_url, source,
                   ST_Distance(
                       geom::geography,
                       ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                   ) AS distance_m
            FROM places
            WHERE ST_DWithin(
                geom::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                :radius_m
            )
            {category_sql}
            ORDER BY distance_m ASC
            LIMIT :limit
            """
        )
        params: dict[str, Any] = {
            "lat": lat,
            "lng": lng,
            "radius_m": radius_m,
            "limit": limit,
            **category_params,
        }
        rows = db.execute(query, params).mappings().all()
        places = [_row_to_place(dict(row)) for row in rows]

        result_ids = [str(row["id"]) for row in rows]
        bbox = {
            "sw_lat": lat - 0.05,
            "sw_lng": lng - 0.05,
            "ne_lat": lat + 0.05,
            "ne_lng": lng + 0.05,
        }
        explorer_service.set_cache(
            db, cache_key, bbox, result_ids, CACHE_TTL_SECONDS
        )

        return ExploreNearbyResponse(
            places=places,
            cached=False,
            total=len(places),
        )

    def get_viewport(
        self,
        sw_lat: float,
        sw_lng: float,
        ne_lat: float,
        ne_lng: float,
        categories: list[str] | None,
        limit: int,
        db: Session,
    ) -> ExploreViewportResponse:
        cats = sorted(categories or [])
        cache_key = _build_cache_key(
            f"viewport:{sw_lat:.4f}:{sw_lng:.4f}:{ne_lat:.4f}:{ne_lng:.4f}:{cats}:{limit}"
        )

        cached_ids = explorer_service.get_cache(db, cache_key)
        if cached_ids is not None:
            places = _fetch_places_by_ids(db, cached_ids)
            return ExploreViewportResponse(
                places=places,
                cached=True,
                total=len(places),
            )

        resolved_categories = _resolve_categories(categories)
        category_sql, category_params = _category_clause(resolved_categories)
        query = text(
            f"""
            SELECT id, name, category, subcategory, lat, lng, address,
                   website, phone, opening_hours, photo_url, source,
                   NULL AS distance_m
            FROM places
            WHERE ST_Within(
                geom,
                ST_MakeEnvelope(:sw_lng, :sw_lat, :ne_lng, :ne_lat, 4326)
            )
            {category_sql}
            LIMIT :limit
            """
        )
        params: dict[str, Any] = {
            "sw_lat": sw_lat,
            "sw_lng": sw_lng,
            "ne_lat": ne_lat,
            "ne_lng": ne_lng,
            "limit": limit,
            **category_params,
        }
        rows = db.execute(query, params).mappings().all()
        places = [_row_to_place(dict(row)) for row in rows]

        result_ids = [str(row["id"]) for row in rows]
        bbox = {
            "sw_lat": sw_lat,
            "sw_lng": sw_lng,
            "ne_lat": ne_lat,
            "ne_lng": ne_lng,
        }
        explorer_service.set_cache(
            db, cache_key, bbox, result_ids, CACHE_TTL_SECONDS
        )

        return ExploreViewportResponse(
            places=places,
            cached=False,
            total=len(places),
        )


explorer_v2_service = ExplorerV2Service()
