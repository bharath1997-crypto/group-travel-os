import httpx
import logging
import urllib.parse
import time
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Simple TTL Cache
_wiki_cache: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL = 86400  # 24 hours
MAX_CACHE_SIZE = 1000

def _get_from_cache(key: str) -> Any:
    if key in _wiki_cache:
        timestamp, value = _wiki_cache[key]
        if time.time() - timestamp < CACHE_TTL:
            return value
        else:
            del _wiki_cache[key]
    return None

def _set_to_cache(key: str, value: Any) -> None:
    if len(_wiki_cache) >= MAX_CACHE_SIZE:
        # crude eviction: clear cache when it gets too full to prevent memory leak
        _wiki_cache.clear()
    _wiki_cache[key] = (time.time(), value)

class PlaceWikipediaService:
    ELIGIBLE_CATEGORIES = {
        "Landmark", "Attraction", "Museum", "Park", "Historic site",
        "Airport", "University", "Church / Place of worship", "Stadium", "Monument"
    }

    @classmethod
    async def get_wiki_summary(
        cls,
        name: str,
        category: str,
        lat: float,
        lng: float,
        wikidata_id: str | None = None,
        wikipedia_title: str | None = None,
    ) -> dict:
        if not name or name.lower() == "dropped pin" or category == "Address":
            return {"available": False}
        
        is_eligible = (
            wikidata_id is not None or
            wikipedia_title is not None or
            category in cls.ELIGIBLE_CATEGORIES
        )
        if not is_eligible:
            return {"available": False}

        cache_key = wikidata_id if wikidata_id else f"{name.lower().strip()}_{lat}_{lng}_{category}"
        cached_result = _get_from_cache(cache_key)
        if cached_result is not None:
            return cached_result

        result = {"available": False}
        headers = {"User-Agent": "Rovvy/1.0 (https://rovvy.app; backend@rovvy.app)"}

        try:
            title_to_query = None

            if wikipedia_title:
                # Handle prefixes like "en:Niagara Falls"
                if ":" in wikipedia_title:
                    parts = wikipedia_title.split(":", 1)
                    if len(parts[0]) <= 3:  # rough check for lang code
                        title_to_query = parts[1]
                    else:
                        title_to_query = wikipedia_title
                else:
                    title_to_query = wikipedia_title
            
            async with httpx.AsyncClient() as client:
                if not title_to_query:
                    # Search for the best match using Wikipedia Action API
                    search_url = "https://en.wikipedia.org/w/api.php"
                    params = {
                        "action": "query",
                        "list": "search",
                        "srsearch": name,
                        "utf8": 1,
                        "format": "json",
                        "srlimit": 1
                    }
                    search_resp = await client.get(search_url, params=params, headers=headers, timeout=4.0)
                    search_resp.raise_for_status()
                    search_data = search_resp.json()
                    search_results = search_data.get("query", {}).get("search", [])
                    if search_results:
                        title_to_query = search_results[0]["title"]
                    else:
                        _set_to_cache(cache_key, {"available": False})
                        return {"available": False}

                # Fetch summary from REST API
                encoded_title = urllib.parse.quote(title_to_query.replace(" ", "_"))
                url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_title}"
                resp = await client.get(url, headers=headers, timeout=4.0)
                
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("type") != "disambiguation" and "extract" in data:
                        result = {
                            "available": True,
                            "title": data.get("title"),
                            "summary": data.get("extract"),
                            "source": "wikipedia",
                            "url": data.get("content_urls", {}).get("desktop", {}).get("page"),
                            "thumbnailUrl": None, # TODO: Add Wikimedia Commons image support
                            "attribution": "Wikipedia"
                        }
                        _set_to_cache(cache_key, result)
                        return result
                        
        except Exception as e:
            logger.warning(f"Wikipedia lookup failed for {name}: {e}")

        _set_to_cache(cache_key, result)
        return result
