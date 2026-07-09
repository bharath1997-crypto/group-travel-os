from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.live_ai_service import clear_live_ai_cache_for_tests
from app.services.live_location_context_service import (
    FAR_DISTANCE_MILES,
    LOCAL_DISTANCE_MILES,
    build_location_context,
    classify_location_context,
    resolve_location_context,
)
from app.schemas.live_location_context import (
    LiveLocationContextRequest,
    LiveLocationInput,
    LiveSelectedPlaceInput,
    RoviCompactContext,
)
from app.utils.auth import get_current_user

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_live_ai_cache_for_tests()
    yield
    clear_live_ai_cache_for_tests()


@pytest.fixture
def auth_user():
    user = MagicMock()
    user.id = 1
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def _context_request(**overrides):
    body = {
        "user_location": {
            "lat": 41.88,
            "lng": -87.63,
            "city": "Chicago",
            "state": "Illinois",
            "country": "United States",
        },
        "selected_place": {
            "name": "Bombay Indian Cuisine",
            "address": "Nakhon Ratchasima, Thailand",
            "lat": 14.97,
            "lng": 102.09,
            "city": "Nakhon Ratchasima",
            "country": "Thailand",
            "category": "Restaurant",
            "has_opening_hours": False,
        },
        "workflow_type": "Solo",
        "travel_mode": "Drive",
        "live_stage": "place_preview",
    }
    body.update(overrides)
    return body


def test_build_location_context_country_mismatch():
    request = LiveLocationContextRequest(**_context_request())
    result = resolve_location_context(request)

    assert result.classification == "country_mismatch"
    assert result.country_mismatch is True
    assert result.live_safe is False
    assert result.future_trip_candidate is True
    assert result.distance_miles is not None
    assert result.distance_miles > LOCAL_DISTANCE_MILES
    assert "Search near me" in result.recommended_actions
    assert result.compact["classification"] == "country_mismatch"
    assert result.compact["live_safe"] is False


def test_build_location_context_local_place():
    request = LiveLocationContextRequest(
        user_location=LiveLocationInput(
            lat=41.88,
            lng=-87.63,
            city="Chicago",
            state="Illinois",
            country="United States",
        ),
        selected_place=LiveSelectedPlaceInput(
            name="Starbucks Reserve",
            address="646 North Michigan Avenue, Chicago, Illinois, United States",
            lat=41.8947,
            lng=-87.6233,
            has_opening_hours=True,
        ),
        workflow_type="Solo",
        travel_mode="Drive",
        live_stage="place_preview",
    )
    result = resolve_location_context(request)

    assert result.classification == "local_place"
    assert result.live_safe is True
    assert result.distance_miles is not None
    assert result.distance_miles < LOCAL_DISTANCE_MILES


def test_classify_very_far_destination():
    built = build_location_context(
        LiveLocationInput(lat=41.88, lng=-87.63, country="United States"),
        LiveSelectedPlaceInput(
            name="Far Place",
            address="Los Angeles, California, United States",
            lat=34.05,
            lng=-118.24,
            country="United States",
        ),
    )
    assert classify_location_context(built) == "very_far_destination"


def test_location_context_endpoint(auth_user):
    res = client.post("/api/v1/live/location-context", json=_context_request())
    assert res.status_code == 200
    body = res.json()
    assert body["classification"] == "country_mismatch"
    assert body["template"]["summary"]
    assert body["compact"]["place_name"] == "Bombay Indian Cuisine"


def test_location_context_unauthorized():
    res = client.post("/api/v1/live/location-context", json=_context_request())
    assert res.status_code == 401


def _compact_payload(**overrides):
    compact = {
        "user_area": "Chicago, Illinois, United States",
        "place_name": "Bombay Indian Cuisine",
        "place_area": "Nakhon Ratchasima, Thailand",
        "distance_miles": 8457.9,
        "classification": "country_mismatch",
        "travel_mode": "drive",
        "workflow_type": "solo",
        "live_safe": False,
        "recommended_actions": [
            "Search near me",
            "Change destination",
            "Plan Trip",
            "Continue anyway",
        ],
    }
    compact.update(overrides)
    return {"compact_context": compact}


def test_place_explanation_success(auth_user):
    gemini_json = (
        '{"summary": "You appear near Chicago while this place is in Thailand.", '
        '"recommendation": "Plan this as a future trip instead of Solo Live.", '
        '"actions": ["Search near me", "Change destination", "Plan Trip", "Continue anyway"], '
        '"risk_level": "very_far"}'
    )
    with patch(
        "app.services.live_ai_service._call_gemini",
        return_value=(gemini_json, {"prompt_tokens": 40, "output_tokens": 60}),
    ):
        res = client.post("/api/v1/live/ai/place-explanation", json=_compact_payload())

    assert res.status_code == 200
    body = res.json()
    assert "Thailand" in body["summary"] or "future trip" in body["recommendation"].lower()
    assert body["risk_level"] == "very_far"


def test_place_explanation_template_fallback_without_gemini(auth_user):
    with patch("app.services.live_ai_service._gemini_key", return_value=""):
        res = client.post("/api/v1/live/ai/place-explanation", json=_compact_payload())

    assert res.status_code == 200
    body = res.json()
    assert "another country" in body["summary"].lower()
    assert "future trip" in body["recommendation"].lower()


def test_place_explanation_unauthorized():
    res = client.post("/api/v1/live/ai/place-explanation", json=_compact_payload())
    assert res.status_code == 401


def test_place_explanation_cache_hit(auth_user):
    gemini_json = (
        '{"summary": "Cached summary.", "recommendation": "Cached recommendation.", '
        '"actions": ["Search near me"], "risk_level": "very_far"}'
    )
    with patch("app.services.live_ai_service._gemini_key", return_value="test-gemini-key"):
        with patch(
            "app.services.live_ai_service._call_gemini",
            return_value=(gemini_json, {"prompt_tokens": 10, "output_tokens": 10}),
        ) as mock_gemini:
            first = client.post("/api/v1/live/ai/place-explanation", json=_compact_payload())
            second = client.post("/api/v1/live/ai/place-explanation", json=_compact_payload())

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["summary"] == second.json()["summary"]
    assert mock_gemini.call_count == 1
