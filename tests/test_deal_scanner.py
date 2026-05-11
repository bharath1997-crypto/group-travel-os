from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.schemas.flight_preferences import FlightPreferencesRead
from app.schemas.flight import FlightResult
from app.utils.auth import get_current_user

client = TestClient(app)


def _flight_result(fid: str, price: float) -> FlightResult:
    return FlightResult(
        id=fid,
        price=price,
        currency="USD",
        airlines=["AA"],
        departure_at="2026-06-01T10:00:00.000000Z",
        arrival_at="2026-06-02T08:00:00.000000Z",
        origin="ORD",
        destination="LON",
        duration_minutes=400,
        deep_link="https://example.test/deep",
        stops=1,
    )


def _prefs_user(**kwargs):
    u = MagicMock()
    u.id = uuid.UUID("00000000-0000-0000-0000-000000000007")
    u.deal_alerts_enabled = kwargs.get("deal_alerts_enabled", True)
    u.home_airport = kwargs.get("home_airport", "ORD")
    u.deal_price_threshold = kwargs.get("deal_price_threshold", 300.0)
    return u


@pytest.fixture(autouse=True)
def _reset_auth_overrides_after_test():
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_scan_skips_user_with_alerts_disabled(monkeypatch):
    db = MagicMock(spec=Session)
    u = _prefs_user(deal_alerts_enabled=False)

    svc_search = MagicMock()
    monkeypatch.setattr(
        "app.services.deal_scanner_service.FlightService.search_flights",
        svc_search,
    )
    from app.services.deal_scanner_service import DealScannerService

    n = DealScannerService().scan_deals_for_user(db, u)
    assert n == 0
    svc_search.assert_not_called()


def test_scan_skips_user_with_no_home_airport(monkeypatch):
    db = MagicMock(spec=Session)
    u = _prefs_user(home_airport=None)

    svc_search = MagicMock()
    monkeypatch.setattr(
        "app.services.deal_scanner_service.FlightService.search_flights",
        svc_search,
    )
    from app.services.deal_scanner_service import DealScannerService

    n = DealScannerService().scan_deals_for_user(db, u)
    assert n == 0
    svc_search.assert_not_called()


def test_scan_sends_notification_when_deal_found(monkeypatch):
    db = MagicMock(spec=Session)
    u = _prefs_user()
    monkeypatch.setattr(
        "app.services.deal_scanner_service.FlightService.search_flights",
        lambda **kw: [_flight_result("x1", 199.0)],
    )
    notif = MagicMock()
    monkeypatch.setattr(
        "app.services.deal_scanner_service.NotificationService.create_notification",
        notif,
    )

    from app.services.deal_scanner_service import DealScannerService

    n = DealScannerService().scan_deals_for_user(db, u)
    assert n == 1
    notif.assert_called_once()


def test_scan_no_notification_when_price_above_threshold(monkeypatch):
    db = MagicMock(spec=Session)
    u = _prefs_user(deal_price_threshold=100.0)
    monkeypatch.setattr(
        "app.services.deal_scanner_service.FlightService.search_flights",
        lambda **kw: [_flight_result("x2", 500.0)],
    )
    notif = MagicMock()
    monkeypatch.setattr(
        "app.services.deal_scanner_service.NotificationService.create_notification",
        notif,
    )
    from app.services.deal_scanner_service import DealScannerService

    n = DealScannerService().scan_deals_for_user(db, u)
    assert n == 0
    notif.assert_not_called()


def _mock_auth_user():
    u = MagicMock()
    u.id = uuid.UUID("00000000-0000-4000-a000-000000000099")
    u.email = "dealstest@example.com"
    u.full_name = "Deal Test"
    u.is_active = True
    return u


def test_flight_preferences_update_endpoint_200(monkeypatch):
    app.dependency_overrides[get_current_user] = _mock_auth_user

    out = FlightPreferencesRead(
        home_airport="ORD",
        deal_price_threshold=299.0,
        deal_alerts_enabled=True,
    )

    def _patch(db, cu, body):
        assert cu.id == uuid.UUID("00000000-0000-4000-a000-000000000099")
        assert body.home_airport.strip().upper() == "ORD"
        return out

    monkeypatch.setattr(
        "app.routes.users.UserFlightPreferenceService.update_flight_preferences",
        _patch,
    )

    r = client.patch(
        "/api/v1/users/me/flight-preferences",
        json={
            "home_airport": "ORD",
            "deal_price_threshold": 299.0,
            "deal_alerts_enabled": True,
        },
    )

    assert r.status_code == 200
    j = r.json()
    assert j["home_airport"] == "ORD"
    assert j["deal_price_threshold"] == 299.0
    assert j["deal_alerts_enabled"] is True


def test_flight_preferences_requires_auth_401():
    r = client.get("/api/v1/users/me/flight-preferences")
    assert r.status_code == 401


def test_invalid_iata_code_422():
    app.dependency_overrides[get_current_user] = _mock_auth_user

    r = client.patch(
        "/api/v1/users/me/flight-preferences",
        json={
            "home_airport": "CHICAGO",
            "deal_price_threshold": 200.0,
            "deal_alerts_enabled": True,
        },
    )

    assert r.status_code == 422
