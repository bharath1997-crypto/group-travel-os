"""Explore US state/city directory (places_directory table + Scaper event coverage)."""
from __future__ import annotations

import logging
import math
import threading
import time
from collections import defaultdict
from typing import Any
from urllib.parse import quote

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models.places_directory import PlacesDirectoryRow
from app.services.explore_directory_slugs import directory_city_slug, directory_state_slug
from app.services.explore_scaper_events import scaper_coverage
from app.services.place_facts_wikipedia import ATTRIBUTION, LICENSE
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

INDEXABLE_MIN_INVENTORY = 10
EVENT_COUNTS_TTL_SECONDS = 300

_event_counts_lock = threading.Lock()
_event_counts_cached_at: float | None = None
_event_counts_cache: dict[str, int] | None = None


def clear_event_counts_cache_for_tests() -> None:
    global _event_counts_cached_at, _event_counts_cache
    with _event_counts_lock:
        _event_counts_cached_at = None
        _event_counts_cache = None


def _is_postgres(db: Session) -> bool:
    return db.bind is not None and db.bind.dialect.name == "postgresql"


def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 3958.7613
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_lng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _load_event_counts_from_db(db: Session) -> dict[str, int]:
    counts: dict[str, int] = {}
    for state in scaper_coverage(db):
        for city in state.get("cities") or []:
            slug = str(city.get("slug") or "")
            if slug:
                counts[slug] = int(city.get("events") or 0)
    return counts


def event_counts_by_city_slug(db: Session) -> dict[str, int]:
    global _event_counts_cached_at, _event_counts_cache
    now = time.monotonic()
    with _event_counts_lock:
        if (
            _event_counts_cache is not None
            and _event_counts_cached_at is not None
            and now - _event_counts_cached_at < EVENT_COUNTS_TTL_SECONDS
        ):
            return dict(_event_counts_cache)
    counts = _load_event_counts_from_db(db)
    with _event_counts_lock:
        _event_counts_cached_at = now
        _event_counts_cache = counts
    return counts


def _wikipedia_blurb_from_row(row: PlacesDirectoryRow) -> dict[str, Any] | None:
    extract = (row.wikipedia_extract or "").strip()
    if not extract:
        return None
    title = (row.wikipedia_title or row.name or "").strip()
    url = (row.wikipedia_url or "").strip()
    if not url and title:
        url = f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"
    return {
        "extract": extract,
        "title": title,
        "url": url,
        "license_label": LICENSE,
        "attribution": f"Source: {ATTRIBUTION}, {LICENSE}",
    }


def _all_directory_rows(db: Session, kind: str) -> list[PlacesDirectoryRow]:
    return list(
        db.execute(
            select(PlacesDirectoryRow)
            .where(PlacesDirectoryRow.kind == kind)
            .order_by(PlacesDirectoryRow.name.asc())
        ).scalars().all()
    )


def _cities_grouped_by_state(db: Session) -> dict[str, list[PlacesDirectoryRow]]:
    grouped: dict[str, list[PlacesDirectoryRow]] = defaultdict(list)
    for city in _all_directory_rows(db, "city"):
        grouped[city.state_slug].append(city)
    return grouped


def _state_names_by_slug(db: Session) -> dict[str, str]:
    return {row.slug: row.name for row in _all_directory_rows(db, "state")}


def _count_places_near(db: Session, *, lat: float | None, lng: float | None, radius_km: float = 40) -> int:
    if not _is_postgres(db) or lat is None or lng is None:
        return 0
    try:
        with db.begin_nested():
            row = db.execute(
                text(
                    """
                    SELECT count(*)::int
                    FROM places p
                    WHERE p.geog IS NOT NULL
                      AND ST_DWithin(
                        p.geog,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                        :radius_m
                      )
                    """
                ),
                {"lat": lat, "lng": lng, "radius_m": radius_km * 1000},
            ).scalar()
        return int(row or 0)
    except Exception as exc:
        logger.warning("places_directory place count failed lat=%s lng=%s: %s", lat, lng, exc)
        return 0


def list_states(db: Session) -> list[dict[str, Any]]:
    if not _is_postgres(db):
        return []
    event_counts = event_counts_by_city_slug(db)
    cities_by_state = _cities_grouped_by_state(db)
    states = _all_directory_rows(db, "state")
    out: list[dict[str, Any]] = []
    for row in states:
        cities = cities_by_state.get(row.slug, [])
        state_events = sum(event_counts.get(c.slug, 0) for c in cities)
        out.append(
            {
                "slug": row.slug,
                "name": row.name,
                "state_code": row.state_code,
                "population": row.population,
                "event_count": state_events,
            }
        )
    return out


def _state_row(db: Session, state_slug: str) -> PlacesDirectoryRow | None:
    normalized = directory_state_slug(state_slug.replace("-", " "))
    return db.execute(
        select(PlacesDirectoryRow).where(
            PlacesDirectoryRow.kind == "state",
            PlacesDirectoryRow.slug == normalized,
        )
    ).scalar_one_or_none()


def get_state_page(db: Session, state_slug: str) -> dict[str, Any]:
    if not _is_postgres(db):
        AppException.not_found("State not found")
    state = _state_row(db, state_slug)
    if state is None:
        AppException.not_found("State not found")

    event_counts = event_counts_by_city_slug(db)
    cities = _cities_grouped_by_state(db).get(state.slug, [])

    city_payloads: list[dict[str, Any]] = []
    state_events = 0
    place_hint = 0
    for city in cities:
        ec = event_counts.get(city.slug, 0)
        state_events += ec
        if ec > 0:
            place_hint += ec
        city_payloads.append(
            {
                "slug": city.slug,
                "name": city.name,
                "state_code": city.state_code,
                "population": city.population,
                "event_count": ec,
                "lat": city.lat,
                "lng": city.lng,
            }
        )

    city_payloads.sort(
        key=lambda c: (-int(c["event_count"] or 0), -(c["population"] or 0), c["name"]),
    )

    wiki = _wikipedia_blurb_from_row(state)
    indexable = state_events >= INDEXABLE_MIN_INVENTORY or place_hint >= INDEXABLE_MIN_INVENTORY

    return {
        "slug": state.slug,
        "name": state.name,
        "state_code": state.state_code,
        "population": state.population,
        "event_count": state_events,
        "wikipedia": wiki,
        "indexable": indexable,
        "cities": city_payloads,
    }


def _nearest_city_with_events(
    db: Session,
    *,
    lat: float | None,
    lng: float | None,
    exclude_slug: str | None,
    event_counts: dict[str, int],
    cities: list[PlacesDirectoryRow],
    state_names: dict[str, str],
) -> dict[str, Any] | None:
    if lat is None or lng is None or not event_counts:
        return None
    best: PlacesDirectoryRow | None = None
    best_dist = float("inf")
    best_events = 0
    for city in cities:
        if exclude_slug and city.slug == exclude_slug:
            continue
        ec = event_counts.get(city.slug, 0)
        if ec <= 0 or city.lat is None or city.lng is None:
            continue
        dist = _haversine_miles(lat, lng, city.lat, city.lng)
        if dist < best_dist or (dist == best_dist and ec > best_events):
            best_dist = dist
            best_events = ec
            best = city
    if best is None:
        return None
    return {
        "slug": best.slug,
        "name": best.name,
        "state_slug": best.state_slug,
        "state_name": state_names.get(best.state_slug),
        "event_count": best_events,
        "distance_miles": round(best_dist, 1),
    }


def get_city_page(db: Session, state_slug: str, city_slug_param: str) -> dict[str, Any]:
    if not _is_postgres(db):
        AppException.not_found("City not found")
    state = _state_row(db, state_slug)
    if state is None:
        AppException.not_found("State not found")
    city_slug_norm = directory_city_slug(city_slug_param.replace("-", " "))
    city = db.execute(
        select(PlacesDirectoryRow).where(
            PlacesDirectoryRow.kind == "city",
            PlacesDirectoryRow.state_slug == state.slug,
            PlacesDirectoryRow.slug == city_slug_norm,
        )
    ).scalar_one_or_none()
    if city is None:
        AppException.not_found("City not found")

    event_counts = event_counts_by_city_slug(db)
    event_count = event_counts.get(city.slug, 0)
    place_count = _count_places_near(db, lat=city.lat, lng=city.lng)

    inventory = event_count + place_count
    all_cities = _all_directory_rows(db, "city")
    state_names = _state_names_by_slug(db)
    nearest = None
    if event_count <= 0:
        nearest = _nearest_city_with_events(
            db,
            lat=city.lat,
            lng=city.lng,
            exclude_slug=city.slug,
            event_counts=event_counts,
            cities=all_cities,
            state_names=state_names,
        )

    wiki = _wikipedia_blurb_from_row(city)
    if wiki is None and state.wikipedia_extract:
        wiki = _wikipedia_blurb_from_row(state)

    return {
        "slug": city.slug,
        "name": city.name,
        "state_slug": state.slug,
        "state_name": state.name,
        "state_code": city.state_code or state.state_code,
        "population": city.population,
        "lat": city.lat,
        "lng": city.lng,
        "event_count": event_count,
        "place_count": place_count,
        "wikipedia": wiki,
        "indexable": inventory >= INDEXABLE_MIN_INVENTORY,
        "nearest_with_events": nearest,
    }


def search_directory(db: Session, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
    q = query.strip()
    if len(q) < 2:
        AppException.bad_request("Query must be at least 2 characters")
    if limit < 1 or limit > 10:
        AppException.bad_request("limit must be between 1 and 10")
    if not _is_postgres(db):
        return []

    event_counts = event_counts_by_city_slug(db)
    cities_by_state = _cities_grouped_by_state(db)
    state_names = _state_names_by_slug(db)
    prefix = f"{q.lower()}%"

    try:
        with db.begin_nested():
            rows = db.execute(
                text(
                    """
                    SELECT d.kind, d.slug, d.name, d.state_code, d.state_slug, d.population,
                           GREATEST(
                             similarity(d.name, :q),
                             CASE WHEN d.name ILIKE :prefix THEN 0.5 ELSE 0 END
                           ) AS score
                    FROM places_directory d
                    WHERE d.name ILIKE :prefix
                       OR d.name % :q
                    ORDER BY score DESC,
                             CASE WHEN d.kind = 'state' THEN 0 ELSE 1 END,
                             d.population DESC NULLS LAST,
                             d.name ASC
                    LIMIT :lim
                    """
                ),
                {"q": q, "prefix": prefix, "lim": limit},
            ).mappings().all()
    except Exception as exc:
        logger.warning("places_directory search failed q=%r: %s", q, exc)
        return []

    hits: list[dict[str, Any]] = []
    for row in rows:
        ec = 0
        if row["kind"] == "city":
            ec = event_counts.get(row["slug"], 0)
        elif row["kind"] == "state":
            ec = sum(event_counts.get(c.slug, 0) for c in cities_by_state.get(row["slug"], []))
        hits.append(
            {
                "kind": row["kind"],
                "slug": row["slug"],
                "name": row["name"],
                "state_code": row["state_code"],
                "state_slug": row["state_slug"] or "",
                "state_name": state_names.get(row["state_slug"]) if row["state_slug"] else row["name"],
                "population": row["population"],
                "event_count": ec,
            }
        )
    return hits


def nearest_directory_city(
    db: Session,
    *,
    lat: float,
    lng: float,
) -> dict[str, Any] | None:
    """Nearest directory city to a browser GPS point (coordinates are not stored)."""
    if not _is_postgres(db):
        return None
    cities = _all_directory_rows(db, "city")
    best: PlacesDirectoryRow | None = None
    best_dist = float("inf")
    for city in cities:
        if city.lat is None or city.lng is None:
            continue
        dist = _haversine_miles(lat, lng, city.lat, city.lng)
        if dist < best_dist:
            best_dist = dist
            best = city
    if best is None:
        return None
    state_names = _state_names_by_slug(db)
    event_counts = event_counts_by_city_slug(db)
    return {
        "kind": "city",
        "slug": best.slug,
        "name": best.name,
        "state_code": best.state_code,
        "state_slug": best.state_slug,
        "state_name": state_names.get(best.state_slug),
        "population": best.population,
        "event_count": event_counts.get(best.slug, 0),
        "distance_miles": round(best_dist, 1),
    }


def resolve_hub_city_from_directory(
    db: Session,
    *,
    city: str | None,
    state_code: str | None = None,
) -> str | None:
    """Map a directory city name to Scaper hub slug when inventory exists."""
    if not city or not _is_postgres(db):
        return city.split(",")[0].strip() if city else None
    slug = directory_city_slug(city)
    stmt = select(PlacesDirectoryRow).where(
        PlacesDirectoryRow.kind == "city",
        PlacesDirectoryRow.slug == slug,
    )
    if state_code:
        stmt = stmt.where(PlacesDirectoryRow.state_code == state_code.upper())
    row = db.execute(stmt).scalar_one_or_none()
    if row is None:
        return city.split(",")[0].strip()
    return row.name.split(",")[0].strip()
