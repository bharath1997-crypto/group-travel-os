"""Ticketmaster Discovery API — events."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerResultItem
from app.services.explorer_normalize import make_item, safe_id
from config import settings

logger = logging.getLogger(__name__)


def search_ticketmaster(location: str, query: str, limit: int = 12) -> list[ExplorerResultItem]:
    key = (settings.ticketmaster_api_key or "").strip()
    if not key:
        return []
    location = location.strip() or "Chicago"
    query = query.strip()
    params: dict[str, Any] = {
        "apikey": key,
        "keyword": f"{query} {location}".strip(),
        "city": location,
        "size": min(limit, 50),
        "countryCode": "US",
        "sort": "date,asc",
    }
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(
                "https://app.ticketmaster.com/discovery/v2/events.json",
                params=params,
            )
        if r.status_code != 200:
            logger.warning("Ticketmaster HTTP %s: %s", r.status_code, r.text[:200])
            return []
        data = r.json()
        events = data.get("_embedded", {}).get("events", []) or []
    except Exception as exc:
        logger.warning("Ticketmaster search failed: %s", exc)
        return []

    out: list[ExplorerResultItem] = []
    for index, ev in enumerate(events):
        if not isinstance(ev, dict):
            continue
        name = str(ev.get("name", "") or "")
        tid = str(ev.get("id", "") or index)
        url = ""
        if isinstance(ev.get("url"), str):
            url = ev["url"]
        images = ev.get("images", [])
        image_url = ""
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, dict) and first.get("url"):
                image_url = str(first["url"])
        desc = ""
        if isinstance(ev.get("info"), str):
            desc = ev["info"]
        elif isinstance(ev.get("pleaseNote"), str):
            desc = ev["pleaseNote"]
        dates = ev.get("dates", {}) if isinstance(ev.get("dates"), dict) else {}
        start = dates.get("start", {}) if isinstance(dates.get("start"), dict) else {}
        date_str = str(start.get("localDate", "") or start.get("dateTime", "") or "")

        lat: float | None = None
        lon: float | None = None
        venue_name = ""
        emb = ev.get("_embedded", {})
        if isinstance(emb, dict):
            venues = emb.get("venues", [])
            if isinstance(venues, list) and venues and isinstance(venues[0], dict):
                v0 = venues[0]
                venue_name = str(v0.get("name", "") or "")
                loc = v0.get("location", {})
                if isinstance(loc, dict):
                    la = loc.get("latitude")
                    lo = loc.get("longitude")
                    try:
                        if la is not None and lo is not None:
                            lat = float(la)
                            lon = float(lo)
                    except (TypeError, ValueError):
                        pass

        price_min: float | None = None
        pr = ev.get("priceRanges", [])
        if isinstance(pr, list) and pr and isinstance(pr[0], dict):
            try:
                m = pr[0].get("min")
                if m is not None:
                    price_min = float(m)
            except (TypeError, ValueError):
                pass

        out.append(
            make_item(
                source="ticketmaster",
                type_="event",
                title=name,
                description=desc[:2000] if desc else None,
                image_url=image_url or None,
                external_url=url or None,
                latitude=lat,
                longitude=lon,
                price=price_min,
                item_id=safe_id("tm", tid, index),
                venue=venue_name or location,
                city=location,
                date_str=date_str,
                is_free=price_min is not None and price_min <= 0,
            ),
        )
    return out[:limit]
