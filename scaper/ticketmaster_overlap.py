"""Disable geo Ticketmaster city sources when a state-wide source covers the same state."""

from __future__ import annotations

# Known live geo sources → US state (extend when adding city-radius Ticketmaster sources).
TICKETMASTER_CITY_SOURCE_STATES: dict[str, str] = {
    "chicago": "IL",
    "orlando": "FL",
}


def city_slugs_for_state(state_code: str) -> list[str]:
    code = state_code.strip().upper()
    return [slug for slug, st in TICKETMASTER_CITY_SOURCE_STATES.items() if st == code]
