"""Venue-list tools: calendar checker, chain filter and the feed-source dry-run planner.

All HTTP is mocked and nothing touches a database.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
import pytest

from scaper import venue_feed_check as vfc
from scaper import venue_feed_plan as plan
from scaper.venue_overture_match import is_chain

FUTURE = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y%m%dT%H%M%SZ")
PAST = "20200101T200000Z"


def _ics(start: str) -> str:
    return "\r\n".join(
        ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:a@x", "SUMMARY:Show",
         f"DTSTART:{start}", "END:VEVENT", "END:VCALENDAR"]
    )


def _jsonld(start_iso: str) -> str:
    return (
        '<html><script type="application/ld+json">'
        '{"@type":"Event","name":"Show","startDate":"%s"}'
        "</script></html>" % start_iso
    )


def _row(**over: str) -> dict[str, str]:
    base = {
        "state_code": "IL", "city": "Chicago", "venue_name": "Hall", "street_address": "1 Main St",
        "website_url": "https://hall.example", "calendar_url": "https://hall.example/events",
    }
    return {**base, **over}


def _checker(handler) -> vfc.Checker:
    return vfc.Checker(client=httpx.Client(transport=httpx.MockTransport(handler)))


def _site(body: str, robots: str = "", status: int = 200):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200 if robots else 404, text=robots)
        return httpx.Response(status, text=body)

    return handler


# ── checker ──────────────────────────────────────────────────────────────

def test_ics_with_future_event_is_ok():
    res = _checker(_site(_ics(FUTURE))).check(2, _row())
    assert (res.status, res.kind) == ("ok", "ics") and res.future_events == 1


def test_jsonld_future_event_is_ok():
    future_iso = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    res = _checker(_site(_jsonld(future_iso))).check(2, _row())
    assert (res.status, res.kind) == ("ok", "jsonld")


def test_past_only_events_need_a_check():
    res = _checker(_site(_ics(PAST))).check(2, _row())
    assert res.status == "check" and "no future events" in res.reason


def test_plain_page_needs_a_check():
    res = _checker(_site("<html>nothing here</html>")).check(2, _row())
    assert res.status == "check" and "no machine-readable events" in res.reason


def test_ics_link_is_reported():
    body = '<a href="/cal/feed.ics">Subscribe</a>'
    res = _checker(_site(body)).check(2, _row())
    assert res.status == "check" and res.ics_link == "https://hall.example/cal/feed.ics"


def test_http_error_is_rejected():
    res = _checker(_site("", status=404)).check(2, _row())
    assert res.status == "rejected" and res.reason == "HTTP 404"


def test_robots_disallow_is_rejected():
    res = _checker(_site(_ics(FUTURE), robots="User-agent: *\nDisallow: /")).check(2, _row())
    assert res.status == "rejected" and "robots" in res.reason


def test_calendar_on_other_site_is_check_not_ok():
    res = _checker(_site(_ics(FUTURE))).check(2, _row(website_url="https://other.example"))
    assert res.status == "check" and "different site" in res.reason


@pytest.mark.parametrize(
    "host", ["meetup.com", "facebook.com", "instagram.com", "eventbrite.com", "ticketmaster.com"]
)
def test_blocked_sources_are_rejected_without_fetching(host):
    def boom(request: httpx.Request) -> httpx.Response:  # must never be called
        raise AssertionError("fetched a blocked source")

    res = _checker(boom).check(2, _row(calendar_url=f"https://www.{host}/e/1"))
    assert res.status == "rejected" and "not allowed" in res.reason


def test_bad_rows_are_rejected():
    assert vfc._validate(_row(state_code="Illinois")) == "bad state_code"
    assert vfc._validate(_row(calendar_url="https")) == "calendar_url is not a usable http(s) URL"
    assert vfc._validate(_row(venue_name=" ")) == "missing venue_name"


def test_duplicate_calendar_urls_are_checked_once():
    rows = [_row(venue_name="A"), _row(venue_name="B")]
    results = vfc.run(rows, workers=1, checker=_checker(_site(_ics(FUTURE))))
    assert [r.status for r in results] == ["ok", "check"]
    assert results[1].reason == "duplicate calendar_url in this file"


# ── chain filter ─────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "name,url",
    [
        ("House of Blues Boston", "https://www.houseofblues.com/boston"),
        ("The Echo", "https://www.livenation.com/venue/1/the-echo-events"),
        ("Moore Theatre (STG)", "https://www.stgpresents.org/calendar"),
        ("Vic Theatre", "https://www.jamusa.com/events"),
    ],
)
def test_chain_rows_are_flagged(name, url):
    assert is_chain({"venue_name": name, "calendar_url": url})


def test_independent_venue_is_not_a_chain():
    assert not is_chain({"venue_name": "Ryman Auditorium", "calendar_url": "https://ryman.com/events/"})


# ── planner ──────────────────────────────────────────────────────────────

def _match(**over: str) -> dict[str, str]:
    base = {
        "state_code": "TN", "city": "Nashville", "venue_name": "Ryman Auditorium",
        "calendar_url": "https://ryman.com/events/", "street_address": "116 Rep John Lewis Way N",
        "postcode": "37219", "chain": "", "match_status": "matched", "similarity": "1.00",
        "place_name": "Ryman Auditorium", "gers_id": "g-1", "lat": "36.161219", "lng": "-86.778554",
    }
    return {**base, **over}


def test_plan_uses_overture_coordinates_and_validates():
    [src] = plan.build_plan([_match()])
    assert src["name"] == "feed:tn:ryman-auditorium" and src["connector"] == "feed"
    venue = src["config"]["venue"]
    assert (venue["lat"], venue["lng"]) == (36.161219, -86.778554)
    assert venue["region"] == "TN" and src["config"]["timezone"] is None  # split-zone state


def test_plan_skips_chains_weak_matches_unmatched_and_owner_exclusions():
    rows = [
        _match(venue_name="A", chain="yes"),
        _match(venue_name="B", similarity="0.79"),
        _match(venue_name="C", match_status="no_match"),
        _match(venue_name="LaSells Stewart Center (OSU)"),
        _match(venue_name="D", place_name="D Hall"),
    ]
    assert [s["config"]["venue"]["name"] for s in plan.build_plan(rows)] == ["D Hall"]


def test_plan_source_names_stay_unique():
    a = _match(place_name="Opera House", city="Fremont")
    b = _match(place_name="Opera House", city="Smyrna")
    names = [s["name"] for s in plan.build_plan([a, b])]
    assert len(set(names)) == 2


def test_single_zone_state_gets_a_timezone():
    [src] = plan.build_plan([_match(state_code="WI")])
    assert src["config"]["timezone"] == "America/Chicago"
