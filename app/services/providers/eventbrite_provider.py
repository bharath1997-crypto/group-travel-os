"""Eventbrite REST API — public event search."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerResultItem
from app.services.explorer_normalize import make_item
from config import settings

logger = logging.getLogger(__name__)


def search_eventbrite(location: str, query: str, limit: int = 12) -> list[ExplorerResultItem]:
    token = (settings.eventbrite_token or "").strip()
    if not token:
        return []
    location = location.strip() or "Chicago"
    headers = {"Authorization": f"Bearer {token}"}
    params: dict[str, Any] = {
        "q": query or "things to do",
        "location.address": location,
        "location.within": "40km",
        "expand": "venue",
        "page_size": min(limit, 50),
        "sort_by": "date",
    }
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(
                "https://www.eventbriteapi.com/v3/events/search/",
                headers=headers,
                params=params,
            )
        if r.status_code != 200:
            logger.warning("Eventbrite HTTP %s", r.status_code)
            return []
        events = r.json().get("events", []) or []
    except Exception as exc:
        logger.warning("Eventbrite search failed: %s", exc)
        return []

    out: list[ExplorerResultItem] = []
    for index, ev in enumerate(events[:limit]):
        if not isinstance(ev, dict):
            continue
        eid = str(ev.get("id", "") or index)
        name = str(ev.get("name", {}).get("text", "") if isinstance(ev.get("name"), dict) else ev.get("name", ""))
        desc_html = ev.get("description", {})
        desc = ""
        if isinstance(desc_html, dict):
            desc = str(desc_html.get("text", "") or "")[:800]
        url = str(ev.get("url", "") or "")
        start = ev.get("start", {}) if isinstance(ev.get("start"), dict) else {}
        date_str = str(start.get("local", "") or start.get("utc", "") or "")

        image_url = ""
        logo = ev.get("logo", {})
        if isinstance(logo, dict) and isinstance(logo.get("original"), dict):
            image_url = str(logo["original"].get("url", "") or "")
        elif isinstance(logo, dict) and logo.get("url"):
            image_url = str(logo["url"])

        lat = lon = None
        venue_name = ""
        venue = ev.get("venue")
        if isinstance(venue, dict):
            venue_name = str(venue.get("name", "") or "")
            la = venue.get("latitude")
            lo = venue.get("longitude")
            try:
                if la is not None and lo is not None:
                    lat = float(la)
                    lon = float(lo)
            except (TypeError, ValueError):
                pass
            addr = venue.get("address", {})
            if isinstance(addr, dict):
                line = ", ".join(
                    str(x)
                    for x in (addr.get("address_1"), addr.get("city"), addr.get("region"))
                    if x
                )
                if line:
                    venue_name = venue_name + (" · " if venue_name else "") + line

        is_free = bool(ev.get("is_free"))

        out.append(
            make_item(
                source="eventbrite",
                type_="event",
                title=name or "Event",
                description=desc or None,
                image_url=image_url or None,
                external_url=url or None,
                latitude=lat,
                longitude=lon,
                price=0.0 if is_free else None,
                item_id=f"eb-{eid}-{index}",
                venue=venue_name or location,
                city=location,
                date_str=date_str,
                is_free=is_free,
            ),
        )
    return out
