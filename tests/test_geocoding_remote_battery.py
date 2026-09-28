"""
Geocoding API battery — 1,015 remote worldwide coordinates.

Fast tests (default): fixture integrity + mocked API contract on a sample.
Live battery: pytest -m geocoding_live (hits Nominatim — slow, rate-limited).

Or run: python scripts/run_geocoding_battery_report.py
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.geocoding_service import clear_geocoding_cache_for_tests

FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "geocoding_remote_battery.json"
client = TestClient(app)

pytestmark_live = pytest.mark.geocoding_live


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_geocoding_cache_for_tests()
    yield
    clear_geocoding_cache_for_tests()


def _load_battery() -> dict:
    assert FIXTURE_PATH.is_file(), (
        f"Missing {FIXTURE_PATH}. Run: python scripts/generate_geocoding_remote_battery.py"
    )
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _mock_async_client_get(response: MagicMock):
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    return mock_client


def test_remote_battery_fixture_has_1015_unique_cases():
    payload = _load_battery()
    cases = payload["cases"]
    assert payload["count"] == 1015
    assert len(cases) == 1015

    coords = {(c["lat"], c["lng"]) for c in cases}
    assert len(coords) == 1015

    for case in cases:
        assert -90 <= case["lat"] <= 90
        assert -180 <= case["lng"] <= 180
        assert case["id"]
        assert case["region"]


@pytest.mark.parametrize(
    "case_id",
    [
        "anchor-001",
        "anchor-002",
        "anchor-003",
        "remote-01-001",
        "remote-02-005",
    ],
)
def test_reverse_api_mocked_contract_for_sample_cases(case_id: str):
    payload = _load_battery()
    case = next(c for c in payload["cases"] if c["id"] == case_id)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "display_name": f"{case['region']} mock",
        "name": case["region"],
        "address": {"country": case["region"], "state_district": case["region"]},
        "type": "administrative",
        "class": "boundary",
    }

    with patch(
        "app.services.geocoding_service.httpx.AsyncClient",
        return_value=_mock_async_client_get(mock_response),
    ):
        res = client.get(
            "/api/v1/geocoding/reverse",
            params={"lat": case["lat"], "lng": case["lng"]},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["name"]
    assert body["placeKey"]
    assert body["source"] == "nominatim"
    assert body["lat"] == case["lat"]
    assert body["lng"] == case["lng"]


def test_reverse_api_mocked_empty_for_upstream_failure():
    payload = _load_battery()
    case = payload["cases"][0]

    mock_response = MagicMock()
    mock_response.status_code = 503
    mock_response.json.return_value = {"error": "upstream"}

    with patch(
        "app.services.geocoding_service.httpx.AsyncClient",
        return_value=_mock_async_client_get(mock_response),
    ):
        res = client.get(
            "/api/v1/geocoding/reverse",
            params={"lat": case["lat"], "lng": case["lng"]},
        )

    assert res.status_code == 200
    assert res.json() == {}


@pytest.mark.geocoding_live
def test_reverse_api_live_anchor_greenland():
    """Quick live smoke — full 1,015-case report: python scripts/run_geocoding_battery_report.py"""
    payload = _load_battery()
    case = next(c for c in payload["cases"] if c["id"] == "anchor-001")
    res = client.get(
        "/api/v1/geocoding/reverse",
        params={"lat": case["lat"], "lng": case["lng"]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body
    assert body.get("country") or body.get("name")
