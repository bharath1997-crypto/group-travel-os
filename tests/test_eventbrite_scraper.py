"""Tests for Eventbrite scraper and sync job."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.jobs.eventbrite_sync import run_eventbrite_sync
from app.models.scraper_health import ScraperHealth
from app.models.unified_experience import UnifiedExperience
from app.services.event_dedup_service import EventDedupService
from app.services.providers.eventbrite_scraper import (
    _parse_event_object,
    parse_eventbrite_html,
    scrape_eventbrite_events,
)
from app.services.scraper_framework import ScraperFramework
from tests.conftest import exec_result


SAMPLE_JSON_LD = """
<script type="application/ld+json">
{
  "@type": "Event",
  "name": "Summer Jazz Night",
  "url": "https://www.eventbrite.com/e/summer-jazz-night-tickets-1234567890",
  "startDate": "2026-07-15T19:00:00-04:00",
  "location": {
    "@type": "Place",
    "name": "Blue Note",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "New York"
    }
  },
  "image": "https://example.com/img.jpg",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": 25,
    "highPrice": 75,
    "priceCurrency": "USD"
  }
}
</script>
"""


def test_parse_event_object_extracts_fields():
    parsed = _parse_event_object(
        {
            "@type": "Event",
            "name": "Summer Jazz Night",
            "url": "https://www.eventbrite.com/e/summer-jazz-night-tickets-1234567890",
            "startDate": "2026-07-15T19:00:00-04:00",
            "location": {
                "name": "Blue Note",
                "address": {"addressLocality": "New York"},
            },
            "image": "https://example.com/img.jpg",
            "offers": {"lowPrice": 25, "highPrice": 75, "priceCurrency": "USD"},
        },
        "New York",
    )

    assert parsed is not None
    assert parsed["title"] == "Summer Jazz Night"
    assert parsed["provider_event_id"] == "1234567890"
    assert parsed["venue_name"] == "Blue Note"
    assert parsed["venue_city"] == "New York"
    assert parsed["price_min"] == 25.0
    assert parsed["price_max"] == 75.0
    assert parsed["image_url"] == "https://example.com/img.jpg"


def test_parse_eventbrite_html_from_json_ld():
    events = parse_eventbrite_html(SAMPLE_JSON_LD, "New York")
    assert len(events) == 1
    assert events[0]["title"] == "Summer Jazz Night"
    assert events[0]["start_datetime"] is not None
    assert events[0]["start_datetime"].year == 2026
    assert events[0]["start_datetime"].month == 7
    assert events[0]["start_datetime"].day == 15


@pytest.mark.anyio
async def test_scrape_returns_empty_on_http_error():
    mock_resp = MagicMock()
    mock_resp.status_code = 503

    with patch(
        "app.services.providers.eventbrite_scraper.httpx.AsyncClient"
    ) as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_resp
        )
        with patch(
            "app.services.providers.eventbrite_scraper.ScraperFramework.is_provider_available",
            return_value=True,
        ), patch(
            "app.services.providers.eventbrite_scraper.ScraperFramework.record_failure"
        ) as mock_failure, patch(
            "app.services.providers.eventbrite_scraper.SessionLocal"
        ) as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            result = await scrape_eventbrite_events(
                "Chicago",
                "chicago--il",
            )

    assert result == []
    mock_failure.assert_called_once()


@pytest.mark.anyio
async def test_scrape_parses_successful_response():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = SAMPLE_JSON_LD

    with patch(
        "app.services.providers.eventbrite_scraper.httpx.AsyncClient"
    ) as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_resp
        )
        with patch(
            "app.services.providers.eventbrite_scraper.ScraperFramework.is_provider_available",
            return_value=True,
        ), patch(
            "app.services.providers.eventbrite_scraper.ScraperFramework.record_success"
        ) as mock_success, patch(
            "app.services.providers.eventbrite_scraper.SessionLocal"
        ) as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            result = await scrape_eventbrite_events(
                "New York",
                "new-york--ny",
            )

    assert len(result) == 1
    assert result[0]["title"] == "Summer Jazz Night"
    mock_success.assert_called_once_with(mock_db, "eventbrite", 1)


@pytest.mark.anyio
async def test_eventbrite_sync_dedup_reuses_existing_event(db):
    existing = UnifiedExperience(
        id=uuid.uuid4(),
        title="Summer Jazz Night",
        canonical_title="Summer Jazz Night",
        normalized_title=EventDedupService.normalize_title("Summer Jazz Night"),
        city="New York",
        country_code="US",
        start_datetime=datetime(2026, 7, 15, 19, 0, 0),
        venue_name="Blue Note",
        dedup_hash=EventDedupService.generate_dedup_hash(
            "Summer Jazz Night",
            "New York",
            "Blue Note",
            datetime(2026, 7, 15, 19, 0, 0),
        ),
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        updated_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )

    scraped = [{
        "provider_event_id": "1234567890",
        "title": "Summer Jazz Night",
        "url": "https://www.eventbrite.com/e/summer-jazz-night-tickets-1234567890",
        "start_datetime": datetime(2026, 7, 15, 19, 0, 0),
        "venue_name": "Blue Note",
        "venue_city": "New York",
        "image_url": "https://example.com/img.jpg",
        "price_min": 25.0,
        "price_max": 75.0,
        "currency": "USD",
        "category": "event",
    }]

    db.execute.side_effect = [
        exec_result(scalar_one_or_none=existing),
        exec_result(scalar_one_or_none=None),
    ]

    with patch(
        "app.jobs.eventbrite_sync.ScraperFramework.is_provider_available",
        return_value=True,
    ), patch(
        "app.jobs.eventbrite_sync.scrape_eventbrite_events",
        new=AsyncMock(return_value=scraped),
    ), patch(
        "app.jobs.eventbrite_sync.EVENTBRITE_CITIES",
        [{"city": "New York", "slug": "new-york--ny"}],
    ), patch(
        "app.jobs.eventbrite_sync.asyncio.sleep",
        new=AsyncMock(),
    ), patch(
        "app.jobs.eventbrite_sync.SessionLocal",
        return_value=db,
    ):
        result = await run_eventbrite_sync()

    assert result["inserted"] == 0
    assert result["updated"] == 1
    assert result["errors"] == 0


def test_eventbrite_failure_blocking_after_three_failures(db):
    health = ScraperHealth(
        provider="eventbrite",
        status="healthy",
        consecutive_failures=0,
        is_enabled=True,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=health)

    ScraperFramework.record_failure(db, "eventbrite", "err1")
    ScraperFramework.record_failure(db, "eventbrite", "err2")
    ScraperFramework.record_failure(db, "eventbrite", "err3")

    assert health.status == "blocked"
    assert health.consecutive_failures == 3
    assert health.blocked_until is not None
    assert ScraperFramework.is_provider_available(db, "eventbrite") is False


@pytest.mark.anyio
async def test_eventbrite_sync_skips_when_blocked():
    with patch(
        "app.jobs.eventbrite_sync.ScraperFramework.is_provider_available",
        return_value=False,
    ), patch(
        "app.jobs.eventbrite_sync.SessionLocal"
    ) as mock_session:
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        result = await run_eventbrite_sync()

    assert result == {"error": "eventbrite blocked or disabled"}
