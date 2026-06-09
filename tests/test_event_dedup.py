"""Tests for EventDedupService."""
from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from rapidfuzz import fuzz

from app.models.event_provider import EventProvider
from app.models.unified_event import UnifiedEvent
from app.services.event_dedup_service import EventDedupService
from tests.conftest import exec_result


def test_normalize_title_removes_stopwords():
    result = EventDedupService.normalize_title(
        "The Official Live Concert Tour 2026"
    )
    assert "the" not in result.split()
    assert "official" not in result.split()
    assert "live" not in result.split()
    assert "concert" not in result.split()
    assert "tour" not in result.split()
    assert "2026" not in result.split()


def test_normalize_title_lowercase():
    result = EventDedupService.normalize_title("Taylor Swift Eras")
    assert result == "taylor swift eras"


def test_dedup_hash_same_event_same_hash():
    dt = datetime(2026, 6, 14, 20, 0, 0)
    h1 = EventDedupService.generate_dedup_hash(
        "Taylor Swift", "Chicago", dt
    )
    h2 = EventDedupService.generate_dedup_hash(
        "Taylor Swift", "Chicago", dt
    )
    assert h1 == h2


def test_dedup_hash_different_date_different_hash():
    h1 = EventDedupService.generate_dedup_hash(
        "Taylor Swift",
        "Chicago",
        datetime(2026, 6, 14, 20, 0, 0),
    )
    h2 = EventDedupService.generate_dedup_hash(
        "Taylor Swift",
        "Chicago",
        datetime(2026, 6, 15, 20, 0, 0),
    )
    assert h1 != h2


def test_is_same_event_high_similarity():
    a = EventDedupService.normalize_title(
        "Taylor Swift: The Eras Tour"
    )
    b = EventDedupService.normalize_title(
        "Taylor Swift Eras Tour Live"
    )
    assert fuzz.ratio(a, b) >= 85


def test_is_different_event_low_similarity():
    a = EventDedupService.normalize_title("Taylor Swift")
    b = EventDedupService.normalize_title("Chicago Bulls vs Lakers")
    assert fuzz.ratio(a, b) < 85


def test_different_city_not_duplicate():
    dt = datetime(2026, 6, 14, 20, 0, 0)
    h1 = EventDedupService.generate_dedup_hash(
        "Taylor Swift", "Chicago", dt
    )
    h2 = EventDedupService.generate_dedup_hash(
        "Taylor Swift", "New York", dt
    )
    assert h1 != h2


def test_different_date_not_duplicate():
    h1 = EventDedupService.generate_dedup_hash(
        "Taylor Swift",
        "Chicago",
        datetime(2026, 6, 14, 20, 0, 0),
    )
    h2 = EventDedupService.generate_dedup_hash(
        "Taylor Swift",
        "Chicago",
        datetime(2026, 6, 15, 20, 0, 0),
    )
    assert h1 != h2


def test_find_or_create_creates_new_event(db):
    dt = datetime(2026, 6, 14, 20, 0, 0)
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=None),
        exec_result(scalars_all=[]),
    ]

    event, created = EventDedupService.find_or_create_event(
        db=db,
        title="Taylor Swift",
        city="Chicago",
        country_code="US",
        start_datetime=dt,
    )

    assert created is True
    db.add.assert_called_once()
    db.flush.assert_called_once()
    assert event.title == "Taylor Swift"
    assert event.city == "Chicago"
    assert event.dedup_hash is not None


def test_find_or_create_finds_existing_by_hash(db):
    dt = datetime(2026, 6, 14, 20, 0, 0)
    existing = UnifiedEvent(
        id=uuid.uuid4(),
        title="Taylor Swift",
        canonical_title="Taylor Swift",
        normalized_title="taylor swift",
        city="Chicago",
        country_code="US",
        start_datetime=dt,
        dedup_hash=EventDedupService.generate_dedup_hash(
            "Taylor Swift", "Chicago", dt
        ),
    )
    db.execute.return_value = exec_result(scalar_one_or_none=existing)

    event, created = EventDedupService.find_or_create_event(
        db=db,
        title="Taylor Swift",
        city="Chicago",
        country_code="US",
        start_datetime=dt,
    )

    assert created is False
    assert event is existing
    db.add.assert_not_called()


def test_add_provider_creates_new(db):
    event_id = uuid.uuid4()
    db.execute.return_value = exec_result(scalar_one_or_none=None)

    provider = EventDedupService.add_or_update_provider(
        db=db,
        event_id=event_id,
        provider="ticketmaster",
        provider_event_id="tm-123",
        provider_url="https://ticketmaster.com/tm-123",
        min_price=89.0,
        max_price=250.0,
    )

    db.add.assert_called_once()
    assert provider.provider == "ticketmaster"
    assert provider.provider_event_id == "tm-123"
    assert provider.min_price == 89.0


def test_add_provider_updates_existing_price(db):
    event_id = uuid.uuid4()
    existing = EventProvider(
        id=uuid.uuid4(),
        event_id=event_id,
        provider="ticketmaster",
        provider_event_id="tm-123",
        provider_url="https://ticketmaster.com/tm-123",
        min_price=50.0,
        max_price=100.0,
        currency="USD",
        availability="available",
    )
    db.execute.return_value = exec_result(scalar_one_or_none=existing)

    provider = EventDedupService.add_or_update_provider(
        db=db,
        event_id=event_id,
        provider="ticketmaster",
        provider_event_id="tm-123",
        provider_url="https://ticketmaster.com/tm-123",
        min_price=75.0,
        max_price=200.0,
    )

    assert provider is existing
    assert existing.min_price == 75.0
    assert existing.max_price == 200.0
    db.add.assert_not_called()
