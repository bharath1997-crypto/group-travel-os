"""YouTube Data API v3 — travel-related videos."""
from __future__ import annotations

import logging

import httpx

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerResultItem
from app.services.explorer_normalize import make_item
from config import settings

logger = logging.getLogger(__name__)


def search_youtube(location: str, query: str, limit: int = 8) -> list[ExplorerResultItem]:
    key = (settings.youtube_api_key or "").strip()
    if not key:
        return []
    location = location.strip() or "Chicago"
    q = f"{query} travel guide {location}".strip()
    params = {
        "part": "snippet",
        "type": "video",
        "maxResults": min(limit, 25),
        "q": q,
        "key": key,
    }
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get("https://www.googleapis.com/youtube/v3/search", params=params)
        if r.status_code != 200:
            logger.warning("YouTube HTTP %s", r.status_code)
            return []
        items = r.json().get("items", []) or []
    except Exception as exc:
        logger.warning("YouTube search failed: %s", exc)
        return []

    out: list[ExplorerResultItem] = []
    for index, row in enumerate(items):
        sid = ""
        snippet: dict[str, object] = {}
        if isinstance(row, dict):
            vid_block = row.get("id")
            if isinstance(vid_block, dict):
                sid = str(vid_block.get("videoId", "") or "")
            raw_sn = row.get("snippet")
            snippet = raw_sn if isinstance(raw_sn, dict) else {}
        title = str(snippet.get("title", "") or "Video")
        desc = str(snippet.get("description", "") or "")
        thumbs = snippet.get("thumbnails", {}) if isinstance(snippet.get("thumbnails"), dict) else {}
        image_url = ""
        for size in ("high", "medium", "default"):
            t = thumbs.get(size)
            if isinstance(t, dict) and t.get("url"):
                image_url = str(t["url"])
                break
        vid = sid or str(index)
        url = f"https://www.youtube.com/watch?v={vid}"
        chan = str(snippet.get("channelTitle", "") or "")

        out.append(
            make_item(
                source="youtube",
                type_="video",
                title=title[:200],
                description=(desc[:500] + ("…" if len(desc) > 500 else "")) or None,
                image_url=image_url or None,
                external_url=url,
                latitude=None,
                longitude=None,
                price=None,
                item_id=f"yt-{vid}-{index}",
                venue=chan,
                city=location,
                date_str=str(snippet.get("publishedAt", "") or "")[:16],
                emoji="▶️",
            ),
        )
    return out
