"""Yelp Fusion — businesses near a location."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerResultItem
from app.services.explorer_normalize import make_item, safe_id
from config import settings

logger = logging.getLogger(__name__)

YELP_URL = "https://api.yelp.com/v3/businesses/search"


def search_yelp(location: str, query: str, limit: int = 12) -> list[ExplorerResultItem]:
    key = (settings.yelp_api_key or "").strip()
    if not key:
        return []
    location = location.strip() or "Chicago"
    query = query.strip()
    headers = {"Authorization": f"Bearer {key}"}
    params: dict[str, Any] = {
        "term": query or "things to do",
        "location": location,
        "limit": min(limit, 50),
        "sort_by": "best_match",
    }
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(YELP_URL, headers=headers, params=params)
        if r.status_code != 200:
            logger.warning("Yelp HTTP %s", r.status_code)
            return []
        businesses = r.json().get("businesses", []) or []
    except Exception as exc:
        logger.warning("Yelp search failed: %s", exc)
        return []

    out: list[ExplorerResultItem] = []
    for index, b in enumerate(businesses):
        if not isinstance(b, dict):
            continue
        bid = str(b.get("id", "") or index)
        name = str(b.get("name", "") or "")
        url = str(b.get("url", "") or "")
        coords = b.get("coordinates", {}) if isinstance(b.get("coordinates"), dict) else {}
        lat = coords.get("latitude")
        lon = coords.get("longitude")
        try:
            latitude = float(lat) if lat is not None else None
            longitude = float(lon) if lon is not None else None
        except (TypeError, ValueError):
            latitude = longitude = None
        image_url = str(b.get("image_url", "") or "")
        locs = b.get("location", {}) if isinstance(b.get("location"), dict) else {}
        parts = [
            locs.get("address1"),
            locs.get("city"),
            locs.get("state"),
            locs.get("zip_code"),
        ]
        address = ", ".join(str(x) for x in parts if x)

        cats = b.get("categories", [])
        desc_parts = []
        if isinstance(cats, list):
            for c in cats[:3]:
                if isinstance(c, dict) and c.get("title"):
                    desc_parts.append(str(c["title"]))
        desc = "; ".join(desc_parts) if desc_parts else ""

        out.append(
            make_item(
                source="yelp",
                type_="place",
                title=name,
                description=desc or None,
                image_url=image_url or None,
                external_url=url or None,
                latitude=latitude,
                longitude=longitude,
                price=None,
                item_id=safe_id("yelp", bid, index),
                venue=address or location,
                city=str(locs.get("city") or location),
                date_str="",
            ),
        )
    return out[:limit]
