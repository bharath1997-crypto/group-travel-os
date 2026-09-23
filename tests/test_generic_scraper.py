from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.generic_scraper.scraper import GenericEventScraper


SAMPLE_JSON_LD_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@type": "Event",
        "name": "Summer Jazz Night",
        "url": "https://events.example.com/e/summer-jazz-night",
        "startDate": "2026-07-15T19:00:00Z",
        "location": {
          "@type": "Place",
          "name": "Blue Note",
          "address": {"@type": "PostalAddress", "addressLocality": "New York"}
        },
        "image": "https://events.example.com/img.jpg",
        "offers": {"lowPrice": 25, "highPrice": 75, "priceCurrency": "USD"}
      }
    </script>
  </head>
</html>
"""

SAMPLE_HTML_FALLBACK = """
<html>
  <body>
    <article class="event-card">
      <a class="event-link" href="/events/rock-night">Rock Night Live</a>
      <time datetime="2026-10-10T20:00:00Z">Oct 10, 2026</time>
      <div class="event-venue">City Hall</div>
      <img src="/images/rock.jpg" />
    </article>
  </body>
</html>
"""


def test_parse_json_ld_event_fixture() -> None:
    scraper = GenericEventScraper()
    source = {"name": "example", "url": "https://events.example.com/{city_slug}", "default_city": "New York"}

    events = scraper.parse_events(
        html=SAMPLE_JSON_LD_HTML,
        source=source,
        default_city="New York",
        base_url="https://events.example.com/new-york",
    )

    assert len(events) == 1
    event = events[0]
    assert event["title"] == "Summer Jazz Night"
    assert event["url"] == "https://events.example.com/e/summer-jazz-night"
    assert event["venue_name"] == "Blue Note"
    assert event["venue_city"] == "New York"
    assert event["price_min"] == 25.0
    assert event["price_max"] == 75.0
    assert event["currency"] == "USD"
    assert event["start_datetime"] is not None


def test_parse_html_fallback_fixture() -> None:
    scraper = GenericEventScraper()
    source = {
        "name": "example",
        "url": "https://events.example.com/{city_slug}",
        "default_city": "Chicago",
        "link_pattern": "events",
        "selectors": {
            "card_selectors": ["article.event-card"],
            "link_selector": "a.event-link",
            "date_selector": "time",
            "venue_selector": ".event-venue",
            "image_selector": "img",
        },
    }

    events = scraper.parse_events(
        html=SAMPLE_HTML_FALLBACK,
        source=source,
        default_city="Chicago",
        base_url="https://events.example.com/chicago",
    )

    assert len(events) == 1
    event = events[0]
    assert event["title"] == "Rock Night Live"
    assert event["url"] == "https://events.example.com/events/rock-night"
    assert event["venue_name"] == "City Hall"
    assert event["venue_city"] == "Chicago"
    assert event["image_url"] == "https://events.example.com/images/rock.jpg"
    assert event["start_datetime"] is not None


def test_dedup_by_normalized_url() -> None:
    scraper = GenericEventScraper()
    events = [
        {
            "provider_event_id": "aaa",
            "title": "Event One",
            "url": "https://events.example.com/a/",
            "start_datetime": None,
            "venue_name": None,
            "venue_city": "Austin",
            "image_url": None,
            "price_min": None,
            "price_max": None,
            "currency": "USD",
            "category": "event",
        },
        {
            "provider_event_id": "aaa",
            "title": "Event One Duplicate",
            "url": "https://events.example.com/a",
            "start_datetime": None,
            "venue_name": None,
            "venue_city": "Austin",
            "image_url": None,
            "price_min": None,
            "price_max": None,
            "currency": "USD",
            "category": "event",
        },
    ]

    deduped = scraper._dedupe_events(events)
    assert len(deduped) == 1
    assert deduped[0]["url"].startswith("https://events.example.com/a")


def test_dedup_retains_same_url_with_different_provider_event_ids() -> None:
    scraper = GenericEventScraper()
    events = [
        {
            "provider_event_id": "aaa",
            "title": "Event One",
            "url": "https://events.example.com/a/",
            "start_datetime": None,
            "venue_name": None,
            "venue_city": "Austin",
            "image_url": None,
            "price_min": None,
            "price_max": None,
            "currency": "USD",
            "category": "event",
        },
        {
            "provider_event_id": "bbb",
            "title": "Event One Duplicate Provider",
            "url": "https://events.example.com/a",
            "start_datetime": None,
            "venue_name": None,
            "venue_city": "Austin",
            "image_url": None,
            "price_min": None,
            "price_max": None,
            "currency": "USD",
            "category": "event",
        },
    ]

    deduped = scraper._dedupe_events(events)
    assert len(deduped) == 2
    assert {event["provider_event_id"] for event in deduped} == {"aaa", "bbb"}


@pytest.mark.anyio
async def test_robots_gating_disallowed_and_allowed() -> None:
    scraper = GenericEventScraper()
    source = {
        "name": "example",
        "url": "https://events.example.com/{city_slug}",
        "default_city": "Austin",
    }

    parser_disallow = MagicMock()
    parser_disallow.can_fetch.return_value = False
    with patch.object(
        scraper,
        "_get_robots_parser",
        AsyncMock(return_value=parser_disallow),
    ), patch.object(scraper, "_fetch_page", AsyncMock()) as fetch_mock:
        disallowed_events = await scraper.scrape_source(source, city="Austin")
    assert disallowed_events == []
    fetch_mock.assert_not_called()

    parser_allow = MagicMock()
    parser_allow.can_fetch.return_value = True
    with patch.object(
        scraper,
        "_get_robots_parser",
        AsyncMock(return_value=parser_allow),
    ), patch.object(
        scraper,
        "_fetch_page",
        AsyncMock(return_value=SAMPLE_HTML_FALLBACK),
    ):
        allowed_events = await scraper.scrape_source(source, city="Austin")

    assert len(allowed_events) == 1
