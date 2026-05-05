"""Google Places Text Search (legacy Places API HTTP)."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerResultItem
from app.services.explorer_normalize import make_item, safe_id
from config import settings

logger = logging.getLogger(__name__)


def search_google_places_native(location: str, query: str, limit: int = 12) -> list[ExplorerResultItem]:
    key = (settings.google_places_api_key or "").strip()
    if not key:
        return []
    location = location.strip() or "Chicago"
    text = f"{query} {location}".strip()
    params: dict[str, Any] = {
        "query": text,
        "key": key,
        "language": "en",
    }
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(
                "https://maps.googleapis.com/maps/api/place/textsearch/json",
                params=params,
            )
        if r.status_code != 200:
            return []
        payload = r.json()
        if payload.get("status") not in {"OK", "ZERO_RESULTS"}:
            logger.warning("Google Places status %s", payload.get("status"))
            return []
        results = payload.get("results", []) or []
    except Exception as exc:
        logger.warning("Google Places search failed: %s", exc)
        return []

    out: list[ExplorerResultItem] = []
    for index, row in enumerate(results[:limit]):
        if not isinstance(row, dict):
            continue
        pid = str(row.get("place_id", "") or index)
        name = str(row.get("name", "") or "")
        formatted = str(row.get("formatted_address", "") or "")
        types = row.get("types", [])
        type_hint = ""
        if isinstance(types, list) and types:
            type_hint = str(types[0]).replace("_", " ")
        loc = row.get("geometry", {}).get("location", {}) if isinstance(row.get("geometry"), dict) else {}
        lat = loc.get("lat")
        lng = loc.get("lng")
        try:
            latitude = float(lat) if lat is not None else None
            longitude = float(lng) if lng is not None else None
        except (TypeError, ValueError):
            latitude = longitude = None

        rating = row.get("rating")
        uc = row.get("user_ratings_total")
        bits = []
        if type_hint:
            bits.append(type_hint.title())
        if rating is not None:
            bits.append(f"★ {rating}" + (f" ({uc} reviews)" if uc else ""))
        desc = " · ".join(bits) if bits else None

        photo_ref = ""
        photos = row.get("photos", [])
        if isinstance(photos, list) and photos and isinstance(photos[0], dict):
            photo_ref = str(photos[0].get("photo_reference", "") or "")
        image_url = ""
        if photo_ref and key:
            image_url = (
                "https://maps.googleapis.com/maps/api/place/photo"
                f"?maxwidth=640&photoreference={photo_ref}&key={key}"
            )

        maps_url = f"https://www.google.com/maps/search/?api=1&query=Google+{name}&query_place_id={pid}"

        out.append(
            make_item(
                source="google_places",
                type_="place",
                title=name,
                description=desc,
                image_url=image_url or None,
                external_url=maps_url,
                latitude=latitude,
                longitude=longitude,
                price=None,
                item_id=safe_id("gp", pid, index),
                venue=formatted or location,
                city=location,
            ),
        )
    return out
