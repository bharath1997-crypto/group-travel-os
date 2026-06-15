"""Foursquare Places API auth helpers."""
from __future__ import annotations

import logging

from config import settings

logger = logging.getLogger(__name__)

FOURSQUARE_PLACES_URL = "https://places-api.foursquare.com/places/search"
FOURSQUARE_API_VERSION = "2025-06-17"


def normalize_foursquare_api_key(raw: str | None = None) -> str:
    """
    Return the raw Foursquare service key.

    Unquoted .env values can corrupt ``+`` into spaces (form-urlencoded parsing).
    """
    key = (raw if raw is not None else settings.foursquare_api_key or "").strip()
    if not key:
        return ""

    if (key.startswith('"') and key.endswith('"')) or (
        key.startswith("'") and key.endswith("'")
    ):
        key = key[1:-1].strip()

    if key.lower().startswith("bearer "):
        key = key[7:].strip()

    if " " in key and "+" not in key:
        logger.warning(
            "FOURSQUARE_API_KEY contains spaces where '+' may have been corrupted; repairing"
        )
        key = key.replace(" ", "+")

    return key


def foursquare_headers(api_key: str | None = None) -> dict[str, str]:
    key = normalize_foursquare_api_key(api_key)
    return {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "X-Places-Api-Version": FOURSQUARE_API_VERSION,
    }
