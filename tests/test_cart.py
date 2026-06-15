from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.auth import get_current_user
from app.schemas.cart import CartItemResponse, CartConvertToTripResponse, CartCountResponse
from app.utils.exceptions import AppException

client = TestClient(app)

def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000033")
    user.email = "cart@example.com"
    user.full_name = "Cart Tester"
    user.is_active = True
    return user

@pytest.fixture(autouse=True)
def _reset_auth():
    yield
    app.dependency_overrides.pop(get_current_user, None)

@pytest.fixture
def auth():
    app.dependency_overrides[get_current_user] = _mock_user
    yield {}
    app.dependency_overrides.pop(get_current_user, None)

def test_cart_requires_auth_401():
    r = client.get("/api/v1/cart")
    assert r.status_code == 401

def test_add_item_to_cart(auth, monkeypatch):
    item_id = uuid.uuid4()
    item_resp = CartItemResponse(
        id=item_id,
        user_id=uuid.UUID("00000000-0000-0000-0000-000000000033"),
        item_type="activity",
        item_id="act_123",
        item_name="Eiffel Tower Tour",
        item_image="https://example.com/eiffel.jpg",
        item_category="Activity",
        place_name="Eiffel Tower",
        full_address="Champ de Mars, Paris, France",
        lat=48.8584,
        lng=2.2945,
        price_range="$$",
        rating=4.8,
        source="explore",
        source_url="https://example.com/eiffel",
        added_at=datetime.now(timezone.utc)
    )

    def fake_add(db, user_id, data):
        assert user_id == uuid.UUID("00000000-0000-0000-0000-000000000033")
        assert data.item_name == "Eiffel Tower Tour"
        return item_resp

    monkeypatch.setattr(
        "app.services.cart_service.CartService.add_item",
        fake_add
    )

    r = client.post(
        "/api/v1/cart",
        json={
            "item_type": "activity",
            "item_id": "act_123",
            "item_name": "Eiffel Tower Tour",
            "item_image": "https://example.com/eiffel.jpg",
            "item_category": "Activity",
            "place_name": "Eiffel Tower",
            "full_address": "Champ de Mars, Paris, France",
            "lat": 48.8584,
            "lng": 2.2945,
            "price_range": "$$",
            "rating": 4.8,
            "source": "explore",
            "source_url": "https://example.com/eiffel"
        }
    )
    assert r.status_code == 210 or r.status_code == 201
    assert r.json()["item_name"] == "Eiffel Tower Tour"

def test_duplicate_item_returns_409(auth, monkeypatch):
    def fake_add_dup(db, user_id, data):
        raise AppException.conflict("Item is already in your travel cart")

    monkeypatch.setattr(
        "app.services.cart_service.CartService.add_item",
        fake_add_dup
    )

    r = client.post(
        "/api/v1/cart",
        json={
            "item_type": "activity",
            "item_id": "act_123",
            "item_name": "Eiffel Tower Tour"
        }
    )
    assert r.status_code == 409
    assert "already in your travel cart" in r.json()["detail"]

def test_remove_item_from_cart(auth, monkeypatch):
    called = []
    def fake_remove(db, user_id, item_id):
        assert user_id == uuid.UUID("00000000-0000-0000-0000-000000000033")
        assert item_id == "act_123"
        called.append(True)

    monkeypatch.setattr(
        "app.services.cart_service.CartService.remove_item",
        fake_remove
    )

    r = client.delete("/api/v1/cart/act_123")
    assert r.status_code == 200
    assert called == [True]

def test_get_cart_returns_user_items_only(auth, monkeypatch):
    item_id = uuid.uuid4()
    item_resp = CartItemResponse(
        id=item_id,
        user_id=uuid.UUID("00000000-0000-0000-0000-000000000033"),
        item_type="activity",
        item_name="Eiffel Tower Tour",
        lat=48.8584,
        lng=2.2945,
        source="explore",
        added_at=datetime.now(timezone.utc)
    )

    monkeypatch.setattr(
        "app.services.cart_service.CartService.get_cart_items",
        lambda db, user_id: [item_resp]
    )

    r = client.get("/api/v1/cart")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["item_name"] == "Eiffel Tower Tour"

def test_clear_cart(auth, monkeypatch):
    called = []
    def fake_clear(db, user_id):
        assert user_id == uuid.UUID("00000000-0000-0000-0000-000000000033")
        called.append(True)

    monkeypatch.setattr(
        "app.services.cart_service.CartService.clear_cart",
        fake_clear
    )

    r = client.delete("/api/v1/cart")
    assert r.status_code == 200
    assert called == [True]

def test_convert_cart_to_trip(auth, monkeypatch):
    trip_uuid = uuid.uuid4()
    selected_ids = [uuid.uuid4(), uuid.uuid4()]

    def fake_convert(db, user, data):
        assert user.id == uuid.UUID("00000000-0000-0000-0000-000000000033")
        assert data.trip_name == "Paris Vacation"
        assert data.selected_item_ids == selected_ids
        return trip_uuid

    monkeypatch.setattr(
        "app.services.cart_service.CartService.convert_to_trip",
        fake_convert
    )

    r = client.post(
        "/api/v1/cart/convert-to-trip",
        json={
            "trip_name": "Paris Vacation",
            "selected_item_ids": [str(x) for x in selected_ids]
        }
    )
    assert r.status_code == 200
    assert r.json()["trip_id"] == str(trip_uuid)
