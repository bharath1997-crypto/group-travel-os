"""
Load Rovvy Live search taxonomy from data/live_search_taxonomy.json.
Single source of truth for category keywords, synonyms, and OSM nearby queries.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_TAXONOMY_PATH = Path(__file__).resolve().parents[2] / "data" / "live_search_taxonomy.json"


def _normalize(text: str) -> str:
    return " ".join(
        text.strip().lower().replace(",", " ").replace("-", " ").split()
    )


@lru_cache(maxsize=1)
def load_taxonomy() -> dict[str, Any]:
    if not _TAXONOMY_PATH.is_file():
        logger.warning("Live search taxonomy missing at %s", _TAXONOMY_PATH)
        return {"version": 0, "categories": [], "groups": []}
    with _TAXONOMY_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def list_categories() -> list[dict[str, Any]]:
    return list(load_taxonomy().get("categories") or [])


def get_category_by_key(key: str) -> dict[str, Any] | None:
    clean = key.strip().lower()
    for cat in list_categories():
        if cat.get("key") == clean:
            return cat
    return None


def resolve_category_from_query(query: str) -> dict[str, Any] | None:
    """Match user text to a taxonomy category (synonyms included)."""
    q = _normalize(query)
    if not q:
        return None

    for cat in list_categories():
        key = str(cat.get("key") or "")
        keywords = [str(k).lower() for k in cat.get("keywords") or []]
        if q == key or q in keywords:
            return cat
        if any(q == kw or q == f"{kw}s" for kw in keywords):
            return cat

    best: dict[str, Any] | None = None
    best_len = 0
    for cat in list_categories():
        keywords = [str(k).lower() for k in cat.get("keywords") or []]
        for kw in keywords:
            if len(kw) < 3:
                continue
            if kw in q and len(kw) > best_len:
                best = cat
                best_len = len(kw)
    return best


def is_exact_category_query(query: str) -> bool:
    q = _normalize(query)
    if not q:
        return False
    for cat in list_categories():
        key = str(cat.get("key") or "")
        keywords = [str(k).lower() for k in cat.get("keywords") or []]
        if q == key or q in keywords:
            return True
    return False


def category_keyword_map() -> dict[str, str]:
    """Map normalized keyword → category key (for autocomplete fast path)."""
    out: dict[str, str] = {}
    for cat in list_categories():
        key = str(cat.get("key") or "")
        if not key:
            continue
        out[key] = key
        for kw in cat.get("keywords") or []:
            out[str(kw).lower()] = key
    return out


def category_osm_queries() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for cat in list_categories():
        key = str(cat.get("key") or "")
        queries = cat.get("osm_queries") or []
        if key and queries:
            out[key] = list(queries)
    return out


def taxonomy_for_api() -> dict[str, Any]:
    data = load_taxonomy()
    return {
        "version": data.get("version", 0),
        "groups": data.get("groups") or [],
        "categories": [
            {
                "key": c.get("key"),
                "group": c.get("group"),
                "label": c.get("label"),
                "mapLabel": c.get("mapLabel"),
                "icon": c.get("icon"),
                "keywords": c.get("keywords") or [],
            }
            for c in list_categories()
        ],
    }
