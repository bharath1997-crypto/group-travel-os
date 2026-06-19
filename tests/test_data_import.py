"""
tests/test_data_import.py — Tests for data import endpoints

Covers:
  - GeoJSON preview success
  - GPX preview success
  - CSV places preview success
  - Invalid file type rejected (422/400)
  - File too large rejected
  - Confirm import success
  - Duplicate places skipped in classification
  - User cannot confirm another user's import (403)
  - Import history returns only the current user's imports
"""
from __future__ import annotations

import io
import json
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.auth import get_current_user
from app.utils.exceptions import AppException

client = TestClient(app)

_USER_ID  = uuid.UUID("00000000-0000-0000-0000-000000000088")
_OTHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000099")


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = _USER_ID
    user.email = "import@example.com"
    user.full_name = "Import Tester"
    user.is_active = True
    return user


def _mock_import_req(
    status: str = "preview",
    import_type: str = "places",
    fmt: str = "geojson",
    user_id: uuid.UUID = _USER_ID,
) -> MagicMock:
    req = MagicMock()
    req.id = uuid.uuid4()
    req.user_id = user_id
    req.import_type = import_type
    req.format = fmt
    req.status = status
    req.original_filename = "test.geojson"
    req.total_items = 2
    req.valid_items = 2
    req.duplicate_items = 0
    req.error_items = 0
    req.preview_data = {"valid": [], "duplicates": [], "errors": []}
    req.error_message = None
    req.created_at = datetime.now(timezone.utc).replace(tzinfo=None)
    req.imported_at = None
    req.metadata_ = {}
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


# ── Helpers to build valid test files ────────────────────────────────────────

def _geojson_bytes() -> bytes:
    fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [2.3522, 48.8566]},
                "properties": {"name": "Eiffel Tower", "category": "dream"},
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-73.9857, 40.7484]},
                "properties": {"name": "Empire State", "notes": "NYC visit"},
            },
        ],
    }
    return json.dumps(fc).encode()


def _gpx_bytes() -> bytes:
    return b"""<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="48.8566" lon="2.3522">
    <name>Eiffel Tower</name>
    <desc>Paris landmark</desc>
  </wpt>
</gpx>"""


def _csv_places_bytes() -> bytes:
    return b"name,latitude,longitude,category\nEiffel Tower,48.8566,2.3522,dream\n"


def _csv_trips_bytes() -> bytes:
    return b"title,start_date,end_date,description\nParis Trip,2026-12-01,2026-12-07,Holiday\n"


# ── GeoJSON preview success ───────────────────────────────────────────────────

def test_geojson_preview_200(auth, monkeypatch):
    mock_req = _mock_import_req(fmt="geojson")
    monkeypatch.setattr("app.services.data_import_service.classify_rows",
                        lambda db, uid, itype, rows: (
                            [{"index": 0, "status": "valid", "data": r, "reason": None} for r in rows],
                            [], [],
                        ))
    monkeypatch.setattr("app.services.data_import_service.create_preview",
                        lambda *_a, **_kw: mock_req)

    res = client.post(
        "/api/v1/data/import/preview",
        data={"import_type": "places"},
        files={"file": ("places.geojson", _geojson_bytes(), "application/json")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["format"] == "geojson"
    assert body["import_type"] == "places"


# ── GPX preview success ───────────────────────────────────────────────────────

def test_gpx_preview_200(auth, monkeypatch):
    mock_req = _mock_import_req(fmt="gpx")
    monkeypatch.setattr("app.services.data_import_service.classify_rows",
                        lambda db, uid, itype, rows: ([
                            {"index": 0, "status": "valid", "data": rows[0], "reason": None}
                        ] if rows else [], [], []))
    monkeypatch.setattr("app.services.data_import_service.create_preview",
                        lambda *_a, **_kw: mock_req)

    res = client.post(
        "/api/v1/data/import/preview",
        data={"import_type": "places"},
        files={"file": ("waypoints.gpx", _gpx_bytes(), "application/xml")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["format"] == "gpx"


# ── CSV places preview success ────────────────────────────────────────────────

def test_csv_places_preview_200(auth, monkeypatch):
    mock_req = _mock_import_req(fmt="csv")
    monkeypatch.setattr("app.services.data_import_service.classify_rows",
                        lambda db, uid, itype, rows: ([
                            {"index": 0, "status": "valid", "data": rows[0], "reason": None}
                        ] if rows else [], [], []))
    monkeypatch.setattr("app.services.data_import_service.create_preview",
                        lambda *_a, **_kw: mock_req)

    res = client.post(
        "/api/v1/data/import/preview",
        data={"import_type": "places"},
        files={"file": ("places.csv", _csv_places_bytes(), "text/csv")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["format"] == "csv"


# ── Invalid file type rejected ────────────────────────────────────────────────

def test_invalid_file_type_400(auth):
    res = client.post(
        "/api/v1/data/import/preview",
        data={"import_type": "places"},
        files={"file": ("data.pdf", b"%PDF", "application/pdf")},
    )
    assert res.status_code == 400


def test_unknown_extension_400(auth):
    res = client.post(
        "/api/v1/data/import/preview",
        data={"import_type": "places"},
        files={"file": ("data.kml", b"<kml/>", "application/xml")},
    )
    assert res.status_code == 400


# ── File too large rejected ───────────────────────────────────────────────────

def test_file_too_large_400(auth):
    big = b"x" * (11 * 1024 * 1024)   # 11 MB
    res = client.post(
        "/api/v1/data/import/preview",
        data={"import_type": "places"},
        files={"file": ("big.geojson", big, "application/json")},
    )
    assert res.status_code == 400


# ── Confirm import success ────────────────────────────────────────────────────

def test_confirm_import_200(auth, monkeypatch):
    import_id = uuid.uuid4()
    confirmed = _mock_import_req(status="imported")
    confirmed.id = import_id
    monkeypatch.setattr("app.services.data_import_service.confirm_import",
                        lambda db, imp_id, uid: confirmed)

    res = client.post(f"/api/v1/data/import/{import_id}/confirm")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "imported"
    assert "imported_count" in body


# ── 401 unauthenticated ───────────────────────────────────────────────────────

def test_preview_401():
    res = client.post(
        "/api/v1/data/import/preview",
        data={"import_type": "places"},
        files={"file": ("f.geojson", _geojson_bytes(), "application/json")},
    )
    assert res.status_code == 401


# ── User cannot confirm another user's import ─────────────────────────────────

def test_confirm_403_wrong_user(auth, monkeypatch):
    def _raise(*_a, **_kw):
        raise AppException.forbidden("You do not have access to this import")

    monkeypatch.setattr("app.services.data_import_service.confirm_import", _raise)

    res = client.post(f"/api/v1/data/import/{uuid.uuid4()}/confirm")
    assert res.status_code == 403


# ── Import history returns only current user's imports ────────────────────────

def test_import_history_200(auth, monkeypatch):
    my_req = _mock_import_req(user_id=_USER_ID)
    monkeypatch.setattr("app.services.data_import_service.list_import_history",
                        lambda db, user_id: [my_req])

    res = client.get("/api/v1/data/import/history")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1


def test_import_history_401():
    res = client.get("/api/v1/data/import/history")
    assert res.status_code == 401


# ── Duplicate detection unit test ─────────────────────────────────────────────

def test_duplicate_place_detection():
    from app.services.data_import_service import _is_duplicate_place

    existing = [(48.8566, 2.3522, "eiffel tower")]

    # Exact same location → duplicate
    assert _is_duplicate_place(48.8566, 2.3522, "Eiffel Tower", existing) is True
    # Very close (within 11m) → duplicate
    assert _is_duplicate_place(48.85661, 2.35221, "Other Name", existing) is True
    # Far away → not duplicate
    assert _is_duplicate_place(40.7484, -73.9857, "Empire State", existing) is False


# ── GeoJSON parser unit test ──────────────────────────────────────────────────

def test_parse_geojson_valid():
    from app.services.data_import_service import _parse_geojson

    rows = _parse_geojson(_geojson_bytes())
    assert len(rows) == 2
    assert rows[0]["name"] == "Eiffel Tower"
    assert rows[0]["latitude"] == 48.8566
    assert rows[0]["longitude"] == 2.3522


def test_parse_geojson_empty_fc():
    from app.services.data_import_service import _parse_geojson

    fc = json.dumps({"type": "FeatureCollection", "features": []}).encode()
    rows = _parse_geojson(fc)
    assert rows == []


# ── GPX parser unit test ──────────────────────────────────────────────────────

def test_parse_gpx_valid():
    from app.services.data_import_service import _parse_gpx

    rows = _parse_gpx(_gpx_bytes())
    assert len(rows) == 1
    assert rows[0]["name"] == "Eiffel Tower"
    assert rows[0]["latitude"] == 48.8566
    assert rows[0]["notes"] == "Paris landmark"


# ── CSV parser unit test ──────────────────────────────────────────────────────

def test_parse_csv_places_valid():
    from app.services.data_import_service import _parse_csv_places

    rows = _parse_csv_places(_csv_places_bytes())
    assert len(rows) == 1
    assert rows[0]["name"] == "Eiffel Tower"
    assert rows[0]["category"] == "dream"


def test_parse_csv_places_missing_required():
    from app.services.data_import_service import _parse_csv_places

    bad_csv = b"name,notes\nEiffel Tower,Nice\n"   # missing latitude/longitude
    with pytest.raises(Exception):
        _parse_csv_places(bad_csv)


def test_parse_csv_trips_valid():
    from app.services.data_import_service import _parse_csv_trips

    rows = _parse_csv_trips(_csv_trips_bytes())
    assert len(rows) == 1
    assert rows[0]["title"] == "Paris Trip"
    assert rows[0]["start_date"] == "2026-12-01"
