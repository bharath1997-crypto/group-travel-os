"""
Lazy place enrichment on user selection — Nominatim address, Wikipedia image/summary, OSRM driving route.

All sources are free (no per-call billing). Results are cached on the explore_contents row.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

import httpx
from sqlalchemy.orm import Session

from app.models.explore_content import ExploreContent

logger = logging.getLogger(__name__)

API_TIMEOUT = 12.0
USER_AGENT = "RovvyApp/1.0 (contact@rovvy.app; explore-place-enrichment)"
ENRICHMENT_TTL_HOURS = 168  # 7 days
OSRM_BASE = "https://router.project-osrm.org/route/v1/driving"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _is_fresh(enrichment: dict[str, Any] | None) -> bool:
    if not enrichment or not isinstance(enrichment, dict):
        return False
    fetched = enrichment.get("fetched_at")
    if not fetched:
        return False
    try:
        ts = datetime.fromisoformat(str(fetched).replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return (_now_utc() - ts) < timedelta(hours=ENRICHMENT_TTL_HOURS)
    except (TypeError, ValueError):
        return False


def _parse_nominatim(data: dict[str, Any]) -> dict[str, str]:
    addr = data.get("address") if isinstance(data.get("address"), dict) else {}
    house = str(addr.get("house_number") or "").strip()
    road = str(
        addr.get("road")
        or addr.get("pedestrian")
        or addr.get("footway")
        or addr.get("path")
        or ""
    ).strip()
    street = f"{house} {road}".strip() if house or road else ""

    city = str(
        addr.get("city")
        or addr.get("town")
        or addr.get("village")
        or addr.get("hamlet")
        or addr.get("municipality")
        or addr.get("suburb")
        or ""
    ).strip()
    state = str(addr.get("state") or "").strip()
    postcode = str(addr.get("postcode") or "").strip()

    parts = [p for p in (street, city, state, postcode) if p]
    formatted = ", ".join(parts)
    if not formatted:
        display = data.get("display_name")
        formatted = str(display).strip() if display else ""

    return {
        "formatted_address": formatted,
        "street": street,
        "city": city,
        "state": state,
        "postcode": postcode,
    }


async def _reverse_geocode(client: httpx.AsyncClient, lat: float, lon: float) -> dict[str, str]:
    try:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": lat,
                "lon": lon,
                "format": "json",
                "addressdetails": 1,
                "zoom": 18,
            },
            headers={"User-Agent": USER_AGENT},
        )
        if resp.status_code == 200 and isinstance(resp.json(), dict):
            return _parse_nominatim(resp.json())
    except Exception as exc:
        logger.warning("Nominatim reverse geocode failed: %s", exc)
    return {
        "formatted_address": "",
        "street": "",
        "city": "",
        "state": "",
        "postcode": "",
    }


def _normalize_title(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


async def _wikipedia_by_coords(
    client: httpx.AsyncClient, lat: float, lon: float, name: str
) -> dict[str, str]:
    out: dict[str, str] = {"image_url": "", "description": "", "wikipedia_url": ""}
    try:
        resp = await client.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "generator": "geosearch",
                "ggscoord": f"{lat}|{lon}",
                "ggsradius": 500,
                "ggslimit": 8,
                "prop": "pageimages|description|info",
                "inprop": "url",
                "piprop": "thumbnail",
                "pithumbsize": 800,
                "format": "json",
            },
            headers={"User-Agent": USER_AGENT},
        )
        if resp.status_code != 200:
            return out

        pages = resp.json().get("query", {}).get("pages", {})
        if not isinstance(pages, dict) or not pages:
            return out

        target = _normalize_title(name)
        best: dict[str, Any] | None = None
        best_score = -1
        for page in pages.values():
            if not isinstance(page, dict):
                continue
            title = str(page.get("title") or "")
            score = 0
            norm = _normalize_title(title)
            if target and (target in norm or norm in target):
                score += 10
            if name and name.lower() in title.lower():
                score += 5
            if score > best_score:
                best_score = score
                best = page

        if best is None:
            best = next(iter(pages.values()))

        title = str(best.get("title") or "")
        thumb = best.get("thumbnail") if isinstance(best.get("thumbnail"), dict) else {}
        out["image_url"] = str(thumb.get("source") or "")
        out["description"] = str(best.get("description") or "").strip()
        canonical = str(best.get("canonicalurl") or "")
        if canonical:
            out["wikipedia_url"] = canonical
        elif title:
            out["wikipedia_url"] = f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"
    except Exception as exc:
        logger.warning("Wikipedia geosearch failed: %s", exc)
    return out


async def _wikipedia_by_name(client: httpx.AsyncClient, name: str) -> dict[str, str]:
    out: dict[str, str] = {"image_url": "", "description": "", "wikipedia_url": ""}
    if not name.strip():
        return out
    try:
        safe = quote(name.replace(" ", "_"))
        resp = await client.get(
            f"https://en.wikipedia.org/api/rest_v1/page/summary/{safe}",
            headers={"User-Agent": USER_AGENT},
        )
        if resp.status_code != 200:
            search = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": name,
                    "srlimit": 1,
                    "format": "json",
                },
                headers={"User-Agent": USER_AGENT},
            )
            if search.status_code != 200:
                return out
            hits = search.json().get("query", {}).get("search", [])
            if not hits:
                return out
            title = hits[0]["title"]
            resp = await client.get(
                f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(title.replace(' ', '_'))}",
                headers={"User-Agent": USER_AGENT},
            )
        if resp.status_code == 200:
            data = resp.json()
            thumb = data.get("thumbnail") if isinstance(data.get("thumbnail"), dict) else {}
            out["image_url"] = str(thumb.get("source") or "")
            out["description"] = str(data.get("extract") or "").strip()
            out["wikipedia_url"] = str(data.get("content_urls", {}).get("desktop", {}).get("page") or "")
    except Exception as exc:
        logger.warning("Wikipedia name lookup failed: %s", exc)
    return out


async def _driving_route(
    client: httpx.AsyncClient,
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
) -> dict[str, Any] | None:
    try:
        url = f"{OSRM_BASE}/{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
        resp = await client.get(
            url,
            params={"overview": "full", "geometries": "geojson", "steps": "false"},
            headers={"User-Agent": USER_AGENT},
        )
        if resp.status_code != 200:
            return None
        payload = resp.json()
        routes = payload.get("routes") if isinstance(payload, dict) else None
        if not routes:
            return None
        route = routes[0]
        geometry = route.get("geometry") if isinstance(route, dict) else None
        coords = geometry.get("coordinates") if isinstance(geometry, dict) else None
        if not coords:
            return None
        distance_m = float(route.get("distance") or 0)
        duration_s = float(route.get("duration") or 0)
        return {
            "distance_miles": round(distance_m / 1609.34, 1),
            "duration_minutes": max(1, round(duration_s / 60)),
            "polyline": [[float(c[1]), float(c[0])] for c in coords if len(c) >= 2],
        }
    except Exception as exc:
        logger.warning("OSRM route failed: %s", exc)
        return None


def _load_row(db: Session, event_id: str) -> ExploreContent | None:
    return (
        db.query(ExploreContent)
        .filter(ExploreContent.event_id == event_id)
        .first()
    )


def _read_cached_enrichment(row: ExploreContent | None) -> dict[str, Any] | None:
    if not row or not row.data:
        return None
    data = row.data if isinstance(row.data, dict) else {}
    enrichment = data.get("enrichment")
    if _is_fresh(enrichment if isinstance(enrichment, dict) else None):
        return enrichment  # type: ignore[return-value]
    return None


def _persist_enrichment(db: Session, row: ExploreContent | None, enrichment: dict[str, Any]) -> None:
    if not row:
        return
    data = dict(row.data) if isinstance(row.data, dict) else {}
    data["enrichment"] = enrichment
    row.data = data
    if enrichment.get("formatted_address") and (not row.city or row.city == "Unknown"):
        if enrichment.get("city"):
            row.city = enrichment["city"][:100]
    if enrichment.get("state") and not row.state:
        row.state = enrichment["state"][:50]
    if enrichment.get("image_url") and not row.image_url:
        row.image_url = enrichment["image_url"]
    db.commit()


async def enrich_place(
    db: Session,
    *,
    event_id: str,
    lat: float,
    lon: float,
    name: str = "",
    origin_lat: float | None = None,
    origin_lon: float | None = None,
    include_route: bool = True,
) -> dict[str, Any]:
    """
    Enrich a single selected place. Uses DB cache when fresh; otherwise calls free APIs once.
    """
    row = _load_row(db, event_id)
    cached = _read_cached_enrichment(row)
    needs_route = (
        include_route
        and origin_lat is not None
        and origin_lon is not None
        and (not cached or not cached.get("route"))
    )

    if cached and not needs_route:
        return {**cached, "cached": True, "event_id": event_id}

    enrichment: dict[str, Any] = dict(cached) if cached else {}
    enrichment["fetched_at"] = _now_utc().isoformat()
    enrichment["event_id"] = event_id

    async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
        if not enrichment.get("formatted_address"):
            geo = await _reverse_geocode(client, lat, lon)
            enrichment.update({k: v for k, v in geo.items() if v})

        if not enrichment.get("image_url"):
            wiki = await _wikipedia_by_coords(client, lat, lon, name)
            if not wiki.get("image_url"):
                wiki = await _wikipedia_by_name(client, name)
            for key in ("image_url", "description", "wikipedia_url"):
                if wiki.get(key):
                    enrichment[key] = wiki[key]

        if needs_route:
            route = await _driving_route(client, origin_lat, origin_lon, lat, lon)
            if route:
                enrichment["route"] = route

    enrichment["cached"] = bool(cached)
    _persist_enrichment(db, row, enrichment)
    return enrichment
