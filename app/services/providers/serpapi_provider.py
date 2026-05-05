"""SerpAPI — Google Events + Google Local via existing serpapi_service."""
from __future__ import annotations

import logging
from typing import Any

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerResultItem
from app.services.explorer_normalize import make_item, safe_id
from app.services.serpapi_service import search_google_events, search_google_places

logger = logging.getLogger(__name__)


def _to_float(v: Any) -> float | None:
    try:
        if v is None:
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def search_serpapi_events(location: str, query: str, limit: int = 10) -> list[ExplorerResultItem]:
    try:
        rows = search_google_events(
            query=query,
            city=location,
            date_filter="this_month",
            timeout=API_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.warning("SerpAPI explorer events failed: %s", exc)
        return []
    out: list[ExplorerResultItem] = []
    for index, row in enumerate(rows[:limit]):
        if not isinstance(row, dict):
            continue
        pid = str(row.get("id", index))
        title = str(row.get("title", "") or "")
        desc = str(row.get("description", "") or "")
        out.append(
            make_item(
                source="serpapi",
                type_="event",
                title=title,
                description=desc or None,
                image_url=str(row.get("image_url", "") or "") or None,
                external_url=str(row.get("ticket_url", "") or row.get("source_url", "") or "") or None,
                latitude=None,
                longitude=None,
                price=_to_float(row.get("price_from")),
                item_id=safe_id("se", pid, index),
                venue=str(row.get("venue", "") or location),
                city=str(row.get("city", "") or location),
                date_str=str(row.get("date_str", "") or ""),
                is_free=bool(row.get("is_free")),
            ),
        )
    return out


def search_serpapi_places(location: str, query: str, limit: int = 10) -> list[ExplorerResultItem]:
    try:
        rows = search_google_places(
            query=query,
            city=location,
            timeout=API_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.warning("SerpAPI explorer places failed: %s", exc)
        return []
    out: list[ExplorerResultItem] = []
    for index, row in enumerate(rows[:limit]):
        if not isinstance(row, dict):
            continue
        pid = str(row.get("id", index))
        title = str(row.get("title", "") or "")
        desc = str(row.get("description", "") or "") or None
        out.append(
            make_item(
                source="serpapi",
                type_="place",
                title=title,
                description=desc,
                image_url=str(row.get("image_url", "") or "") or None,
                external_url=str(row.get("source_url", "") or "") or None,
                latitude=_to_float(row.get("latitude")),
                longitude=_to_float(row.get("longitude")),
                price=_to_float(row.get("price_from")),
                item_id=safe_id("spl", pid, index),
                venue=str(row.get("venue", "") or location),
                city=str(row.get("city", "") or location),
            ),
        )
    return out
