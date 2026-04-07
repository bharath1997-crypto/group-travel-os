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
    return user
