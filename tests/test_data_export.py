"""
tests/test_data_export.py — Tests for data export endpoints

Covers:
  - POST /api/v1/data/export (201 success, 401 unauthorized, 400 rate limit)
  - GET /api/v1/data/export/history (200 success, 401 unauthorized)
  - GET /api/v1/data/export/{id} (200 success, 401 unauthorized, 404 not found)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.auth import get_current_user
from app.utils.exceptions import AppException

client = TestClient(app)

_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000042")


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = _USER_ID
    user.email = "export@example.com"
    user.full_name = "Export Tester"
    user.is_active = True
    return user


def _mock_export(
    status: str = "pending",
    file_url: str | None = None,
    file_size_kb: int | None = None,
) -> MagicMock:
    req = MagicMock()
    req.id = uuid.uuid4()
    req.user_id = _USER_ID
    req.export_type = "full"
    req.format = "zip"
    req.status = status
    req.file_url = file_url
    req.file_size_kb = file_size_kb
    req.error_message = None
    req.requested_at = datetime.now(timezone.utc).replace(tzinfo=None)
    req.ready_at = None
    req.expires_at = None
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


# ── POST /data/export ─────────────────────────────────────────────────────────

def test_request_export_202(auth, monkeypatch):
    mock_req = _mock_export(status="pending")
    monkeypatch.setattr(
        "app.services.data_export_service.create_export_request",
        lambda db, user_id, export_type="full": mock_req,
    )
    monkeypatch.setattr(
        "app.services.data_export_service.process_export",
        lambda request_id: None,
    )

    res = client.post("/api/v1/data/export", json={"export_type": "full"})
    assert res.status_code == 202
    body = res.json()
    assert body["status"] == "pending"
    assert body["export_type"] == "full"
    assert body["format"] == "zip"


def test_request_export_401_unauthorized():
    res = client.post("/api/v1/data/export", json={"export_type": "full"})
    assert res.status_code == 401


def test_request_export_400_rate_limit(auth, monkeypatch):
    def _raise(*_a, **_kw):
        raise AppException.bad_request("You can only request one export per 24 hours.")

    monkeypatch.setattr(
        "app.services.data_export_service.create_export_request",
        _raise,
    )

    res = client.post("/api/v1/data/export", json={"export_type": "full"})
    assert res.status_code == 400


# ── GET /data/export/history ──────────────────────────────────────────────────

def test_export_history_200(auth, monkeypatch):
    export_a = _mock_export(status="ready", file_size_kb=42)
    export_b = _mock_export(status="pending")
    monkeypatch.setattr(
        "app.services.data_export_service.list_export_history",
        lambda db, user_id: [export_a, export_b],
    )

    res = client.get("/api/v1/data/export/history")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    assert body[0]["status"] == "ready"
    assert body[0]["file_size_kb"] == 42
    assert body[1]["status"] == "pending"


def test_export_history_401():
    res = client.get("/api/v1/data/export/history")
    assert res.status_code == 401


def test_export_history_empty(auth, monkeypatch):
    monkeypatch.setattr(
        "app.services.data_export_service.list_export_history",
        lambda db, user_id: [],
    )
    res = client.get("/api/v1/data/export/history")
    assert res.status_code == 200
    assert res.json() == []


# ── GET /data/export/{id} ─────────────────────────────────────────────────────

def test_get_export_status_200(auth, monkeypatch):
    req_id = uuid.uuid4()
    mock_req = _mock_export(status="ready", file_url=f"/api/v1/data/export/{req_id}/download")
    mock_req.id = req_id
    monkeypatch.setattr(
        "app.services.data_export_service.get_export_request",
        lambda db, request_id, user_id: mock_req,
    )

    res = client.get(f"/api/v1/data/export/{req_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ready"
    assert body["file_url"] is not None


def test_get_export_status_401():
    res = client.get(f"/api/v1/data/export/{uuid.uuid4()}")
    assert res.status_code == 401


def test_get_export_status_404(auth, monkeypatch):
    def _raise(*_a, **_kw):
        raise AppException.not_found("Export request not found")

    monkeypatch.setattr(
        "app.services.data_export_service.get_export_request",
        _raise,
    )

    res = client.get(f"/api/v1/data/export/{uuid.uuid4()}")
    assert res.status_code == 404


# ── POST /data/export — validation ───────────────────────────────────────────

def test_request_export_422_invalid_body(auth):
    res = client.post("/api/v1/data/export", content="not-json")
    assert res.status_code == 422
