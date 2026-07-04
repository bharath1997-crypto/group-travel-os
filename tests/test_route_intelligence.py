"""
Tests for Route Intelligence Service + Rovi Route AI Service.

All external APIs (Gemini) are mocked.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.route_intelligence import LocationSummary
from app.services.route_intelligence_service import RouteIntelligenceService

client = TestClient(app)

# ── Fixtures ──────────────────────────────────────────────────────────────────

def _auth_header():
    """Get a valid test auth token."""
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "testpassword123"},
    )
    if login.status_code != 200:
        pytest.skip("Test user not available — skipping auth-dependent tests")
    token = login.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


# ── Unit tests: RouteIntelligenceService ─────────────────────────────────────

class TestRouteIntelligenceService:
    """Pure unit tests — no network, no DB."""

    def test_local_route(self):
        """Under 150 km — should return road trip option."""
        origin = LocationSummary(name="Chicago", country="United States", lat=41.8781, lng=-87.6298)
        dest = LocationSummary(name="Milwaukee", country="United States", lat=43.0389, lng=-87.9065)
        resp = RouteIntelligenceService.resolve(origin, dest)
        assert resp.distance_km is not None
        assert resp.distance_km < 150
        assert any(o.id == "road_trip" for o in resp.route_options)
        assert not resp.is_international

    def test_international_route_chicago_to_bhubaneswar(self):
        """Chicago → Bhubaneswar — should be international with hub options."""
        origin = LocationSummary(name="Chicago", country="United States", lat=41.8781, lng=-87.6298)
        dest = LocationSummary(name="Bhubaneswar", country="India", lat=20.2961, lng=85.8245)
        resp = RouteIntelligenceService.resolve(origin, dest)

        assert resp.is_international
        assert resp.distance_km is not None and resp.distance_km > 10000
        assert len(resp.route_options) >= 2

        # Kolkata hub should appear (city-level override for Bhubaneswar)
        option_titles = [o.title for o in resp.route_options]
        assert any("Kolkata" in t for t in option_titles), (
            f"Expected Kolkata hub for Bhubaneswar. Got: {option_titles}"
        )

    def test_international_route_has_flight_segments(self):
        """International routes must include flight segments."""
        origin = LocationSummary(name="New York", country="United States", lat=40.7128, lng=-74.0060)
        dest = LocationSummary(name="Delhi", country="India", lat=28.6139, lng=77.2090)
        resp = RouteIntelligenceService.resolve(origin, dest)

        for opt in resp.route_options:
            if opt.type in ("flight_connection", "flight_multimodal"):
                seg_types = [s.type for s in opt.segments]
                assert "flight" in seg_types, f"Option {opt.id} missing flight segment"

    def test_recommended_option_first_for_international(self):
        """First option should be recommended for international routes."""
        origin = LocationSummary(name="London", country="United Kingdom", lat=51.5074, lng=-0.1278)
        dest = LocationSummary(name="Mumbai", country="India", lat=19.0760, lng=72.8777)
        resp = RouteIntelligenceService.resolve(origin, dest)
        assert len(resp.route_options) > 0
        assert resp.route_options[0].recommended

    def test_far_domestic_has_multiple_options(self):
        """Domestic far route (150–800 km) should have road + flight + train."""
        origin = LocationSummary(name="Delhi", country="India", lat=28.6139, lng=77.2090)
        dest = LocationSummary(name="Mumbai", country="India", lat=19.0760, lng=72.8777)
        resp = RouteIntelligenceService.resolve(origin, dest)
        assert not resp.is_international
        assert len(resp.route_options) >= 2

    def test_response_schema_valid(self):
        """Response should be a valid RouteIntelligenceResponse."""
        origin = LocationSummary(name="Paris", country="France", lat=48.8566, lng=2.3522)
        dest = LocationSummary(name="Tokyo", country="Japan", lat=35.6762, lng=139.6503)
        resp = RouteIntelligenceService.resolve(origin, dest)
        assert resp.origin.name == "Paris"
        assert resp.destination.name == "Tokyo"
        assert isinstance(resp.route_options, list)
        for opt in resp.route_options:
            assert opt.id
            assert opt.title
            assert isinstance(opt.segments, list)


# ── API endpoint tests ─────────────────────────────────────────────────────────

class TestRouteIntelligenceEndpoints:
    def test_resolve_endpoint_requires_auth(self):
        resp = client.post(
            "/api/v1/route-intelligence/resolve",
            json={
                "origin": {"name": "Chicago", "country": "United States", "lat": 41.8781, "lng": -87.6298},
                "destination": {"name": "Bhubaneswar", "country": "India", "lat": 20.2961, "lng": 85.8245},
            },
        )
        assert resp.status_code == 401

    def test_explain_endpoint_requires_auth(self):
        resp = client.post(
            "/api/v1/route-intelligence/explain",
            json={
                "origin": {"name": "Chicago", "country": "United States", "lat": 41.8781, "lng": -87.6298},
                "destination": {"name": "Bhubaneswar", "country": "India", "lat": 20.2961, "lng": 85.8245},
            },
        )
        assert resp.status_code == 401

    def test_resolve_endpoint_returns_route_options(self):
        headers = _auth_header()
        resp = client.post(
            "/api/v1/route-intelligence/resolve",
            json={
                "origin": {"name": "Chicago", "country": "United States", "lat": 41.8781, "lng": -87.6298},
                "destination": {"name": "Bhubaneswar", "country": "India", "lat": 20.2961, "lng": 85.8245},
            },
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "route_options" in data
        assert isinstance(data["route_options"], list)
        assert len(data["route_options"]) > 0
        assert data["is_international"] is True
        assert data["rovi_explanation"] is None  # /resolve does not call AI

    def test_explain_endpoint_with_mocked_gemini(self):
        """
        /explain should return rovi_explanation (mocked Gemini call).
        No real external API call.
        """
        headers = _auth_header()
        mock_text = "Route options from Chicago to Bhubaneswar. Recommended via Kolkata. Choose an option to build the full route plan."

        with patch("app.services.rovi_route_ai_service._call_gemini", return_value=mock_text):
            resp = client.post(
                "/api/v1/route-intelligence/explain",
                json={
                    "origin": {"name": "Chicago", "country": "United States", "lat": 41.8781, "lng": -87.6298},
                    "destination": {"name": "Bhubaneswar", "country": "India", "lat": 20.2961, "lng": 85.8245},
                },
                headers=headers,
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["rovi_explanation"] is not None
        assert "Bhubaneswar" in data["rovi_explanation"] or "route" in data["rovi_explanation"].lower()

    def test_explain_endpoint_fallback_when_no_gemini_key(self):
        """When no Gemini key, should fall back to template explanation."""
        headers = _auth_header()

        with patch("app.services.rovi_route_ai_service._gemini_key", return_value=""):
            resp = client.post(
                "/api/v1/route-intelligence/explain",
                json={
                    "origin": {"name": "New York", "country": "United States", "lat": 40.7128, "lng": -74.006},
                    "destination": {"name": "Delhi", "country": "India", "lat": 28.6139, "lng": 77.2090},
                },
                headers=headers,
            )
        assert resp.status_code == 200
        data = resp.json()
        # Fallback still returns something
        assert data["rovi_explanation"] is not None
        assert len(data["rovi_explanation"]) > 20

    def test_resolve_validation_error(self):
        headers = _auth_header()
        resp = client.post(
            "/api/v1/route-intelligence/resolve",
            json={
                "origin": {"name": "Chicago"},  # missing lat/lng
                "destination": {"name": "Delhi", "lat": 28.6139, "lng": 77.209},
            },
            headers=headers,
        )
        assert resp.status_code == 422
