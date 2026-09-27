"""Keyset pagination on GET /api/v2/explorer/events (body stays a list; cursor in X-Next-Cursor)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.auth import get_current_user
from app.utils.database import get_db

client = TestClient(app)
T0 = datetime(2026, 10, 1, 20, 0, tzinfo=timezone.utc)
PARAMS = {"lat": 28.54, "lng": -81.38}


def _row(n: int) -> dict:
    return {
        "id": uuid.UUID(int=n + 1),
        "title": f"Event {n}",
        "start_time": T0 + timedelta(hours=n),
        "end_time": None,
        "ticket_url": None,
        "price_min": None,
        "price_max": None,
        "category": "music",
        "lat": 28.54,
        "lng": -81.38,
    }


def _result(rows: list[dict]) -> MagicMock:
    result = MagicMock()
    result.mappings.return_value.all.return_value = rows
    return result


@pytest.fixture()
def db():
    mock = MagicMock()
    mock.bind.dialect.name = "postgresql"
    user = MagicMock(id=uuid.uuid4(), is_active=True)
    app.dependency_overrides[get_db] = lambda: mock
    app.dependency_overrides[get_current_user] = lambda: user
    yield mock
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)


def _sql(call) -> str:
    return str(call.args[0])


def test_default_limit_is_50_and_extra_row_sets_cursor(db) -> None:
    db.execute.return_value = _result([_row(n) for n in range(51)])
    response = client.get("/api/v2/explorer/events", params=PARAMS)

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list) and len(body) == 50
    assert response.headers["X-Next-Cursor"] == str(uuid.UUID(int=50))
    assert db.execute.call_args.args[1]["limit"] == 51
    assert "ORDER BY start_time ASC, id ASC" in _sql(db.execute.call_args)
    assert "(start_time, id) >" not in _sql(db.execute.call_args)


def test_last_page_has_no_cursor(db) -> None:
    db.execute.return_value = _result([_row(n) for n in range(3)])
    response = client.get("/api/v2/explorer/events", params=PARAMS | {"limit": 10})
    assert len(response.json()) == 3
    assert "X-Next-Cursor" not in response.headers


def test_after_id_resolves_cursor_and_applies_keyset(db) -> None:
    cursor = uuid.UUID(int=7)
    lookup = MagicMock()
    lookup.scalar.return_value = T0
    db.execute.side_effect = [lookup, _result([_row(7), _row(8)])]

    response = client.get("/api/v2/explorer/events", params=PARAMS | {"limit": 2, "after_id": str(cursor)})

    assert response.status_code == 200
    page_call = db.execute.call_args_list[1]
    assert "(start_time, id) > (:after_start, :after_id)" in _sql(page_call)
    assert page_call.args[1]["after_start"] == T0
    assert page_call.args[1]["after_id"] == cursor
    assert "X-Next-Cursor" not in response.headers


def test_unknown_cursor_is_400(db) -> None:
    lookup = MagicMock()
    lookup.scalar.return_value = None
    db.execute.return_value = lookup
    response = client.get("/api/v2/explorer/events", params=PARAMS | {"after_id": str(uuid.uuid4())})
    assert response.status_code == 400


@pytest.mark.parametrize("limit", [0, 201])
def test_limit_bounds(db, limit) -> None:
    assert client.get("/api/v2/explorer/events", params=PARAMS | {"limit": limit}).status_code == 422


def test_max_limit_200_accepted(db) -> None:
    db.execute.return_value = _result([])
    assert client.get("/api/v2/explorer/events", params=PARAMS | {"limit": 200}).status_code == 200


def test_cursor_header_exposed_to_browsers(db) -> None:
    db.execute.return_value = _result([_row(0), _row(1)])
    response = client.get(
        "/api/v2/explorer/events",
        params=PARAMS | {"limit": 1},
        headers={"Origin": "http://localhost:3000"},
    )
    assert "x-next-cursor" in response.headers.get("access-control-expose-headers", "").lower()
