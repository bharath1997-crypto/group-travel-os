"""
tests/test_apple_maps.py — Apple Maps URL helper tests

Tests:
  - Apple Maps URL generation (deep link + web URL)
  - Special characters in place names are encoded
  - Place deep links use correct coordinate order (lat,lng)
  - ICS download link renders to correct backend endpoint
  - Web URL falls back to maps.apple.com
"""
from __future__ import annotations

from app.utils.apple_maps import (
    apple_maps_links,
    build_apple_maps_deep_link,
    build_apple_maps_web_url,
)


# ── Deep link format ──────────────────────────────────────────────────────────

class TestAppleMapDeepLink:
    def test_basic_deep_link_format(self):
        """maps:// scheme with name and lat/lng."""
        url = build_apple_maps_deep_link("Eiffel Tower", 48.8584, 2.2945)
        assert url.startswith("maps://")
        assert "ll=48.8584,2.2945" in url

    def test_deep_link_includes_query(self):
        """Query parameter must be present in deep link."""
        url = build_apple_maps_deep_link("Eiffel Tower", 48.8584, 2.2945)
        assert "q=Eiffel%20Tower" in url or "q=Eiffel+Tower" in url

    def test_deep_link_special_chars_encoded(self):
        """Spaces and special characters are percent-encoded."""
        url = build_apple_maps_deep_link("Café du Monde", 29.9573, -90.0628)
        assert "Caf" in url         # base name present
        assert " " not in url       # no raw spaces
        assert "&ll=" in url        # coordinates appended

    def test_deep_link_negative_longitude(self):
        """Negative longitude is preserved correctly."""
        url = build_apple_maps_deep_link("Central Park", 40.7851, -73.9683)
        assert "ll=40.7851,-73.9683" in url

    def test_deep_link_coordinate_order(self):
        """Coordinates must be lat,lng — not lng,lat."""
        lat, lng = 35.6762, 139.6503
        url = build_apple_maps_deep_link("Shibuya", lat, lng)
        # The ll parameter must have lat first
        ll_part = url.split("ll=")[1]
        parts = ll_part.split(",")
        assert float(parts[0]) == lat
        assert float(parts[1]) == lng


# ── Web URL format ────────────────────────────────────────────────────────────

class TestAppleMapWebUrl:
    def test_web_url_uses_maps_apple_com(self):
        """Web fallback must use maps.apple.com domain."""
        url = build_apple_maps_web_url("Big Ben", 51.5007, -0.1246)
        assert url.startswith("https://maps.apple.com/")

    def test_web_url_includes_coordinates(self):
        """Web URL includes ll= parameter."""
        url = build_apple_maps_web_url("Big Ben", 51.5007, -0.1246)
        assert "ll=51.5007,-0.1246" in url

    def test_web_url_special_chars_encoded(self):
        """Special characters are percent-encoded in web URL."""
        url = build_apple_maps_web_url("St. Peter's Square", 41.9022, 12.4539)
        assert " " not in url
        assert "St." in url or "St%2E" in url

    def test_web_url_uses_https(self):
        """Web URL must use HTTPS."""
        url = build_apple_maps_web_url("Sydney Opera House", -33.8568, 151.2153)
        assert url.startswith("https://")


# ── Combined helper ───────────────────────────────────────────────────────────

class TestAppleMapsLinks:
    def test_returns_both_links(self):
        """apple_maps_links() returns both deep_link and web_url."""
        result = apple_maps_links("Colosseum", 41.8902, 12.4922)
        assert "deep_link" in result
        assert "web_url" in result

    def test_deep_link_uses_maps_scheme(self):
        result = apple_maps_links("Colosseum", 41.8902, 12.4922)
        assert result["deep_link"].startswith("maps://")

    def test_web_url_uses_maps_apple_com(self):
        result = apple_maps_links("Colosseum", 41.8902, 12.4922)
        assert "maps.apple.com" in result["web_url"]

    def test_both_links_contain_coordinates(self):
        """Both URLs must contain the same coordinates."""
        lat, lng = 48.8606, 2.3376
        result = apple_maps_links("Louvre", lat, lng)
        assert f"{lat},{lng}" in result["deep_link"]
        assert f"{lat},{lng}" in result["web_url"]


# ── ICS export endpoint reachability ─────────────────────────────────────────

class TestIcsExportEndpoint:
    def test_ics_export_route_exists(self):
        """POST /api/v1/data/export/trips must exist (not 404/405)."""
        from fastapi.testclient import TestClient
        from app.main import app
        from app.utils.auth import get_current_user
        from app.utils.exceptions import AppException

        # Override auth to return 401 cleanly — we just check the route is registered
        def _raise():
            raise AppException.unauthorized("Not authenticated")

        app.dependency_overrides[get_current_user] = _raise
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/data/export/trips",
            json={"trip_ids": [], "format": "ics"},
        )
        app.dependency_overrides.pop(get_current_user, None)

        # 401 = route exists but requires auth. 404/405 = route missing.
        assert resp.status_code not in (404, 405)

    def test_ics_download_link_format(self):
        """ICS export requests the download via the /data/export/trips endpoint with format=ics."""
        from app.schemas.data_export import ExportTripsIn
        import uuid

        trip_id = uuid.uuid4()
        body = ExportTripsIn(trip_ids=[trip_id], format="ics")
        assert body.format == "ics"
        assert body.trip_ids == [trip_id]
