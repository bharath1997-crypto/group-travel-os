"""Tests for StubHub / SeatGeek price scrapers and enrichment job."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.jobs.enrich_event_prices import get_events_needing_prices, run_price_enrichment
from app.models.unified_event import UnifiedEvent
from app.services.providers.seatgeek_scraper import scrape_seatgeek_prices
from app.services.providers.stubhub_scraper import scrape_stubhub_prices
from tests.conftest import exec_result


@pytest.mark.anyio
async def test_seatgeek_returns_none_on_error():
    with patch(
        "app.services.providers.seatgeek_scraper.httpx.AsyncClient"
    ) as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            side_effect=Exception("network error")
        )
        result = await scrape_seatgeek_prices(
            "Taylor Swift",
            "Chicago",
            date(2026, 6, 14),
        )
    assert result is None


@pytest.mark.anyio
async def test_seatgeek_returns_price_on_match():
    payload = {
        "events": [
            {
                "title": "Taylor Swift Eras Tour",
                "datetime_local": "2026-06-14T20:00:00",
                "stats": {"lowest_price": 89.0},
                "url": "https://seatgeek.com/taylor-swift-tickets",
            }
        ]
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = payload

    with patch(
        "app.services.providers.seatgeek_scraper.httpx.AsyncClient"
    ) as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_resp
        )
        result = await scrape_seatgeek_prices(
            "Taylor Swift Eras Tour",
            "Chicago",
            date(2026, 6, 14),
        )

    assert result is not None
    assert result["provider"] == "seatgeek"
    assert result["min_price"] == 89.0
    assert "seatgeek.com" in result["provider_url"]


@pytest.mark.anyio
async def test_stubhub_returns_none_on_error():
    with patch(
        "app.services.providers.stubhub_scraper.httpx.AsyncClient"
    ) as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            side_effect=Exception("blocked")
        )
        result = await scrape_stubhub_prices(
            "Taylor Swift",
            "Chicago",
            date(2026, 6, 14),
        )
    assert result is None


def test_get_events_needing_prices_returns_list(db):
    event = UnifiedEvent(
        id=uuid.uuid4(),
        title="Show",
        canonical_title="Show",
        normalized_title="show",
        city="Chicago",
        country_code="US",
        start_datetime=datetime(2026, 6, 14, 20, 0, 0),
        dedup_hash="abc",
    )
    db.execute.return_value = exec_result(scalars_all=[event])

    rows = get_events_needing_prices(db, limit=10)
    assert rows == [event]


@pytest.mark.anyio
async def test_enrichment_skips_blocked_provider():
    event = UnifiedEvent(
        id=uuid.uuid4(),
        title="Show",
        canonical_title="Show",
        normalized_title="show",
        city="Chicago",
        country_code="US",
        start_datetime=datetime(2026, 6, 14, 20, 0, 0),
        dedup_hash="abc",
    )
    mock_db = MagicMock()
    mock_db.execute.return_value = exec_result(scalars_all=[event])

    with patch(
        "app.jobs.enrich_event_prices.SessionLocal",
        return_value=mock_db,
    ), patch(
        "app.jobs.enrich_event_prices.ScraperFramework.is_provider_available",
        side_effect=lambda _db, provider: provider == "seatgeek",
    ), patch(
        "app.jobs.enrich_event_prices.scrape_stubhub_prices",
        new_callable=AsyncMock,
    ) as mock_stubhub, patch(
        "app.jobs.enrich_event_prices.scrape_seatgeek_prices",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "app.jobs.enrich_event_prices.asyncio.sleep",
        new_callable=AsyncMock,
    ):
        result = await run_price_enrichment()

    mock_stubhub.assert_not_called()
    assert result["events_processed"] == 1
    assert result["stubhub_prices_added"] == 0
