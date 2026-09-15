"""
app/services/place_name_translation_service.py — Latin display names for non-Latin place labels.

Uses transliteration (readable Latin spelling of the same name), not meaning translation.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.services.place_name_transliteration import is_mostly_latin, transliterate_to_latin

logger = logging.getLogger(__name__)

NOMINATIM_LOOKUP_URL = "https://nominatim.openstreetmap.org/lookup"
NOMINATIM_HEADERS = {
    "User-Agent": "Rovvy/1.0 contact@rovvy.app",
    "Accept-Language": "en",
}
HTTP_TIMEOUT_SECONDS = 8.0
CACHE_TTL_SECONDS = 86400
MAX_CACHE_ENTRIES = 500

_LANGUAGE_LABELS: dict[str, str] = {
    "ru": "Russian",
    "uk": "Ukrainian",
    "be": "Belarusian",
    "bg": "Bulgarian",
    "sr": "Serbian",
    "mk": "Macedonian",
    "ar": "Arabic",
    "he": "Hebrew",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "el": "Greek",
    "th": "Thai",
    "hi": "Hindi",
}

_COUNTRY_LANGUAGE: dict[str, str] = {
    "russia": "ru",
    "ukraine": "uk",
    "belarus": "be",
    "bulgaria": "bg",
    "serbia": "sr",
    "north macedonia": "mk",
    "macedonia": "mk",
    "greece": "el",
    "japan": "ja",
    "china": "zh",
    "south korea": "ko",
    "korea": "ko",
    "thailand": "th",
    "saudi arabia": "ar",
    "israel": "he",
    "india": "hi",
}

_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def clear_place_name_translation_cache_for_tests() -> None:
    _cache.clear()


def _cache_key(name: str, lat: float, lng: float, osm_type: str | None, osm_id: int | None) -> str:
    osm_part = f"{osm_type}:{osm_id}" if osm_type and osm_id is not None else ""
    return f"{round(lat, 5)},{round(lng, 5)}|{name.strip().lower()}|{osm_part}"


def _prune_cache() -> None:
    now = time.time()
    expired = [key for key, (expires_at, _) in _cache.items() if expires_at <= now]
    for key in expired:
        del _cache[key]
    overflow = len(_cache) - MAX_CACHE_ENTRIES
    if overflow <= 0:
        return
    oldest = sorted(_cache.keys(), key=lambda key: _cache[key][0])[:overflow]
    for key in oldest:
        del _cache[key]


def _script_counts(text: str) -> dict[str, int]:
    counts = {
        "cyrillic": 0,
        "arabic": 0,
        "hebrew": 0,
        "cjk": 0,
        "greek": 0,
        "devanagari": 0,
        "thai": 0,
    }
    for char in text:
        code = ord(char)
        if 0x0400 <= code <= 0x04FF:
            counts["cyrillic"] += 1
        elif 0x0600 <= code <= 0x06FF:
            counts["arabic"] += 1
        elif 0x0590 <= code <= 0x05FF:
            counts["hebrew"] += 1
        elif 0x4E00 <= code <= 0x9FFF or 0x3040 <= code <= 0x30FF or 0xAC00 <= code <= 0xD7AF:
            counts["cjk"] += 1
        elif 0x0370 <= code <= 0x03FF:
            counts["greek"] += 1
        elif 0x0900 <= code <= 0x097F:
            counts["devanagari"] += 1
        elif 0x0E00 <= code <= 0x0E7F:
            counts["thai"] += 1
    return counts


def detect_source_language(name: str, country: str | None = None) -> tuple[str, str] | None:
    cleaned = name.strip()
    if not cleaned or is_mostly_latin(cleaned):
        return None

    country_code = _COUNTRY_LANGUAGE.get((country or "").strip().lower())
    counts = _script_counts(cleaned)
    dominant = max(counts, key=counts.get)
    if counts[dominant] == 0:
        if country_code:
            return country_code, _LANGUAGE_LABELS.get(country_code, country_code.upper())
        return None

    script_to_lang = {
        "cyrillic": country_code if country_code in {"uk", "be", "bg", "sr", "mk"} else "ru",
        "arabic": "ar",
        "hebrew": "he",
        "cjk": country_code if country_code in {"ja", "ko", "zh"} else "zh",
        "greek": "el",
        "devanagari": "hi",
        "thai": "th",
    }
    code = script_to_lang.get(dominant, country_code)
    if not code:
        return None
    label = _LANGUAGE_LABELS.get(code, code.upper())
    return code, label


def _pick_latin_name_from_payload(payload: dict[str, Any]) -> str | None:
    """Prefer OSM Latin spellings — not English meaning translations (name:en)."""
    extratags = payload.get("extratags") or {}
    named_tags = payload.get("namedetails") or {}
    candidates = [
        extratags.get("name:latin"),
        named_tags.get("name:latin"),
        extratags.get("int_name"),
        named_tags.get("int_name"),
    ]
    for candidate in candidates:
        if isinstance(candidate, str) and candidate.strip() and is_mostly_latin(candidate):
            return candidate.strip()
    return None


class PlaceNameTranslationService:
    @staticmethod
    async def resolve_display_name(
        *,
        name: str,
        lat: float,
        lng: float,
        osm_type: str | None = None,
        osm_id: int | None = None,
        country: str | None = None,
    ) -> dict[str, Any]:
        original = name.strip()
        if not original:
            return {
                "displayName": original,
                "originalName": None,
                "sourceLanguageCode": None,
                "sourceLanguageLabel": None,
                "translated": False,
            }

        cache_key = _cache_key(original, lat, lng, osm_type, osm_id)
        now = time.time()
        cached = _cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        detected = detect_source_language(original, country)
        if not detected:
            result = {
                "displayName": original,
                "originalName": None,
                "sourceLanguageCode": None,
                "sourceLanguageLabel": None,
                "translated": False,
            }
            _cache[cache_key] = (now + CACHE_TTL_SECONDS, result)
            _prune_cache()
            return result

        source_code, source_label = detected
        latin_name = await PlaceNameTranslationService._lookup_latin_name(
            osm_type=osm_type,
            osm_id=osm_id,
            source_name=original,
        )

        transliterated = bool(
            latin_name
            and latin_name.strip().casefold() != original.casefold()
            and is_mostly_latin(latin_name)
        )
        result = {
            "displayName": latin_name if transliterated else original,
            "originalName": original if transliterated else None,
            "sourceLanguageCode": source_code if transliterated else None,
            "sourceLanguageLabel": source_label if transliterated else None,
            "translated": transliterated,
        }
        _cache[cache_key] = (now + CACHE_TTL_SECONDS, result)
        _prune_cache()
        return result

    @staticmethod
    async def _lookup_latin_name(
        *,
        osm_type: str | None,
        osm_id: int | None,
        source_name: str,
    ) -> str | None:
        from_osm = await PlaceNameTranslationService._lookup_osm_latin_name(osm_type, osm_id)
        if from_osm:
            return from_osm
        return transliterate_to_latin(source_name)

    @staticmethod
    async def _lookup_osm_latin_name(osm_type: str | None, osm_id: int | None) -> str | None:
        if not osm_type or osm_id is None:
            return None
        prefix = {"node": "N", "way": "W", "relation": "R"}.get(osm_type.strip().lower())
        if not prefix:
            return None
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    NOMINATIM_LOOKUP_URL,
                    params={
                        "osm_ids": f"{prefix}{int(osm_id)}",
                        "format": "json",
                        "extratags": 1,
                        "namedetails": 1,
                    },
                    headers=NOMINATIM_HEADERS,
                    timeout=HTTP_TIMEOUT_SECONDS,
                )
            if response.status_code != 200:
                return None
            data = response.json()
            if not isinstance(data, list) or not data:
                return None
            return _pick_latin_name_from_payload(data[0])
        except Exception as exc:
            logger.warning("Nominatim lookup for Latin name failed: %s", exc)
            return None
