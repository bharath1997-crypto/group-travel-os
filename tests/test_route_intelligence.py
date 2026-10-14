"""
Tests for Route Intelligence Service + Rovi Route AI Service.

All external APIs (Gemini) are mocked.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.route_intelligence import LocationSummary
from app.services.route_intelligence_service import RouteIntelligenceService

client = TestClient(app)


def _auth_header():
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "testpassword123"},
    )
    if login.status_code != 200:
        pytest.skip("Test user not available — skipping auth-dependent tests")
    token = login.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


class TestRouteIntelligenceService:
    def test_local_route_road_only(self):
        origin = LocationSummary(name="Chicago", country="United States", lat=41.8781, lng=-87.6298)
        dest = LocationSummary(name="Milwaukee", country="United States", lat=43.0389, lng=-87.9065)
        resp = RouteIntelligenceService.resolve(origin, dest)
        assert resp.distance_km is not None and resp.distance_km < 150
        assert any(o.id == "road_trip" for o in resp.route_options)
        assert not resp.is_international
        assert resp.ground_unavailable_reason is None

    def test_international_long_distance_no_invented_options(self):
        origin = LocationSummary(name="Chicago", country="United States", lat=41.8781, lng=-87.6298)
        dest = LocationSummary(name="Bhubaneswar", country="India", lat=20.2961, lng=85.8245)
        resp = RouteIntelligenceService.resolve(origin, dest)
        assert resp.is_international
        assert resp.route_options == []
        assert resp.ground_unavailable_reason
        assert "ground" in resp.ground_unavailable_reason.lower()


    def test_domestic_mid_range_has_transit_hint(self):
        origin = LocationSummary(name="Chicago", country="United States", lat=41.8781, lng=-87.6298)
        dest = LocationSummary(name="Indianapolis", country="United States", lat=39.7684, lng=-86.1581)
        resp = RouteIntelligenceService.resolve(origin, dest)
        assert not resp.is_international
        ids = {o.id for o in resp.route_options}
        assert "road_trip" in ids
        assert "transit_directions" in ids

    def test_domestic_very_long_road_estimate_only(self):
        origin = LocationSummary(name="Delhi", country="India", lat=28.6139, lng=77.2090)
        dest = LocationSummary(name="Mumbai", country="India", lat=19.0760, lng=72.8777)
        resp = RouteIntelligenceService.resolve(origin, dest)
        assert not resp.is_international
        assert len(resp.route_options) >= 1
        assert resp.route_options[0].id == "road_trip"

    def test_response_schema_valid(self):
        origin = LocationSummary(name="Paris", country="France", lat=48.8566, lng=2.3522)
        dest = LocationSummary(name="Tokyo", country="Japan", lat=35.6762, lng=139.6503)
        resp = RouteIntelligenceService.resolve(origin, dest)
        assert resp.origin.name == "Paris"
        assert resp.destination.name == "Tokyo"
        assert resp.route_options == []
        assert resp.ground_unavailable_reason


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

    def test_resolve_endpoint_international_ground_unavailable(self):
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
        assert data["is_international"] is True
        assert data["route_options"] == []
        assert data.get("ground_unavailable_reason")

    def test_explain_endpoint_with_mocked_gemini(self):
        headers = _auth_header()
        mock_text = "Ground directions are not available for this distance. Use Plan → Routes for local segments."

        with patch("app.services.rovi_route_ai_service._call_gemini", return_value=mock_text):
            resp = client.post(
                "/api/v1/route-intelligence/explain",
                json={
                    "origin": {"name": "Chicago", "country": "United States", "lat": 41.8781, "lng": -87.6298},
                    "destination": {"name": "Milwaukee", "country": "United States", "lat": 43.0389, "lng": -87.9065},
                },
                headers=headers,
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["rovi_explanation"] is not None

    def test_explain_endpoint_fallback_when_no_gemini_key(self):
        headers = _auth_header()

        with patch("app.services.rovi_route_ai_service._gemini_key", return_value=""):
            resp = client.post(
                "/api/v1/route-intelligence/explain",
                json={
                    "origin": {"name": "New York", "country": "United States", "lat": 40.7128, "lng": -74.006},
                    "destination": {"name": "Boston", "country": "United States", "lat": 42.3601, "lng": -71.0589},
                },
                headers=headers,
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["rovi_explanation"] is not None
        assert len(data["rovi_explanation"]) > 20

    def test_resolve_validation_error(self):
        headers = _auth_header()
        resp = client.post(
            "/api/v1/route-intelligence/resolve",
            json={
                "origin": {"name": "Chicago"},
                "destination": {"name": "Delhi", "lat": 28.6139, "lng": 77.209},
            },
            headers=headers,
        )
        assert resp.status_code == 422
