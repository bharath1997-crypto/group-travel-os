"""GET /api/v2/explorer/events/coverage: states -> cities with live event counts."""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.auth import get_current_user
from app.utils.database import get_db

URL = "/api/v2/explorer/events/coverage"


def _rows(*rows: tuple) -> MagicMock:
    result = MagicMock()
    result.mappings.return_value.all.return_value = [
        {"state_code": s, "city_slug": c, "events": n} for s, c, n in rows
    ]
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


def test_groups_cities_under_states_largest_first(db) -> None:
    db.execute.return_value = _rows(
        ("CA", "los-angeles", 840), ("CA", "san-francisco", 685), ("IL", "chicago", 437), ("TX", "houston", 530)
    )
    body = TestClient(app).get(URL).json()
    assert [s["state_code"] for s in body] == ["CA", "TX", "IL"]
    assert body[0]["events"] == 1525
    assert body[0]["cities"][0] == {"slug": "los-angeles", "name": "Los Angeles", "events": 840}


def test_state_without_code_is_kept_with_null(db) -> None:
    db.execute.return_value = _rows(("", "orlando", 3))
    body = TestClient(app).get(URL).json()
    assert body == [{"state_code": None, "events": 3, "cities": [{"slug": "orlando", "name": "Orlando", "events": 3}]}]


def test_query_uses_visibility_rules(db) -> None:
    db.execute.return_value = _rows()
    TestClient(app).get(URL)
    sql = str(db.execute.call_args.args[0])
    assert "duplicate_of" in sql and "status IN" in sql and "source_id IS NOT NULL" in sql


def test_non_postgres_returns_empty() -> None:
    mock = MagicMock()
    mock.bind.dialect.name = "sqlite"
    app.dependency_overrides[get_db] = lambda: mock
    app.dependency_overrides[get_current_user] = lambda: MagicMock(id=uuid.uuid4(), is_active=True)
    try:
        assert TestClient(app).get(URL).json() == []
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


def test_requires_auth() -> None:
    assert TestClient(app).get(URL).status_code == 401
