"""Normalize Live pin context for Wayra source fetching."""

from __future__ import annotations

from typing import Any

from app.services.wayra_intent import _is_live_page

GENERIC_PLACE_NAMES = frozenset(
    {
        "dropped pin",
        "selected location",
        "address",
        "place",
        "map pin",
        "your location",
    }
)


def is_generic_place_name(name: str | None) -> bool:
    if not name or not str(name).strip():
        return True
    return str(name).strip().lower() in GENERIC_PLACE_NAMES


def normalize_place_for_sources(
    place: dict[str, Any],
    ctx: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge region fields from context and replace generic pin labels."""
    enriched: dict[str, Any] = dict(place)

    if ctx:
        selected = ctx.get("selectedPlace")
        if isinstance(selected, dict):
            for key in ("city", "state", "country", "address", "category"):
                if not enriched.get(key) and selected.get(key):
                    enriched[key] = selected[key]
            if is_generic_place_name(str(enriched.get("name") or "")) and not is_generic_place_name(
                str(selected.get("name") or "")
            ):
                enriched["name"] = selected.get("name")

        region = ctx.get("resolvedMapRegion")
        if isinstance(region, str) and region.strip() and is_generic_place_name(
            str(enriched.get("name") or "")
        ):
            enriched["name"] = region.strip()

    if is_generic_place_name(str(enriched.get("name") or "")):
        area_parts = [
            p
            for p in (enriched.get("city"), enriched.get("state"), enriched.get("country"))
            if isinstance(p, str) and p.strip()
        ]
        if area_parts:
            deduped: list[str] = []
            for part in area_parts:
                part = part.strip()
                if part not in deduped:
                    deduped.append(part)
            enriched["name"] = ", ".join(deduped)

    return enriched


def build_live_context_block(ctx: dict[str, Any] | None) -> str | None:
    """Compact pin block for LLM + discovery sources (mirrors frontend live-map-context)."""
    if not ctx or not _is_live_page("", ctx):
        return None

    selected = ctx.get("selectedPlace")
    if not isinstance(selected, dict):
        selected = ctx.get("activeMapPin")
    if not isinstance(selected, dict):
        return None

    lat = selected.get("lat")
    lng = selected.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return None

    place = normalize_place_for_sources(
        {
            "name": selected.get("name") or "Selected location",
            "lat": float(lat),
            "lng": float(lng),
            "category": selected.get("category"),
            "city": selected.get("city"),
            "state": selected.get("state"),
            "country": selected.get("country"),
            "address": selected.get("address"),
        },
        ctx,
    )

    display_name = str(place.get("name") or "Selected location")
    lines: list[str] = [
        "ACTIVE MAP PIN (answer about this place by default):",
        f"- Name: {display_name}",
        f"- Coordinates: {float(lat):.5f}, {float(lng):.5f}",
    ]

    region = ctx.get("resolvedMapRegion")
    if isinstance(region, str) and region.strip() and region.strip() != display_name:
        lines.append(f"- Region: {region.strip()}")

    for key, label in (
        ("city", "City/area"),
        ("state", "State/province"),
        ("country", "Country"),
    ):
        val = place.get(key)
        if isinstance(val, str) and val.strip():
            lines.append(f"- {label}: {val.strip()}")

    address = place.get("address")
    if isinstance(address, str) and address.strip() and not address.strip().startswith("Coordinates:"):
        lines.append(f"- Address/region: {address.strip()}")

    category = place.get("category")
    if isinstance(category, str) and category.strip():
        lines.append(f"- Category: {category.strip()}")

    lines.extend(
        [
            "Use coordinates and region fields to identify the real-world location even when the pin label is generic.",
            "Answer culture, language, local activities, and regional food traditions directly from region context.",
            "Treat the user's message as about this pin unless they clearly ask how Rovvy works.",
        ]
    )
    return "\n".join(lines)
