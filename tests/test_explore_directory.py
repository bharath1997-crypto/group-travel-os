"""Explore directory API and service (public v2 routes)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.places_directory import PlacesDirectoryRow
from app.services.explore_directory_rate_limit import clear_directory_rate_limit_for_tests
from app.services.explore_directory_service import (
    clear_event_counts_cache_for_tests,
    event_counts_by_city_slug,
    get_state_page,
    list_states,
    _count_places_near,
)
from app.utils.database import get_db

STATES_URL = "/api/v2/explorer/directory/states"
SEARCH_URL = "/api/v2/explorer/directory/search"
ILLINOIS_URL = "/api/v2/explorer/directory/illinois"
CHICAGO_URL = "/api/v2/explorer/directory/illinois/chicago"
NEARBY_URL = "/api/v2/explorer/directory/nearest"


@pytest.fixture(autouse=True)
def _reset_directory_caches():
    clear_event_counts_cache_for_tests()
    clear_directory_rate_limit_for_tests()
    yield
    clear_event_counts_cache_for_tests()
    clear_directory_rate_limit_for_tests()


@pytest.fixture()
def pg_db():
    mock = MagicMock()
    mock.bind.dialect.name = "postgresql"
    app.dependency_overrides[get_db] = lambda: mock
    yield mock
    app.dependency_overrides.pop(get_db, None)


def test_directory_states_success(pg_db) -> None:
    with patch(
        "app.routers.explorer_v2.list_states",
        return_value=[{"slug": "illinois", "name": "Illinois", "state_code": "IL", "population": None, "event_count": 0}],
    ):
        body = TestClient(app).get(STATES_URL).json()
    assert body[0]["slug"] == "illinois"


def test_directory_search_validation_422(pg_db) -> None:
    assert TestClient(app).get(SEARCH_URL, params={"q": "a"}).status_code == 422


def test_directory_search_success(pg_db) -> None:
    with patch(
        "app.routers.explorer_v2.search_directory",
        return_value=[
            {
                "kind": "city",
                "slug": "chicago",
                "name": "Chicago",
                "state_code": "IL",
                "state_slug": "illinois",
                "state_name": "Illinois",
                "population": 2_746_388,
                "event_count": 0,
            }
        ],
    ):
        body = TestClient(app).get(SEARCH_URL, params={"q": "Chi"}).json()
    assert body[0]["slug"] == "chicago"


def test_directory_city_not_found_404(pg_db) -> None:
    from app.utils.exceptions import AppException

    def _raise(*_a, **_k):
        AppException.not_found("City not found")

    with patch("app.routers.explorer_v2.get_city_page", side_effect=_raise):
        res = TestClient(app).get(CHICAGO_URL)
    assert res.status_code == 404


def test_directory_nearest_validation_422(pg_db) -> None:
    assert TestClient(app).get(NEARBY_URL, params={"lat": 999, "lng": 0}).status_code == 422


def test_events_coverage_still_requires_auth_401() -> None:
    assert TestClient(app).get("/api/v2/explorer/events/coverage").status_code == 401


def test_directory_slugs_match_scaper() -> None:
    from app.services.explore_directory_slugs import directory_city_slug
    from app.services.explore_scaper_events import city_slug

    assert directory_city_slug("New York") == city_slug("New York")
    assert directory_city_slug("Chicago, IL") == city_slug("Chicago, IL")


def test_wikipedia_from_db_not_live_fetch() -> None:
    db = MagicMock()
    db.bind.dialect.name = "postgresql"
    state = PlacesDirectoryRow(
        kind="state",
        slug="illinois",
        name="Illinois",
        state_code="IL",
        state_slug="",
        wikipedia_title="Illinois",
        wikipedia_extract="Illinois is a state in the Midwest.",
        wikipedia_url="https://en.wikipedia.org/wiki/Illinois",
    )
    with (
        patch("app.services.explore_directory_service._state_row", return_value=state),
        patch("app.services.explore_directory_service._cities_grouped_by_state", return_value={"illinois": []}),
        patch("app.services.explore_directory_service.event_counts_by_city_slug", return_value={}),
    ):
        page = get_state_page(db, "illinois")
    assert page["wikipedia"]["extract"].startswith("Illinois is a state")
    assert "Source: Wikipedia, CC BY-SA" in page["wikipedia"]["attribution"]


def test_count_places_near_savepoint_allows_followup_query() -> None:
    db = MagicMock()
    db.bind.dialect.name = "postgresql"
    nested = MagicMock()
    db.begin_nested.return_value = nested
    nested.__enter__ = MagicMock(return_value=None)
    nested.__exit__ = MagicMock(return_value=False)

    ok = MagicMock()
    ok.scalar.return_value = 1
    db.execute.side_effect = [RuntimeError("st_dwithin failed"), ok]

    assert _count_places_near(db, lat=41.88, lng=-87.63) == 0
    follow_up = db.execute("SELECT 1")
    assert follow_up.scalar() == 1


def test_event_counts_cached_for_five_minutes() -> None:
    db = MagicMock()
    calls = {"n": 0}

    def _coverage(_db):
        calls["n"] += 1
        return [{"cities": [{"slug": "chicago", "events": 4}]}]

    with patch("app.services.explore_directory_service.scaper_coverage", side_effect=_coverage):
        first = event_counts_by_city_slug(db)
        second = event_counts_by_city_slug(db)
    assert first["chicago"] == 4
    assert second["chicago"] == 4
    assert calls["n"] == 1


def test_list_states_loads_cities_in_one_grouped_query() -> None:
    db = MagicMock()
    db.bind.dialect.name = "postgresql"
    calls: list[str] = []

    def _all_rows(_db, kind: str):
        calls.append(kind)
        if kind == "state":
            return [
                PlacesDirectoryRow(
                    kind="state",
                    slug="illinois",
                    name="Illinois",
                    state_code="IL",
                    state_slug="",
                )
            ]
        return [
            PlacesDirectoryRow(
                kind="city",
                slug="chicago",
                name="Chicago",
                state_code="IL",
                state_slug="illinois",
            )
        ]

    with (
        patch("app.services.explore_directory_service.event_counts_by_city_slug", return_value={"chicago": 2}),
        patch("app.services.explore_directory_service._all_directory_rows", side_effect=_all_rows),
    ):
        result = list_states(db)
    assert result[0]["event_count"] == 2
    assert calls.count("city") == 1
    assert calls.count("state") == 1


def test_import_dry_run_prints_counts_only(capsys) -> None:
    import subprocess
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    proc = subprocess.run(
        [sys.executable, str(root / "scripts" / "014_import_city_directory.py"), "--dry-run"],
        cwd=str(root),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0
    assert "Total rows:" in proc.stdout
    assert "Counts per state:" in proc.stdout
