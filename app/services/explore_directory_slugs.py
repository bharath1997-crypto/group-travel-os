"""Slug rules shared with Scaper event city_slug (explore_scaper_events.city_slug)."""
from __future__ import annotations


def directory_city_slug(locality: str) -> str:
    """'Chicago, IL' -> 'chicago'; 'New York' -> 'new-york'."""
    return "-".join(locality.split(",")[0].strip().lower().split())


def directory_state_slug(state_name: str) -> str:
    """'Illinois' -> 'illinois'; 'New York' -> 'new-york'."""
    return "-".join(state_name.strip().lower().split())
