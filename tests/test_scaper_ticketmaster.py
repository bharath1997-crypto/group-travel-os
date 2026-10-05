"""Ticketmaster connector: extraction mapping, paging completeness, key handling."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
import pytest
from pydantic import ValidationError

from scaper.connectors.ticketmaster import TicketmasterConnector, venue_city_and_state
from scaper.http import ConnectorError, RetryingClient
from scaper.models import EventRecord, RawItem, Rejected
from tests.scaper_fixtures import ticketmaster_event, ticketmaster_page

NOW = datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)
CONFIG = {"lat": 28.5417, "lng": -81.3776, "radius_km": 15}


def _connector(handler) -> TicketmasterConnector:
    client = RetryingClient(
        httpx.Client(transport=httpx.MockTransport(handler), params={"apikey": "k"}),
        sleep=lambda _: None,
    )
    return TicketmasterConnector(api_key="k", client=client, now=lambda: NOW, page_delay=0)


def _extract(**overrides) -> EventRecord | Rejected:
    return _connector(lambda r: httpx.Response(500)).extract(ticketmaster_event(**overrides))


def _event(**overrides) -> EventRecord:
    result = _extract(**overrides)
    assert isinstance(result, EventRecord), result
    return result


# ── extract ───────────────────────────────────────────────────────────────

def test_extract_maps_onsale_event() -> None:
    event = _event()
    assert event.external_id == "tmEvent0001"
    assert event.title == "Indie Night Live"
    assert event.description == "All ages."
    assert event.category == "music"  # primary classification wins
    assert event.starts_at == datetime(2026, 10, 3, 0, 0, tzinfo=timezone.utc)
    assert event.ends_at is None
    assert event.timezone == "America/New_York"
    assert event.status == "scheduled"
    assert (event.price_min, event.price_max, event.currency) == (20.0, 52.0, "USD")
    assert event.is_free is None
    assert event.image_url == "https://s1.ticketm.net/wide.jpg"  # widest non-fallback 16:9
    assert event.venue is not None
    assert event.venue.external_id == "tmVenue0001"
    assert (event.venue.lat, event.venue.lng) == (28.5598651, -81.3647185)
    assert event.venue.overture_address() == {
        "freeform": "1042 N Mills Ave",
        "locality": "Orlando",
        "region": "FL",
        "postcode": "32803",
        "country": "US",
    }


@pytest.mark.parametrize(
    ("code", "status"),
    [
        ("onsale", "scheduled"),
        ("offsale", "scheduled"),
        ("rescheduled", "scheduled"),
        ("postponed", "postponed"),
        ("cancelled", "cancelled"),
    ],
)
def test_extract_status_mapping(code, status) -> None:
    dates = ticketmaster_event()["dates"] | {"status": {"code": code}}
    assert _event(dates=dates).status == status


def test_extract_end_time_and_missing_prices() -> None:
    dates = ticketmaster_event()["dates"] | {"end": {"dateTime": "2026-10-03T03:00:00Z"}}
    event = _event(dates=dates, priceRanges=None)
    assert event.ends_at == datetime(2026, 10, 3, 3, 0, tzinfo=timezone.utc)
    assert (event.price_min, event.price_max, event.currency, event.is_free) == (None, None, None, None)


@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"test": True}, "test event"),
        ({"name": " "}, "missing title"),
        (
            {"dates": {"status": {"code": "onsale"}, "start": {"localDate": "2026-10-02", "timeTBA": True}}},
            "missing start time",
        ),
        ({"dates": {"status": {"code": "weird"}, "start": {"dateTime": "2026-10-03T00:00:00Z"}}}, "status weird"),
        ({"_embedded": {}}, "no venue coordinates"),
        ({"_embedded": {"venues": [{"id": "v", "name": "No Geo"}]}}, "no venue coordinates"),
    ],
)
def test_extract_rejects(overrides, reason) -> None:
    result = _extract(**overrides)
    assert isinstance(result, Rejected)
    assert result.reason == reason


# ── fetch ─────────────────────────────────────────────────────────────────

def test_fetch_pages_window_and_strips_volatile_fields() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        page = int(request.url.params["page"])
        return httpx.Response(
            200,
            json=ticketmaster_page([ticketmaster_event(id=f"e{page}")], number=page, total_pages=2, total=250),
        )

    connector = _connector(handler)
    items = list(connector.fetch(CONFIG))

    assert [i.external_id for i in items] == ["e0", "e1"]
    assert connector.last_fetch_complete is True
    params = seen[0].url.params
    assert params["apikey"] == "k"
    assert (params["latlong"], params["radius"], params["unit"], params["size"]) == (
        "28.5417,-81.3776",
        "15",
        "km",
        "200",
    )
    assert params["startDateTime"] == "2026-09-26T06:00:00Z"  # 6h lookback keeps in-progress events
    assert params["endDateTime"] == "2026-10-10T12:00:00Z"
    assert not {"distance", "units", "_links"} & items[0].payload.keys()


def test_payload_hash_independent_of_query_distance() -> None:
    def item(distance: float) -> RawItem:
        body = ticketmaster_page([ticketmaster_event(distance=distance)], number=0, total_pages=1, total=1)
        return next(iter(_connector(lambda r: httpx.Response(200, json=body)).fetch(CONFIG)))

    assert item(1.0).sha256 == item(9.5).sha256


def test_empty_result_is_complete() -> None:
    body = ticketmaster_page([], number=0, total_pages=0, total=0)
    connector = _connector(lambda r: httpx.Response(200, json=body))
    assert list(connector.fetch(CONFIG)) == []
    assert connector.last_fetch_complete is True


def test_results_beyond_deep_paging_cap_are_incomplete() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        page = int(request.url.params["page"])
        body = ticketmaster_page([ticketmaster_event(id=f"e{page}")], number=page, total_pages=9, total=1700)
        return httpx.Response(200, json=body)

    connector = _connector(handler)
    assert len(list(connector.fetch(CONFIG))) == 5  # 5 pages * 200 = 1000 cap
    assert connector.last_fetch_complete is False


def test_bad_config_and_missing_key() -> None:
    with pytest.raises(ValidationError):
        list(_connector(lambda r: httpx.Response(200)).fetch({"lat": 999, "lng": 0}))
    with pytest.raises(ConnectorError):
        TicketmasterConnector(api_key="")


def test_http_error_message_does_not_leak_key() -> None:
    connector = _connector(lambda r: httpx.Response(401, text="Invalid ApiKey"))
    with pytest.raises(ConnectorError) as exc:
        list(connector.fetch(CONFIG))
    assert "apikey=" not in str(exc.value)


# ── state mode ────────────────────────────────────────────────────────────

STATE_CONFIG = {"state_code": "TX", "days_ahead": 60}


def test_state_config_validation() -> None:
    from scaper.connectors.ticketmaster import TicketmasterStateConfig

    connector = _connector(lambda r: httpx.Response(200, json=ticketmaster_page([], number=0, total_pages=0, total=0)))
    assert isinstance(connector.parse_config(STATE_CONFIG), TicketmasterStateConfig)
    with pytest.raises(ValidationError):
        connector.parse_config({"state_code": "XX", "days_ahead": 60})
    with pytest.raises(ValidationError):
        connector.parse_config({"state_code": "T", "days_ahead": 60})


def test_state_fetch_uses_country_and_state_params() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json=ticketmaster_page([ticketmaster_event(id="tx1")], number=0, total_pages=1, total=1),
        )

    connector = _connector(handler)
    items = list(connector.fetch(STATE_CONFIG))
    assert [i.external_id for i in items] == ["tx1"]
    params = seen[0].url.params
    assert params["countryCode"] == "US" and params["stateCode"] == "TX"
    assert "latlong" not in params
    assert connector.api_calls_used == 1


def test_window_bisect_when_total_exceeds_cap() -> None:
    root = ("2026-09-26T06:00:00Z", "2026-11-25T12:00:00Z")
    windows: set[tuple[str, str]] = set()

    def handler(request: httpx.Request) -> httpx.Response:
        start = request.url.params["startDateTime"]
        end = request.url.params["endDateTime"]
        page = int(request.url.params["page"])
        windows.add((start, end))
        total = 2500 if (start, end) == root and page == 0 else 400
        body = ticketmaster_page([ticketmaster_event(id=f"{len(windows)}-{page}")], number=page, total_pages=2, total=total)
        return httpx.Response(200, json=body)

    connector = _connector(handler)
    list(connector.fetch(STATE_CONFIG))
    assert connector.last_fetch_complete is True
    assert len(windows) >= 2


def test_sub_hour_window_over_cap_is_incomplete() -> None:
    from scaper.connectors import ticketmaster as tm

    def handler(request: httpx.Request) -> httpx.Response:
        page = int(request.url.params["page"])
        if page > tm.MAX_PAGE_INDEX:
            raise AssertionError(f"requested page {page} past Discovery cap")
        body = ticketmaster_page([ticketmaster_event(id=f"e{page}")], number=page, total_pages=8, total=1500)
        return httpx.Response(200, json=body)

    connector = _connector(handler)
    base = {"countryCode": "US", "stateCode": "CA", "size": 200, "sort": "date,asc"}
    narrow_start = NOW - timedelta(minutes=30)
    narrow_end = NOW + timedelta(minutes=20)
    gen = connector._fetch_window(base, narrow_start, narrow_end)
    try:
        while True:
            next(gen)
    except StopIteration as stop:
        assert stop.value is False
    assert connector.api_calls_used <= 6


def test_venue_city_and_state_from_payload() -> None:
    payload = ticketmaster_event()
    assert venue_city_and_state(payload) == ("orlando", "FL")
    payload = ticketmaster_event(
        _embedded={"venues": [{"city": {"name": "New York"}, "state": {"stateCode": "NY"}, "location": {"latitude": "1", "longitude": "2"}, "id": "v", "name": "Hall"}]}
    )
    assert venue_city_and_state(payload) == ("new-york", "NY")
