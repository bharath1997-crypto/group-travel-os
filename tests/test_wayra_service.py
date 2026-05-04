"""Tests for Wayra Explorer suggestion helper (Gemini-backed, defensive)."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.schemas.explorer import ExplorerResultItem
from app.services.wayra_service import WayraService


@pytest.fixture()
def tm_item() -> ExplorerResultItem:
    return ExplorerResultItem(
        source="ticketmaster",
        source_type="ticketmaster",
        type="event",
        title="Jazz Fest",
        id="tm-1",
        venue="Theater District",
        city="Chicago",
        date_str="2026-06-01",
        dateLabel="Jun 1",
        price_from=35.0,
        priceLabel="From $35",
    )


@pytest.fixture()
def yelp_item() -> ExplorerResultItem:
    return ExplorerResultItem(
        source="yelp",
        source_type="yelp",
        type="place",
        title="Brunch Spot",
        id="ye-1",
        venue="Wicker Park",
        city="Chicago",
    )


def test_wayra_missing_key_returns_none(monkeypatch, tm_item):
    monkeypatch.setattr("app.services.wayra_service.settings.gemini_api_key", None)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    out = WayraService().generate_explorer_suggestion("coffee", "Chicago", [tm_item])
    assert out is None


def test_wayra_empty_results_returns_none(monkeypatch, tm_item):
    monkeypatch.setattr("app.services.wayra_service.settings.gemini_api_key", "test-key")

    assert WayraService().generate_explorer_suggestion("coffee", "Chicago", []) is None


def test_wayra_empty_query_returns_none(monkeypatch, tm_item):
    monkeypatch.setattr("app.services.wayra_service.settings.gemini_api_key", "test-key")

    assert WayraService().generate_explorer_suggestion("", "Chicago", [tm_item]) is None


def test_wayra_no_ticketmaster_or_yelp_in_results_returns_none(monkeypatch):
    monkeypatch.setattr("app.services.wayra_service.settings.gemini_api_key", "test-key")
    gp = ExplorerResultItem(
        source="google_places",
        source_type="google_places",
        type="place",
        title="Museum",
        id="gp-1",
        venue="Downtown",
        city="Chicago",
    )

    out = WayraService().generate_explorer_suggestion("art", "Chicago", [gp])
    assert out is None


def test_wayra_gemini_failure_returns_none(monkeypatch, tm_item):
    monkeypatch.setattr("app.services.wayra_service.settings.gemini_api_key", "test-key")
    monkeypatch.setattr(
        "app.services.wayra_service._call_gemini_explorer_suggestion",
        MagicMock(side_effect=RuntimeError("network")),
    )

    assert WayraService().generate_explorer_suggestion("jazz", "Chicago", [tm_item]) is None


def test_wayra_success_returns_suggestion(monkeypatch, tm_item, yelp_item):
    monkeypatch.setattr("app.services.wayra_service.settings.gemini_api_key", "test-key")

    def fake_call(*, api_key: str, query: str, location: str, results_minimal: list) -> str:
        assert api_key == "test-key"
        assert query == "jazz brunch"
        assert location == "Chicago"
        assert len(results_minimal) <= 5
        return "Suggested copy."

    monkeypatch.setattr(
        "app.services.wayra_service._call_gemini_explorer_suggestion",
        fake_call,
    )

    txt = WayraService().generate_explorer_suggestion(
        "jazz brunch",
        "Chicago",
        [tm_item, yelp_item],
    )
    assert txt == "Suggested copy."
