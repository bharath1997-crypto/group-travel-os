"""
tests/test_health.py — Health endpoint smoke test

This test verifies the app starts and the /health endpoint is reachable.
It runs without a real database using the TestClient.

Run: pytest tests/test_health.py -v
"""
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint_returns_200():
    """Health endpoint must always return 200, even without a real DB."""
    with patch("app.main.check_db_connection", return_value=True):
        response = client.get("/health")
    assert response.status_code == 200


def test_health_response_contains_required_fields():
    """Health response must include status, app name, version, and database."""
    with patch("app.main.check_db_connection", return_value=True):
        response = client.get("/health")
    data = response.json()
    assert "status" in data
    assert "app" in data
    assert "version" in data
    assert "database" in data


def test_health_status_ok_when_db_connected():
    with patch("app.main.check_db_connection", return_value=True):
        response = client.get("/health")
    assert response.json()["status"] == "ok"
    assert response.json()["database"] == "connected"


def test_health_status_degraded_when_db_unreachable():
    with patch("app.main.check_db_connection", return_value=False):
        response = client.get("/health")
    # Still returns 200 — the endpoint itself works, DB is reported as degraded
    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert response.json()["database"] == "unreachable"
