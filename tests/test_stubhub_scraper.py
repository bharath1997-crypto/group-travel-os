"""Tests for StubHub scraper and sync job."""
from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.jobs.stubhub_sync import run_stubhub_sync
from app.models.scraper_health import ScraperHealth
from app.models.unified_experience import UnifiedExperience
from app.services.event_dedup_service import EventDedupService
from app.services.providers.stubhub_scraper import (
    _parse_event_object,
    parse_stubhub_html,
    scrape_stubhub_events,
)
from app.services.scraper_framework import ScraperFramework
from tests.conftest import exec_result

SAMPLE_JSON_LD = """
<script type="application/ld+json">
{
  "@type": "Event",
  "name": "StubHub Rock Concert",
  "url": "https://www.stubhub.com/event/987654321/",
  "startDate": "2026-08-20T20:00:00-04:00",
  "location": {
    "@type": "Place",
    "name": "Madison Square Garden",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "New York"
    }
  },
  "image": "https://example.com/stubhub.jpg",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": 50,
    "highPrice": 150,
    "priceCurrency": "USD"
  }
}
</script>
"""


def test_parse_event_object_extracts_fields():
    parsed = _parse_event_object(
        {
            "@type": "Event",
            "name": "StubHub Rock Concert",
            "url": "https://www.stubhub.com/event/987654321/",
            "startDate": "2026-08-20T20:00:00-04:00",
            "location": {
                "name": "Madison Square Garden",
                "address": {"addressLocality": "New York"},
            },
            "image": "https://example.com/stubhub.jpg",
            "offers": {"lowPrice": 50, "highPrice": 150, "priceCurrency": "USD"},
        },
        "New York",
    )

    assert parsed is not None
    assert parsed["title"] == "StubHub Rock Concert"
    assert parsed["provider_event_id"] == "987654321"
    assert parsed["venue_name"] == "Madison Square Garden"
    assert parsed["venue_city"] == "New York"
    assert parsed["price_min"] == 50.0
    assert parsed["price_max"] == 150.0
    assert parsed["image_url"] == "https://example.com/stubhub.jpg"


def test_parse_stubhub_html_from_json_ld():
    events = parse_stubhub_html(SAMPLE_JSON_LD, "New York")
    assert len(events) == 1
    assert events[0]["title"] == "StubHub Rock Concert"
    assert events[0]["start_datetime"] is not None
    assert events[0]["start_datetime"].year == 2026
    assert events[0]["start_datetime"].month == 8
    assert events[0]["start_datetime"].day == 20


@pytest.mark.anyio
async def test_scrape_returns_empty_on_http_error():
    mock_resp = MagicMock()
    mock_resp.status_code = 503

    with patch(
        "app.services.providers.stubhub_scraper.httpx.AsyncClient"
    ) as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_resp
        )
        with patch(
            "app.services.providers.stubhub_scraper.ScraperFramework.is_provider_available",
            return_value=True,
        ), patch(
            "app.services.providers.stubhub_scraper.ScraperFramework.record_failure"
        ) as mock_failure, patch(
            "app.services.providers.stubhub_scraper.SessionLocal"
        ) as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            result = await scrape_stubhub_events("Chicago")

    assert result == []
    mock_failure.assert_called_once()


@pytest.mark.anyio
async def test_scrape_parses_successful_response():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = SAMPLE_JSON_LD

    with patch(
        "app.services.providers.stubhub_scraper.httpx.AsyncClient"
    ) as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_resp
        )
        with patch(
            "app.services.providers.stubhub_scraper.ScraperFramework.is_provider_available",
            return_value=True,
        ), patch(
            "app.services.providers.stubhub_scraper.ScraperFramework.record_success"
        ) as mock_success, patch(
            "app.services.providers.stubhub_scraper.SessionLocal"
        ) as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            result = await scrape_stubhub_events("New York")

    assert len(result) == 1
    assert result[0]["title"] == "StubHub Rock Concert"
    mock_success.assert_called_once_with(mock_db, "stubhub", 1)


@pytest.mark.anyio
async def test_stubhub_sync_dedup_reuses_existing_event(db):
    existing = UnifiedExperience(
        id=uuid.uuid4(),
        title="StubHub Rock Concert",
        canonical_title="StubHub Rock Concert",
        normalized_title=EventDedupService.normalize_title("StubHub Rock Concert"),
        city="New York",
        country_code="US",
        start_datetime=datetime(2026, 8, 20, 20, 0, 0),
        venue_name="Madison Square Garden",
        dedup_hash=EventDedupService.generate_dedup_hash(
            "StubHub Rock Concert",
            "New York",
            "Madison Square Garden",
            datetime(2026, 8, 20, 20, 0, 0),
        ),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    scraped = [{
        "provider_event_id": "987654321",
        "title": "StubHub Rock Concert",
        "url": "https://www.stubhub.com/event/987654321/",
        "start_datetime": datetime(2026, 8, 20, 20, 0, 0),
        "venue_name": "Madison Square Garden",
        "venue_city": "New York",
        "image_url": "https://example.com/stubhub.jpg",
        "price_min": 50.0,
        "price_max": 150.0,
        "currency": "USD",
        "category": "event",
    }]

    db.execute.side_effect = [
        exec_result(scalar_one_or_none=existing),
        exec_result(scalar_one_or_none=None),
    ]

    with patch(
        "app.jobs.stubhub_sync.ScraperFramework.is_provider_available",
        return_value=True,
    ), patch(
        "app.jobs.stubhub_sync.scrape_stubhub_events",
        new=AsyncMock(return_value=scraped),
    ), patch(
        "app.jobs.stubhub_sync.STUBHUB_CITIES",
        ["New York"],
    ), patch(
        "app.jobs.stubhub_sync.asyncio.sleep",
        new=AsyncMock(),
    ), patch(
        "app.jobs.stubhub_sync.SessionLocal",
        return_value=db,
    ):
        result = await run_stubhub_sync()

    assert result["inserted"] == 0
    assert result["updated"] == 1
    assert result["errors"] == 0


def test_stubhub_failure_blocking_after_three_failures(db):
    health = ScraperHealth(
        provider="stubhub",
        status="healthy",
        consecutive_failures=0,
        is_enabled=True,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=health)

    ScraperFramework.record_failure(db, "stubhub", "err1")
    ScraperFramework.record_failure(db, "stubhub", "err2")
    ScraperFramework.record_failure(db, "stubhub", "err3")

    assert health.status == "blocked"
    assert health.consecutive_failures == 3
    assert health.blocked_until is not None
    assert ScraperFramework.is_provider_available(db, "stubhub") is False


@pytest.mark.anyio
async def test_stubhub_sync_skips_when_blocked():
    with patch(
        "app.jobs.stubhub_sync.ScraperFramework.is_provider_available",
        return_value=False,
    ), patch(
        "app.jobs.stubhub_sync.SessionLocal"
    ) as mock_session:
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        result = await run_stubhub_sync()

    assert result == {"error": "stubhub blocked or disabled"}
