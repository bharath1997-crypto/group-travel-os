"""
tests/conftest.py — Shared pytest fixtures

All fixtures defined here are automatically available to every test file.
No need to import conftest — pytest discovers it automatically.
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

_SENT = object()


@pytest.fixture(scope="session", autouse=True)
def sqlite_create_explorer_events_table() -> None:
    """
    CI uses ``DATABASE_URL=sqlite:///./test.db`` without Alembic migrations.
    Ensure all tables used by integration tests exist so they do not fail.
    """
    from config import settings

    if not str(settings.DATABASE_URL or "").startswith("sqlite"):
        return

    import sqlalchemy as sa
    from sqlalchemy.dialects.postgresql import JSONB
    from app.utils.database import Base, engine

    # Import registers each model on ``Base.metadata``.
    from app.models.explore_event import ExploreEvent
    from app.models.explore_content import ExploreContent
    from app.models.unified_experience import UnifiedExperience
    from app.models.scraper_health import ScraperHealth
    from app.models.trip import Trip
    from app.models.trip_roster import TripRoster
    from app.models.cart import TravelCart
    from app.models.saved_pin import SavedPin
    from app.models.location import Location
    from app.models.expense import Expense, ExpenseSplit
    from app.models.lounge import LoungeChat, LoungeMember
    from app.models.wayra import WayraPersonalMemory

    # Override JSONB → JSON for SQLite compatibility in CI
    for model in (ExploreContent,):
        for col in model.__table__.columns:
            if isinstance(col.type, JSONB):
                col.type = sa.JSON()

    # Create tables in dependency order (FK targets before referencing tables).
    # SQLite does not enforce FK constraints, but correct ordering avoids
    # potential issues with SQLAlchemy's dependency sorter.
    tables_to_create = [
        ExploreEvent.__table__,
        ExploreContent.__table__,
        UnifiedExperience.__table__,
        ScraperHealth.__table__,
        Trip.__table__,
        TravelCart.__table__,
        SavedPin.__table__,
        Location.__table__,
        Expense.__table__,
        ExpenseSplit.__table__,
        LoungeChat.__table__,
        LoungeMember.__table__,
        WayraPersonalMemory.__table__,
        TripRoster.__table__,
    ]
    Base.metadata.create_all(bind=engine, tables=tables_to_create, checkfirst=True)


def exec_result(
    *,
    scalar_one_or_none: object = _SENT,
    scalar_one: object = _SENT,
    scalars_all: list | None = None,
) -> MagicMock:
    """
    Mock return value for db.execute(stmt) matching SQLAlchemy 2.0 call patterns
    used in services: scalar_one_or_none(), scalar_one(), scalars().all(),
    scalars().unique().all().
    """
    m = MagicMock()
    if scalar_one_or_none is not _SENT:
        m.scalar_one_or_none.return_value = scalar_one_or_none
    if scalar_one is not _SENT:
        m.scalar_one.return_value = scalar_one
    elif scalar_one_or_none is not _SENT:
        m.scalar_one.return_value = scalar_one_or_none
    rows: list = [] if scalars_all is None else list(scalars_all)
    scalars = MagicMock()
    scalars.all.return_value = rows
    uniq = MagicMock()
    uniq.all.return_value = rows
    scalars.unique.return_value = uniq
    m.scalars.return_value = scalars
    return m


@pytest.fixture
def db() -> MagicMock:
    """
    Mock SQLAlchemy Session for unit tests.

    Services receive this instead of a real DB session.
    Tests stay fast and don't require a running database.

    Usage:
        def test_something(db):
            db.execute.side_effect = [exec_result(scalar_one_or_none=obj), ...]
            result = MyService.my_method(db, ...)
    """
    return MagicMock(spec=Session)


@pytest.fixture
def mock_user():
    """
    A fake User object for testing authenticated routes and services.
    """
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.is_active = True
    user.is_verified = False
    user.hashed_password = ""
    user.otp_resend_count = 0
    user.otp_resend_reset_at = None
    user.otp_attempt_count = 0
    user.verification_otp_hash = None
    user.otp_expires_at = None
    user.cover_url = None
    return user
