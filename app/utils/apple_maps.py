"""
app/utils/apple_maps.py — Apple Maps URL helpers

Generates deep links for opening locations in Apple Maps.

Deep-link format (iOS/macOS native app):
    maps://?q={name}&ll={lat},{lng}

Web fallback (any browser):
    https://maps.apple.com/?q={name}&ll={lat},{lng}

Both are generated so the frontend can try the native link first,
falling back to the web URL on non-Apple devices.

Ref: https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
"""
from __future__ import annotations

from urllib.parse import quote


def build_apple_maps_deep_link(name: str, lat: float, lng: float) -> str:
    """
    Native Apple Maps deep link (maps:// scheme).
    Opens in the Maps app on iOS/macOS; has no effect on other platforms.
    """
    encoded = quote(name, safe="")
    return f"maps://?q={encoded}&ll={lat},{lng}"


def build_apple_maps_web_url(name: str, lat: float, lng: float) -> str:
    """
    Web fallback that opens Apple Maps in Safari or redirects to the Maps app.
    Works on all platforms; on non-Apple devices it falls through to a web view.
    """
    encoded = quote(name, safe="")
    return f"https://maps.apple.com/?q={encoded}&ll={lat},{lng}"


def apple_maps_links(name: str, lat: float, lng: float) -> dict[str, str]:
    """Return both the deep link and web URL in a single dict."""
    return {
        "deep_link": build_apple_maps_deep_link(name, lat, lng),
        "web_url":   build_apple_maps_web_url(name, lat, lng),
    }
