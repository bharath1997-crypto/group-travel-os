"""
app/services/external/youtube_provider.py — YouTube API integration for Shorts.
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime
from typing import Any

import requests

logger = logging.getLogger(__name__)


def _city_tag_slug(city: str) -> str:
    """Lowercase alphanumeric slug for hashtags (e.g. 'New York' -> 'newyork')."""
    s = city.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s or "travel"


def _build_shorts_search_query(city: str, tag: str | None = None) -> str:
    """Query: {city} travel."""
    base = f"{city} travel"
    if tag:
        extra = tag.strip().lstrip("#")
        if extra:
            base = f"{base} {extra}"
    return base


def _video_id(item: dict[str, Any]) -> str | None:
    vid = (item.get("id") or {}).get("videoId") if isinstance(item.get("id"), dict) else item.get("videoId")
    return vid if isinstance(vid, str) and vid else None


def _search_shorts_all_pages(
    city: str,
    api_key: str,
    order: str,
    tag: str | None = None,
) -> list[dict[str, Any]]:
    """search.list with order (viewCount | date), maxResults=50 (single page)."""
    url = "https://www.googleapis.com/youtube/v3/search"
    params: dict[str, Any] = {
        "part": "snippet",
        "q": _build_shorts_search_query(city, tag),
        "videoDuration": "short",
        "type": "video",
        "videoCategoryId": "19",
        "order": order,
        "maxResults": 50,
        "key": api_key,
    }
    response = requests.get(url, params=params, timeout=15.0)
    response.raise_for_status()
    data = response.json()
    return data.get("items", [])


def _merge_statistics(items: list[dict[str, Any]], api_key: str) -> None:
    video_ids: list[str] = []
    for it in items:
        vid = _video_id(it)
        if vid:
            video_ids.append(vid)
    if not video_ids:
        return

    # de-duplicate preserving order
    seen: set[str] = set()
    unique_ids: list[str] = []
    for vid in video_ids:
        if vid not in seen:
            seen.add(vid)
            unique_ids.append(vid)

    stats_by_id: dict[str, dict[str, Any]] = {}
    for i in range(0, len(unique_ids), 50):
        batch = unique_ids[i : i + 50]
        vurl = "https://www.googleapis.com/youtube/v3/videos"
        vparams = {
            "part": "statistics,snippet",
            "id": ",".join(batch),
            "key": api_key,
        }
        vres = requests.get(vurl, params=vparams, timeout=15.0)
        vres.raise_for_status()
        vdata = vres.json()
        for row in vdata.get("items", []):
            rid = row.get("id")
            st = row.get("statistics")
            if isinstance(rid, str) and isinstance(st, dict):
                stats_by_id[rid] = st

    for it in items:
        vid = _video_id(it)
        if isinstance(vid, str) and vid in stats_by_id:
            it["statistics"] = stats_by_id[vid]


def _view_count(entry: dict[str, Any]) -> int:
    st = entry.get("statistics")
    if not isinstance(st, dict):
        return 0
    raw = st.get("viewCount")
    try:
        return int(raw) if raw is not None else 0
    except (TypeError, ValueError):
        return 0


def _published_ts(entry: dict[str, Any]) -> float:
    sn = entry.get("snippet")
    if not isinstance(sn, dict):
        return 0.0
    raw = sn.get("publishedAt")
    if not isinstance(raw, str):
        return 0.0
    try:
        # YouTube returns RFC3339
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
    except (ValueError, TypeError):
        return 0.0


class YouTubeProvider:
    def fetch_shorts(self, city: str, tag: str | None = None) -> dict[str, Any]:
        """
        Two-tier feed per city:
        - trending: search order=viewCount (paginated), enriched with statistics, sorted by views desc
        - recent: search order=date (paginated), enriched with statistics, sorted by publish date desc

        Optional ``tag`` appends an extra hashtag token to the search query.

        Stored as one JSONB: {"trending": [...], "recent": [...]}
        """
        api_key = os.getenv("YOUTUBE_API_KEY")
        empty: dict[str, Any] = {"trending": [], "recent": []}
        if not api_key:
            logger.warning("No YOUTUBE_API_KEY configured.")
            return empty

        tag_clean = tag.strip().lstrip("#") if tag else None
        tag_arg = tag_clean or None

        try:
            trending_items = _search_shorts_all_pages(
                city, api_key, "viewCount", tag_arg
            )
            recent_items = _search_shorts_all_pages(city, api_key, "date", tag_arg)

            combined = trending_items + recent_items
            _merge_statistics(combined, api_key)

            # Re-attach stats from merged items (merge writes into shared dict refs — combined already updated each dict)
            # trending_items and recent_items are subsets of the same objects as in combined
            trending_items.sort(key=_view_count, reverse=True)
            recent_items.sort(key=_published_ts, reverse=True)

            return {
                "trending": trending_items,
                "recent": recent_items,
            }
        except requests.exceptions.HTTPError as exc:
            logger.warning("Failed to fetch shorts from YouTube: %s - Response: %s", exc, exc.response.text)
            return empty
        except Exception as exc:
            logger.warning("Failed to fetch shorts from YouTube: %s", exc)
            return empty
