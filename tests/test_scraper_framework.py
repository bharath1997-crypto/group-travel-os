"""Tests for ScraperFramework."""
from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest

from app.models.scraper_health import ScraperHealth
from app.services.scraper_framework import ScraperFramework
from tests.conftest import exec_result


def _healthy(provider: str = "ticketmaster") -> ScraperHealth:
    return ScraperHealth(
        provider=provider,
        status="healthy",
        consecutive_failures=0,
        is_enabled=True,
        events_fetched_today=0,
    )


def test_provider_available_when_healthy(db):
    health = _healthy()
    db.execute.return_value = exec_result(scalar_one_or_none=health)

    assert ScraperFramework.is_provider_available(db, "ticketmaster") is True


def test_provider_blocked_after_3_failures(db):
    health = _healthy()
    db.execute.return_value = exec_result(scalar_one_or_none=health)

    ScraperFramework.record_failure(db, "ticketmaster", "err1")
    ScraperFramework.record_failure(db, "ticketmaster", "err2")
    ScraperFramework.record_failure(db, "ticketmaster", "err3")

    assert health.status == "blocked"
    assert health.consecutive_failures == 3
    assert health.blocked_until is not None


def test_provider_unblocked_after_expiry(db):
    health = _healthy()
    health.status = "blocked"
    health.blocked_until = datetime.utcnow() - timedelta(hours=1)
    health.consecutive_failures = 3
    db.execute.return_value = exec_result(scalar_one_or_none=health)

    assert ScraperFramework.is_provider_available(db, "ticketmaster") is True
    assert health.blocked_until is None
    assert health.status == "healthy"
    assert health.consecutive_failures == 0


def test_record_success_resets_failures(db):
    health = _healthy()
    health.consecutive_failures = 2
    health.status = "degraded"
    db.execute.return_value = exec_result(scalar_one_or_none=health)

    ScraperFramework.record_success(db, "ticketmaster", 10)

    assert health.status == "healthy"
    assert health.consecutive_failures == 0
    assert health.events_fetched_today == 10
    assert health.last_success_at is not None


def test_disabled_provider_not_available(db):
    health = _healthy()
    health.is_enabled = False
    db.execute.return_value = exec_result(scalar_one_or_none=health)

    assert ScraperFramework.is_provider_available(db, "ticketmaster") is False
