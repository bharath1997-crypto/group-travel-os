"""Shared city slug rules (matches app.services.explore_scaper_events.city_slug for locality names)."""


def locality_city_slug(locality: str | None) -> str | None:
    if not locality or not str(locality).strip():
        return None
    return "-".join(str(locality).split(",")[0].strip().lower().split())
