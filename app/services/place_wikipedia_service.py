import logging
import time
import urllib.parse
from typing import Any

import httpx

logger = logging.getLogger(__name__)

WIKI_HEADERS = {"User-Agent": "Rovvy/1.0 (https://rovvy.app; backend@rovvy.app)"}
WIKI_SEARCH_URL = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary"

_STREET_NAME_MARKERS = (
    " avenue",
    " ave",
    " street",
    " st ",
    " road",
    " rd ",
    " boulevard",
    " blvd",
    " drive",
    " dr ",
    " lane",
    " way",
    " court",
    " ct ",
    " highway",
    " hwy",
    " circle",
    " terrace",
    " parkway",
    " pkway",
    " place",
    " trail",
    " route",
)

_ADDRESS_CATEGORIES = {"Address", "Coordinates", "Place"}

_wiki_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 86400  # 24 hours — in-memory only, not stored in Postgres
MAX_CACHE_SIZE = 1000


def _get_from_cache(key: str) -> Any:
    if key in _wiki_cache:
        timestamp, value = _wiki_cache[key]
        if time.time() - timestamp < CACHE_TTL:
            return value
        del _wiki_cache[key]
    return None


def _set_to_cache(key: str, value: Any) -> None:
    if len(_wiki_cache) >= MAX_CACHE_SIZE:
        _wiki_cache.clear()
    _wiki_cache[key] = (time.time(), value)


def _normalize_wikipedia_title(raw: str) -> str:
    if ":" in raw:
        lang, title = raw.split(":", 1)
        if len(lang) <= 3:
            return title
    return raw


def _is_street_like_name(name: str) -> bool:
    lower = f" {name.lower().strip()} "
    if not lower.strip():
        return False
    if name.strip()[0].isdigit():
        return True
    return any(marker in lower for marker in _STREET_NAME_MARKERS)


def _should_prefer_geo_lookup(
    *,
    name: str,
    category: str,
    source: str | None,
) -> bool:
    if category in _ADDRESS_CATEGORIES:
        return True
    if source in {"map_pick", "map_click", "nominatim", "search"}:
        return True
    return _is_street_like_name(name)


def _build_summary_result(data: dict[str, Any], matched_on: str) -> dict[str, Any]:
    return {
        "available": True,
        "title": data.get("title"),
        "summary": data.get("extract"),
        "source": "wikipedia",
        "url": data.get("content_urls", {}).get("desktop", {}).get("page"),
        "thumbnailUrl": (data.get("thumbnail") or {}).get("source"),
        "attribution": "Wikipedia",
        "matchedOn": matched_on,
    }


async def _search_title(client: httpx.AsyncClient, query: str) -> str | None:
    if not query.strip():
        return None
    resp = await client.get(
        WIKI_SEARCH_URL,
        params={
            "action": "query",
            "list": "search",
            "srsearch": query.strip(),
            "utf8": 1,
            "format": "json",
            "srlimit": 1,
        },
        headers=WIKI_HEADERS,
        timeout=4.0,
    )
    resp.raise_for_status()
    hits = resp.json().get("query", {}).get("search", [])
    if not hits:
        return None
    return str(hits[0].get("title") or "") or None


async def _geosearch_nearby_titles(
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
    *,
    radius_m: int = 15000,
    limit: int = 12,
) -> set[str]:
    resp = await client.get(
        WIKI_SEARCH_URL,
        params={
            "action": "query",
            "generator": "geosearch",
            "ggscoord": f"{lat}|{lng}",
            "ggsradius": radius_m,
            "ggslimit": limit,
            "prop": "info",
            "inprop": "url",
            "format": "json",
        },
        headers=WIKI_HEADERS,
        timeout=4.0,
    )
    if resp.status_code != 200:
        return set()

    pages = resp.json().get("query", {}).get("pages", {})
    if not isinstance(pages, dict):
        return set()

    titles: set[str] = set()
    for page in pages.values():
        if not isinstance(page, dict):
            continue
        title = str(page.get("title") or "").strip().lower()
        if title:
            titles.add(title)
    return titles


async def _geosearch_title(
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
    *,
    radius_m: int = 10000,
    name_hint: str | None = None,
) -> str | None:
    resp = await client.get(
        WIKI_SEARCH_URL,
        params={
            "action": "query",
            "generator": "geosearch",
            "ggscoord": f"{lat}|{lng}",
            "ggsradius": radius_m,
            "ggslimit": 8,
            "prop": "info",
            "inprop": "url",
            "format": "json",
        },
        headers=WIKI_HEADERS,
        timeout=4.0,
    )
    if resp.status_code != 200:
        return None

    pages = resp.json().get("query", {}).get("pages", {})
    if not isinstance(pages, dict) or not pages:
        return None

    hint = (name_hint or "").lower().strip()
    best_title: str | None = None
    best_score = -1
    for page in pages.values():
        if not isinstance(page, dict):
            continue
        title = str(page.get("title") or "")
        if not title:
            continue
        score = 0
        lower = title.lower()
        if hint and hint in lower:
            score += 10
        if score > best_score:
            best_score = score
            best_title = title

    if best_title:
        return best_title
    first = next(iter(pages.values()))
    return str(first.get("title") or "") or None


async def _fetch_summary(client: httpx.AsyncClient, title: str) -> dict[str, Any] | None:
    encoded = urllib.parse.quote(title.replace(" ", "_"))
    resp = await client.get(
        f"{WIKI_SUMMARY_URL}/{encoded}",
        headers=WIKI_HEADERS,
        timeout=4.0,
    )
    if resp.status_code != 200:
        return None
    data = resp.json()
    if data.get("type") == "disambiguation" or "extract" not in data:
        return None
    return data


class PlaceWikipediaService:
    ELIGIBLE_CATEGORIES = {
        "Landmark",
        "Attraction",
        "Museum",
        "Park",
        "Historic site",
        "Airport",
        "University",
        "Church / Place of worship",
        "Stadium",
        "Monument",
        "Village",
        "Town",
        "City",
        "Hamlet",
        "Location",
    }

    @classmethod
    def _is_lookup_eligible(
        cls,
        *,
        name: str,
        category: str,
        source: str | None,
        wikidata_id: str | None,
        wikipedia_title: str | None,
        city: str | None,
    ) -> bool:
        if not name or name.lower() in {"dropped pin", "selected coordinates"}:
            return bool(city or wikipedia_title or wikidata_id)
        if source in {"map_pick", "map_click"}:
            return True
        if wikidata_id or wikipedia_title:
            return True
        if category in cls.ELIGIBLE_CATEGORIES:
            return True
        if city and category in {"Address", "Coordinates", "Location", "Place"}:
            return True
        return False

    @classmethod
    def _lookup_candidates(
        cls,
        *,
        name: str,
        city: str | None,
        state: str | None,
        country: str | None,
        wikipedia_title: str | None,
    ) -> list[tuple[str, str]]:
        candidates: list[tuple[str, str]] = []

        if wikipedia_title:
            candidates.append(("place", _normalize_wikipedia_title(wikipedia_title)))

        if name and name.lower() not in {"dropped pin", "selected coordinates", "selected location"}:
            if not _is_street_like_name(name):
                candidates.append(("place", name))

        if city:
            candidates.append(("city", city))
            if state:
                candidates.append(("city", f"{city}, {state}"))
            if country:
                candidates.append(("region", f"{city}, {country}"))

        if state and state.lower() not in {(city or "").lower()}:
            candidates.append(("region", f"{state}, {country}" if country else state))

        deduped: list[tuple[str, str]] = []
        seen: set[str] = set()
        for matched_on, query in candidates:
            key = query.lower().strip()
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append((matched_on, query))
        return deduped

    @classmethod
    async def get_wiki_summary(
        cls,
        name: str,
        category: str,
        lat: float,
        lng: float,
        wikidata_id: str | None = None,
        wikipedia_title: str | None = None,
        city: str | None = None,
        state: str | None = None,
        country: str | None = None,
        source: str | None = None,
    ) -> dict[str, Any]:
        if not cls._is_lookup_eligible(
            name=name,
            category=category,
            source=source,
            wikidata_id=wikidata_id,
            wikipedia_title=wikipedia_title,
            city=city,
        ):
            return {"available": False}

        cache_key = "|".join(
            [
                wikidata_id or "",
                name.lower().strip(),
                f"{lat:.4f}",
                f"{lng:.4f}",
                category,
                (city or "").lower(),
                (state or "").lower(),
                (source or "").lower(),
            ]
        )
        cached_result = _get_from_cache(cache_key)
        if cached_result is not None:
            return cached_result

        result: dict[str, Any] = {"available": False}

        try:
            async with httpx.AsyncClient() as client:
                if wikipedia_title:
                    direct = await _fetch_summary(
                        client,
                        _normalize_wikipedia_title(wikipedia_title),
                    )
                    if direct:
                        result = _build_summary_result(direct, "place")
                        _set_to_cache(cache_key, result)
                        return result

                prefer_geo = _should_prefer_geo_lookup(
                    name=name,
                    category=category,
                    source=source,
                )
                nearby_titles: set[str] | None = None

                async def ensure_nearby_titles() -> set[str]:
                    nonlocal nearby_titles
                    if nearby_titles is None:
                        nearby_titles = await _geosearch_nearby_titles(client, lat, lng)
                    return nearby_titles

                if prefer_geo:
                    geo_title = await _geosearch_title(
                        client,
                        lat,
                        lng,
                        name_hint=city or state,
                    )
                    if geo_title:
                        summary = await _fetch_summary(client, geo_title)
                        if summary:
                            result = _build_summary_result(summary, "nearby")
                            _set_to_cache(cache_key, result)
                            return result

                for matched_on, query in cls._lookup_candidates(
                    name=name,
                    city=city,
                    state=state,
                    country=country,
                    wikipedia_title=None,
                ):
                    title = await _search_title(client, query)
                    if not title:
                        continue
                    if prefer_geo and matched_on == "place":
                        local_titles = await ensure_nearby_titles()
                        if title.strip().lower() not in local_titles:
                            continue
                    summary = await _fetch_summary(client, title)
                    if summary:
                        result = _build_summary_result(summary, matched_on)
                        _set_to_cache(cache_key, result)
                        return result

                if not prefer_geo:
                    geo_title = await _geosearch_title(
                        client,
                        lat,
                        lng,
                        name_hint=city or name,
                    )
                    if geo_title:
                        summary = await _fetch_summary(client, geo_title)
                        if summary:
                            result = _build_summary_result(summary, "nearby")
                            _set_to_cache(cache_key, result)
                            return result
        except Exception as exc:
            logger.warning("Wikipedia lookup failed for %s: %s", name, exc)

        _set_to_cache(cache_key, result)
        return result
