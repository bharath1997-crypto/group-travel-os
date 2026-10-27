"""Country-wide Ticketmaster sources and country stamping (non-US worlds)."""
from __future__ import annotations

from datetime import datetime, timezone

import httpx
import pytest
from pydantic import ValidationError

from scaper import pipeline
from scaper.connectors.ticketmaster import TicketmasterConnector, TicketmasterCountryConfig
from scaper.http import RetryingClient
from scaper.models import Source
from tests.scaper_fixtures import ticketmaster_event, ticketmaster_page

NOW = datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)


def _connector(handler) -> TicketmasterConnector:
    client = RetryingClient(
        httpx.Client(transport=httpx.MockTransport(handler), params={"apikey": "k"}),
        sleep=lambda _: None,
    )
    return TicketmasterConnector(api_key="k", client=client, now=lambda: NOW, page_delay=0)


def test_country_config_validation() -> None:
    connector = _connector(lambda r: httpx.Response(500))
    assert isinstance(connector.parse_config({"country_code": "gb", "days_ahead": 3}), TicketmasterCountryConfig)
    assert connector.parse_config({"country_code": "gb"}).country_code == "GB"
    for bad in ("US", "G", "G1", "GBR"):
        with pytest.raises(ValidationError):
            connector.parse_config({"country_code": bad})


def test_country_fetch_sends_country_code_without_state_or_geo() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=ticketmaster_page([ticketmaster_event(id="gb1")], number=0, total_pages=1, total=1))

    connector = _connector(handler)
    items = list(connector.fetch({"country_code": "GB", "days_ahead": 3}))
    assert [i.external_id for i in items] == ["gb1"]
    params = seen[0].url.params
    assert params["countryCode"] == "GB"
    assert "stateCode" not in params and "latlong" not in params
    assert connector.last_fetch_complete is True


def _source(**kw) -> Source:
    return Source(id="00000000-0000-0000-0000-000000000001", connector="ticketmaster", name="t", config=kw.pop("config"), **kw)


def test_country_sources_take_the_city_from_each_venue() -> None:
    assert pipeline._is_state_source(_source(config={"country_code": "GB"})) is True
    assert pipeline._is_state_source(_source(config={"state_code": "TX"})) is True
    assert pipeline._is_state_source(_source(config={"lat": 1.0, "lng": 2.0}, city_slug="chicago")) is False


def test_country_code_helper() -> None:
    from scaper.store import _country_code

    class V:
        def __init__(self, country):
            self.country = country

    assert _country_code(V("gb")) == "GB"
    assert _country_code(V(" us ")) == "US"
    assert _country_code(V("United Kingdom")) is None
    assert _country_code(V(None)) is None
    assert _country_code(None) is None


def test_reader_defaults_to_us_and_reports_real_country() -> None:
    from app.services.explore_scaper_events import _country_param, _event_row

    assert _country_param(None) == "US"
    assert _country_param("gb") == "GB"
    assert _country_param("Britain") == "US"
    row = {
        "id": "1", "title": "t", "start_time": NOW, "category": None, "venue_name": "v", "image_url": None,
        "ticket_url": None, "price_min": None, "price_max": None, "is_free": None, "status": "scheduled",
        "provider": "ticketmaster", "lat": 1.0, "lng": 2.0, "timezone": "Europe/London",
    }
    assert _event_row({**row, "country_code": "GB"}, "London")["country"] == "GB"
    assert _event_row(row, "Chicago")["country"] == "US"
