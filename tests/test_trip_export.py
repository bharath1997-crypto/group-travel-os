"""
tests/test_trip_export.py — Tests for POST /api/v1/data/export/trips

Covers:
  - 202 success — JSON format
  - 202 success — ICS format
  - 422 — empty trip_ids list
  - 422 — invalid format value
  - 401 — unauthenticated request
  - 403 — user does not have access to a requested trip
  - 404 — trip does not exist
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.auth import get_current_user
from app.utils.exceptions import AppException

client = TestClient(app)

_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000077")
_TRIP_A  = uuid.uuid4()
_TRIP_B  = uuid.uuid4()


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = _USER_ID
    user.email = "trips@example.com"
    user.full_name = "Trip Tester"
    user.is_active = True
    return user


def _mock_export_req(fmt: str = "json") -> MagicMock:
    req = MagicMock()
    req.id = uuid.uuid4()
    req.user_id = _USER_ID
    req.export_type = "trips"
    req.format = fmt
    req.status = "pending"
    req.file_url = None
    req.file_size_kb = None
    req.error_message = None
    req.requested_at = datetime.now(timezone.utc).replace(tzinfo=None)
    req.ready_at = None
    req.expires_at = None
    req.metadata_ = {"trip_ids": [str(_TRIP_A)]}
    return req


@pytest.fixture(autouse=True)
def _reset_auth():
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def auth():
    app.dependency_overrides[get_current_user] = _mock_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


# ── Successful JSON export ────────────────────────────────────────────────────

def test_request_trip_export_json_202(auth, monkeypatch):
    mock_req = _mock_export_req("json")
    monkeypatch.setattr(
        "app.services.trip_export_service.create_trip_export_request",
        lambda db, user_id, trip_ids, fmt: mock_req,
    )
    monkeypatch.setattr(
        "app.services.trip_export_service.process_trip_export",
        lambda request_id: None,
    )

    res = client.post(
        "/api/v1/data/export/trips",
        json={"trip_ids": [str(_TRIP_A)], "format": "json"},
    )
    assert res.status_code == 202
    body = res.json()
    assert body["export_type"] == "trips"
    assert body["format"] == "json"
    assert body["status"] == "pending"


# ── Successful ICS export ─────────────────────────────────────────────────────

def test_request_trip_export_ics_202(auth, monkeypatch):
    mock_req = _mock_export_req("ics")
    monkeypatch.setattr(
        "app.services.trip_export_service.create_trip_export_request",
        lambda db, user_id, trip_ids, fmt: mock_req,
    )
    monkeypatch.setattr(
        "app.services.trip_export_service.process_trip_export",
        lambda request_id: None,
    )

    res = client.post(
        "/api/v1/data/export/trips",
        json={"trip_ids": [str(_TRIP_A), str(_TRIP_B)], "format": "ics"},
    )
    assert res.status_code == 202
    body = res.json()
    assert body["format"] == "ics"


# ── Validation: empty trip_ids ────────────────────────────────────────────────

def test_request_trip_export_empty_ids_422(auth):
    res = client.post(
        "/api/v1/data/export/trips",
        json={"trip_ids": [], "format": "json"},
    )
    assert res.status_code == 422


# ── Validation: invalid format ────────────────────────────────────────────────

def test_request_trip_export_invalid_format_422(auth):
    res = client.post(
        "/api/v1/data/export/trips",
        json={"trip_ids": [str(_TRIP_A)], "format": "pdf"},
    )
    assert res.status_code == 422


# ── 401 unauthenticated ───────────────────────────────────────────────────────

def test_request_trip_export_401():
    res = client.post(
        "/api/v1/data/export/trips",
        json={"trip_ids": [str(_TRIP_A)], "format": "json"},
    )
    assert res.status_code == 401


# ── 403 user does not own trip ────────────────────────────────────────────────

def test_request_trip_export_403_not_member(auth, monkeypatch):
    def _raise(*_a, **_kw):
        raise AppException.forbidden("You do not have access to trip")

    monkeypatch.setattr(
        "app.services.trip_export_service.create_trip_export_request",
        _raise,
    )

    res = client.post(
        "/api/v1/data/export/trips",
        json={"trip_ids": [str(_TRIP_A)], "format": "json"},
    )
    assert res.status_code == 403


# ── 404 trip does not exist ───────────────────────────────────────────────────

def test_request_trip_export_404_unknown_trip(auth, monkeypatch):
    def _raise(*_a, **_kw):
        raise AppException.not_found("Trip not found")

    monkeypatch.setattr(
        "app.services.trip_export_service.create_trip_export_request",
        _raise,
    )

    res = client.post(
        "/api/v1/data/export/trips",
        json={"trip_ids": [str(uuid.uuid4())], "format": "json"},
    )
    assert res.status_code == 404


# ── ICS builder unit test ─────────────────────────────────────────────────────

def test_ics_builder_output():
    from datetime import date

    from app.models.trip import Trip, TripStatus
    from app.services.trip_export_service import _build_ics

    trip = MagicMock(spec=Trip)
    trip.id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    trip.title = "Goa Trip"
    trip.description = "Beach holiday"
    trip.status = TripStatus.planning
    trip.start_date = date(2026, 12, 1)
    trip.end_date = date(2026, 12, 7)

    result = _build_ics([trip]).decode("utf-8")
    assert "BEGIN:VCALENDAR" in result
    assert "BEGIN:VEVENT" in result
    assert "SUMMARY:Goa Trip" in result
    assert "DTSTART;VALUE=DATE:20261201" in result
    assert "DTEND;VALUE=DATE:20261208" in result   # end_date + 1 day
    assert "UID:trip-11111111-1111-1111-1111-111111111111@rovvy.app" in result
    assert "END:VEVENT" in result
    assert "END:VCALENDAR" in result


# ── JSON builder unit test ────────────────────────────────────────────────────

def test_json_builder_output():
    from datetime import date

    from app.models.trip import Trip, TripStatus
    from app.services.trip_export_service import _build_trip_json
    from tests.conftest import exec_result

    db = MagicMock()
    db.execute.return_value = exec_result(
        scalar_one_or_none=None,
        scalars_all=[],
    )

    trip = MagicMock(spec=Trip)
    trip.id = uuid.UUID("22222222-2222-2222-2222-222222222222")
    trip.title = "Paris Trip"
    trip.description = "City break"
    trip.status = TripStatus.confirmed
    trip.start_date = date(2026, 6, 1)
    trip.end_date = date(2026, 6, 5)
    trip.group_id = uuid.uuid4()
    trip.created_at = datetime.now(timezone.utc).replace(tzinfo=None)

    result_bytes = _build_trip_json(db, [trip])
    import json
    data = json.loads(result_bytes)
    assert "trips" in data
    assert data["trips"][0]["title"] == "Paris Trip"
    assert data["trips"][0]["status"] == "confirmed"
