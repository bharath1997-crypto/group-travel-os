"""
Apify optional enrichment stub.

Requires a deployed actor URL and payload shape tailored to Travello use cases.
Extend ACTOR_IDS / run_input when ready.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerResultItem
from app.services.explorer_normalize import make_item
from config import settings

logger = logging.getLogger(__name__)


def search_apify(location: str, query: str, limit: int = 10) -> list[ExplorerResultItem]:
    token = (settings.apify_token or "").strip()
    if not token:
        return []

    actor_id = (settings.apify_explorer_actor_id or "").strip()
    if not actor_id:
        return []

    payload: dict[str, Any] = {
        "location": location,
        "query": query,
        "maxResults": min(limit, 50),
    }
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.post(
                f"https://api.apify.com/v2/acts/{actor_id}/runs",
                params={"token": token, "waitForFinish": "45"},
                json=payload,
            )
            if r.status_code != 201:
                logger.warning("Apify run HTTP %s", r.status_code)
                return []
            run_info = r.json().get("data", {})
            dataset_id = run_info.get("defaultDatasetId")
            if not dataset_id:
                return []
            dr = client.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                params={"token": token, "clean": 1},
            )
            rows = dr.json() if dr.status_code == 200 else []
    except Exception as exc:
        logger.warning("Apify enrichment failed: %s", exc)
        return []

    out: list[ExplorerResultItem] = []
    for index, row in enumerate(rows[:limit]):
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or row.get("name") or "Result")
        out.append(
            make_item(
                source="apify",
                type_="place",
                title=title[:200],
                description=str(row.get("description") or row.get("snippet") or "")[:500] or None,
                image_url=str(row.get("image_url") or row.get("thumbnail") or "") or None,
                external_url=str(row.get("url") or row.get("external_url") or "") or None,
                latitude=None,
                longitude=None,
                price=None,
                item_id=f"apify-{index}",
                venue=str(row.get("venue") or row.get("address") or location),
                city=location,
            ),
        )
    return out
