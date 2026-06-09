"""Tests for Viator provider and sync job."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.jobs.viator_sync import run_viator_sync
from app.services.providers.viator_provider import (
    _parse_product,
    search_viator_experiences,
)


def test_viator_returns_empty_no_api_key():
    import asyncio

    with patch("app.services.providers.viator_provider.settings") as mock_settings:
        mock_settings.viator_api_key = ""
        result = asyncio.run(
            search_viator_experiences("Chicago", 41.8781, -87.6298)
        )
    assert result == []


@pytest.mark.anyio
async def test_viator_search_parses_response():
    payload = {
        "products": [
            {
                "productCode": "ABC123",
                "title": "Chicago Architecture Tour",
                "description": "See the skyline",
                "duration": {"fixedDurationInMinutes": 120},
                "pricing": {
                    "summary": {"fromPrice": 45.0},
                    "currency": "USD",
                },
                "reviews": {
                    "combinedAverageRating": 4.8,
                    "totalReviews": 1200,
                },
                "images": [
                    {"variants": [{"url": "https://example.com/img.jpg"}]}
                ],
            }
        ]
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = payload

    with patch("app.services.providers.viator_provider.settings") as mock_settings:
        mock_settings.viator_api_key = "test-key"
        mock_settings.viator_partner_id = "P00305012"
        mock_settings.ENVIRONMENT = "production"
        with patch(
            "app.services.providers.viator_provider.httpx.AsyncClient"
        ) as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_resp
            )
            with patch(
                "app.services.providers.viator_provider.ScraperFramework.record_success"
            ), patch(
                "app.services.providers.viator_provider.SessionLocal"
            ) as mock_session:
                mock_db = MagicMock()
                mock_session.return_value = mock_db
                results = await search_viator_experiences(
                    "Chicago", 41.8781, -87.6298, limit=20
                )

    assert len(results) == 1
    assert results[0]["product_code"] == "ABC123"
    assert results[0]["title"] == "Chicago Architecture Tour"
    assert results[0]["price_from"] == 45.0
    assert results[0]["category"] == "activity"


@pytest.mark.anyio
async def test_viator_sync_skips_on_no_key():
    with patch("app.jobs.viator_sync.settings") as mock_settings:
        mock_settings.viator_api_key = ""
        result = await run_viator_sync()
    assert result == {"error": "No Viator API key"}


def test_viator_affiliate_url_contains_partner_id():
    with patch("app.services.providers.viator_provider.settings") as mock_settings:
        mock_settings.viator_partner_id = "P00305012"
        parsed = _parse_product(
            {
                "productCode": "TOUR99",
                "title": "City Walk",
                "pricing": {
                    "summary": {"fromPrice": 29.0},
                    "currency": "USD",
                },
                "reviews": {},
            },
            lat=40.7128,
            lng=-74.0060,
            location="New York",
        )
    assert parsed is not None
    assert "P00305012" in parsed["booking_url"]
    assert "TOUR99" in parsed["booking_url"]
    assert parsed["booking_url"].startswith("https://www.viator.com/tours/")
