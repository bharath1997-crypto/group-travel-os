"""Eventbrite connector: extraction mapping, pagination, and HTTP retry behaviour."""
from __future__ import annotations

from datetime import datetime, timezone

import httpx
import pytest
from pydantic import ValidationError

from scaper.connectors.eventbrite import EventbriteConnector
from scaper.http import ConnectorError, RetryingClient
from scaper.models import EventRecord, Rejected
from tests.scaper_fixtures import eventbrite_event, eventbrite_page


def _connector(handler) -> EventbriteConnector:
    client = RetryingClient(httpx.Client(transport=httpx.MockTransport(handler)), sleep=lambda _: None)
    return EventbriteConnector(token="test-token", client=client)


def _extract(**overrides) -> EventRecord | Rejected:
    return _connector(lambda r: httpx.Response(500)).extract(eventbrite_event(**overrides))


def _event(**overrides) -> EventRecord:
    result = _extract(**overrides)
    assert isinstance(result, EventRecord), result
    return result


# ── extract ───────────────────────────────────────────────────────────────

def test_extract_maps_live_event() -> None:
    event = _event()
    assert event.external_id == "1000000000001"
    assert event.title == "Rooftop Jazz Night"
    assert event.description == "Live jazz trio on the roof every Friday."
    assert event.category == "music"
    assert event.starts_at == datetime(2026, 10, 3, 0, 0, tzinfo=timezone.utc)
    assert event.ends_at == datetime(2026, 10, 3, 3, 0, tzinfo=timezone.utc)
    assert event.timezone == "America/Chicago"
    assert event.status == "scheduled"
    assert (event.price_min, event.price_max, event.currency) == (15.0, 40.0, "USD")
    assert event.is_free is False
    assert event.image_url == "https://img.evbuc.com/original.jpg"
    assert event.venue is not None
    assert event.venue.external_id == "7770001"
    assert (event.venue.lat, event.venue.lng) == (41.8881, -87.6298)
    assert event.venue.overture_address() == {
        "freeform": "100 W Wacker Dr",
        "locality": "Chicago",
        "region": "IL",
        "postcode": "60601",
        "country": "US",
    }


def test_extract_sold_out_and_cancelled_status() -> None:
    tickets = eventbrite_event()["ticket_availability"] | {"is_sold_out": True}
    assert _event(ticket_availability=tickets).status == "sold_out"
    assert _event(status="canceled").status == "cancelled"
    assert _event(status="started").status == "scheduled"


def test_extract_free_event_zeroes_prices() -> None:
    event = _event(is_free=True, ticket_availability={})
    assert (event.is_free, event.price_min, event.price_max) == (True, 0.0, 0.0)


def test_extract_falls_back_to_description_text_and_short_name() -> None:
    event = _event(summary=None, category_id=None, category={"id": "999", "short_name": "Other Stuff"})
    assert event.description == "Longer description"
    assert event.category == "other stuff"


@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"online_event": True}, "online event"),
        ({"listed": False}, "unlisted event"),
        ({"status": "draft"}, "status draft"),
        ({"name": {"text": "  "}}, "missing title"),
        ({"start": {"utc": None}}, "missing start time"),
        ({"venue": None}, "no venue coordinates"),
        ({"venue": {"id": "1", "name": "X", "latitude": "0", "longitude": "0", "address": {}}}, "no venue coordinates"),
        ({"venue": {"id": "1", "name": "X", "latitude": "abc", "longitude": "1", "address": {}}}, "no venue coordinates"),
    ],
)
def test_extract_rejects_events_explorer_cannot_place(overrides, reason) -> None:
    result = _extract(**overrides)
    assert isinstance(result, Rejected)
    assert result.reason == reason


# ── fetch ─────────────────────────────────────────────────────────────────

def test_fetch_follows_continuation_and_sends_auth() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if "continuation" not in request.url.params:
            return httpx.Response(200, json=eventbrite_page([eventbrite_event(id="1")], continuation="abc"))
        return httpx.Response(200, json=eventbrite_page([eventbrite_event(id="2")]))

    client = RetryingClient(
        httpx.Client(transport=httpx.MockTransport(handler), headers={"Authorization": "Bearer t"}),
        sleep=lambda _: None,
    )
    connector = EventbriteConnector(token="t", client=client)
    items = list(connector.fetch({"kind": "organizer", "id": "5550001"}))

    assert [i.external_id for i in items] == ["1", "2"]
    assert connector.last_fetch_complete is True
    assert seen[0].url.path == "/v3/organizers/5550001/events/"
    assert seen[0].url.params["status"] == "live,started,canceled"
    assert seen[0].url.params["expand"] == "venue,ticket_availability,category"
    assert seen[1].url.params["continuation"] == "abc"


def test_fetch_page_cap_marks_listing_incomplete() -> None:
    connector = _connector(
        lambda r: httpx.Response(200, json=eventbrite_page([eventbrite_event()], continuation="more"))
    )
    items = list(connector.fetch({"kind": "venue", "id": "7770001", "max_pages": 2}))
    assert len(items) == 2
    assert connector.last_fetch_complete is False


def test_fetch_rejects_bad_config() -> None:
    connector = _connector(lambda r: httpx.Response(200, json=eventbrite_page([])))
    with pytest.raises(ValidationError):
        list(connector.fetch({"kind": "search", "id": "chicago"}))


def test_missing_token_is_a_connector_error() -> None:
    with pytest.raises(ConnectorError):
        EventbriteConnector(token=" ")


# ── retrying client ───────────────────────────────────────────────────────

def test_retry_honours_retry_after_then_succeeds() -> None:
    calls = {"n": 0}
    sleeps: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "7"})
        if calls["n"] == 2:
            return httpx.Response(503)
        return httpx.Response(200, json={"ok": True})

    client = RetryingClient(httpx.Client(transport=httpx.MockTransport(handler)), sleep=sleeps.append)
    assert client.get_json("https://x.test/a") == {"ok": True}
    assert sleeps == [7.0, 2.0]


def test_non_retryable_status_fails_fast() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(401, text="INVALID_AUTH")

    client = RetryingClient(httpx.Client(transport=httpx.MockTransport(handler)), sleep=lambda _: None)
    with pytest.raises(ConnectorError, match="HTTP 401"):
        client.get_json("https://x.test/a")
    assert calls["n"] == 1


def test_retries_exhausted_raises() -> None:
    client = RetryingClient(
        httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(502))),
        max_attempts=3,
        sleep=lambda _: None,
    )
    with pytest.raises(ConnectorError, match="gave up after 3 attempts"):
        client.get_json("https://x.test/a")
