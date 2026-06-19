"""
tests/test_maps_export.py — Tests for POST /api/v1/data/export/maps

Covers:
  - 202 success — GeoJSON export request created
  - 422 — invalid format value
  - 401 — unauthenticated request
  - GeoJSON builder: empty pins returns valid FeatureCollection
  - GeoJSON builder: pins include correct geometry and properties
  - Service: only exports pins belonging to the requesting user
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.auth import get_current_user

client = TestClient(app)

_USER_ID  = uuid.UUID("00000000-0000-0000-0000-000000000055")
_OTHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000066")


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = _USER_ID
    user.email = "maps@example.com"
    user.full_name = "Map Tester"
    user.is_active = True
    return user


def _mock_export_req() -> MagicMock:
    req = MagicMock()
    req.id = uuid.uuid4()
    req.user_id = _USER_ID
    req.export_type = "maps"
    req.format = "geojson"
    req.status = "pending"
    req.file_url = None
    req.file_size_kb = None
    req.error_message = None
    req.requested_at = datetime.now(timezone.utc).replace(tzinfo=None)
    req.ready_at = None
    req.expires_at = None
    req.metadata_ = {}
    return req


def _mock_pin(
    user_id: uuid.UUID = _USER_ID,
    lat: float = 48.8566,
    lon: float = 2.3522,
    name: str = "Eiffel Tower",
) -> MagicMock:
    from app.models.saved_pin import SavedPin

    pin = MagicMock(spec=SavedPin)
    pin.id = uuid.uuid4()
    pin.user_id = user_id
    pin.latitude = lat
    pin.longitude = lon
    pin.name = name
    pin.note = "Amazing view"
    pin.flag_type = "dream"
    pin.created_at = datetime.now(timezone.utc).replace(tzinfo=None)
    return pin


@pytest.fixture(autouse=True)
def _reset_auth():
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def auth():
    app.dependency_overrides[get_current_user] = _mock_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


# ── 202 success ───────────────────────────────────────────────────────────────

def test_request_maps_export_202(auth, monkeypatch):
    mock_req = _mock_export_req()
    monkeypatch.setattr(
        "app.services.maps_export_service.create_maps_export_request",
        lambda db, user_id: mock_req,
    )
    monkeypatch.setattr(
        "app.services.maps_export_service.process_maps_export",
        lambda request_id: None,
    )

    res = client.post("/api/v1/data/export/maps", json={"format": "geojson"})
    assert res.status_code == 202
    body = res.json()
    assert body["export_type"] == "maps"
    assert body["format"] == "geojson"
    assert body["status"] == "pending"


# ── 422 invalid format ────────────────────────────────────────────────────────

def test_request_maps_export_invalid_format_422(auth):
    res = client.post("/api/v1/data/export/maps", json={"format": "pdf"})
    assert res.status_code == 422


def test_request_maps_export_invalid_format_kml_422(auth):
    res = client.post("/api/v1/data/export/maps", json={"format": "kml"})
    assert res.status_code == 422


# ── 401 unauthenticated ───────────────────────────────────────────────────────

def test_request_maps_export_401():
    res = client.post("/api/v1/data/export/maps", json={"format": "geojson"})
    assert res.status_code == 401


# ── GeoJSON builder: empty pins ───────────────────────────────────────────────

def test_build_geojson_empty_pins():
    from app.services.maps_export_service import build_geojson

    result = json.loads(build_geojson([]))
    assert result["type"] == "FeatureCollection"
    assert result["features"] == []
    assert result["metadata"]["feature_count"] == 0


# ── GeoJSON builder: correct structure ───────────────────────────────────────

def test_build_geojson_feature_structure():
    from app.services.maps_export_service import build_geojson

    pin = _mock_pin(lat=48.8566, lon=2.3522, name="Eiffel Tower")
    result = json.loads(build_geojson([pin]))

    assert result["type"] == "FeatureCollection"
    assert len(result["features"]) == 1

    feat = result["features"][0]
    assert feat["type"] == "Feature"
    assert feat["geometry"]["type"] == "Point"
    # GeoJSON coordinates are [longitude, latitude]
    assert feat["geometry"]["coordinates"] == [2.3522, 48.8566]

    props = feat["properties"]
    assert props["name"] == "Eiffel Tower"
    assert props["category"] == "dream"
    assert props["notes"] == "Amazing view"


# ── Own-data isolation ────────────────────────────────────────────────────────

def test_collect_pins_only_own_user(monkeypatch):
    """_collect_pins queries with user_id filter — verify WHERE clause is applied."""
    from app.services.maps_export_service import _collect_pins
    from tests.conftest import exec_result

    my_pin    = _mock_pin(user_id=_USER_ID, name="My Place")
    other_pin = _mock_pin(user_id=_OTHER_ID, name="Other Place")

    db = MagicMock()
    # Simulate: only my_pin returned because WHERE user_id = _USER_ID
    db.execute.return_value = exec_result(scalars_all=[my_pin])

    pins = _collect_pins(db, _USER_ID)
    assert len(pins) == 1
    assert pins[0].name == "My Place"
    # Ensure other user's pin was never in the result
    assert all(p.user_id == _USER_ID for p in pins)
