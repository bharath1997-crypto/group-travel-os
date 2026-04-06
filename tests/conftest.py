"""
tests/conftest.py — Shared pytest fixtures

All fixtures defined here are automatically available to every test file.
No need to import conftest — pytest discovers it automatically.
"""
import pytest
from unittest.mock import MagicMock
from sqlalchemy.orm import Session


@pytest.fixture
def db() -> MagicMock:
    """
    Mock SQLAlchemy Session for unit tests.

    Services receive this instead of a real DB session.
    Tests stay fast and don't require a running database.

    Usage:
        def test_something(db):
            db.execute.return_value.scalar_one_or_none.return_value = some_object
            result = MyService.my_method(db, ...)
    """
    return MagicMock(spec=Session)


@pytest.fixture
def mock_user():
    """
    A fake User object for testing authenticated routes and services.
    Expand fields as you add them to the User model in Step 6.
    """
    user = MagicMock()
    user.id = "00000000-0000-0000-0000-000000000001"
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.is_active = True
    user.is_verified = False
    return user
