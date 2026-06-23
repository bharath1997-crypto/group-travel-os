"""Tests for dev DB diagnostics endpoint."""
from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


@patch("app.main.dev_diagnostics_enabled", return_value=False)
def test_health_db_hidden_in_production(_mock: object) -> None:
    resp = client.get("/health/db")
    assert resp.status_code == 404


@patch("app.main.dev_diagnostics_enabled", return_value=True)
@patch("app.main.collect_db_diagnostics")
def test_health_db_returns_diagnostics(mock_collect: object, _mock: object) -> None:
    mock_collect.return_value = {
        "connected": True,
        "blockers": [],
        "recommendations": ["No blockers detected."],
    }
    resp = client.get("/health/db")
    assert resp.status_code == 200
    body = resp.json()
    assert body["connected"] is True
    assert body["blockers"] == []
