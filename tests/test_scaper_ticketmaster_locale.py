"""Country sources ask for every locale (France returned 32 events without it, thousands with it)."""
from __future__ import annotations

import httpx

from tests.test_scaper_country import _connector
from tests.test_scaper_ticketmaster import ticketmaster_event, ticketmaster_page


def _params(config: dict) -> httpx.QueryParams:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=ticketmaster_page([ticketmaster_event(id="e1")], number=0, total_pages=1, total=1))

    list(_connector(handler).fetch(config))
    return seen[0].url.params


def test_country_source_requests_all_locales() -> None:
    assert _params({"country_code": "FR", "days_ahead": 3})["locale"] == "*"


def test_state_source_request_is_unchanged() -> None:
    params = _params({"state_code": "NY", "days_ahead": 3})
    assert "locale" not in params
