"""PostgresStore surface checks (no database required)."""

from contextlib import contextmanager
from unittest.mock import MagicMock

from sqlalchemy.exc import ProgrammingError

from scaper.store import PostgresStore


def test_postgres_store_exposes_dedupe_and_relink() -> None:
    assert hasattr(PostgresStore, "dedupe_city")
    assert hasattr(PostgresStore, "relink_created_places")
    assert callable(PostgresStore.dedupe_city)
    assert callable(PostgresStore.relink_created_places)


def test_postgres_store_exposes_blocklist_and_remove() -> None:
    assert hasattr(PostgresStore, "blocked_ids")
    assert hasattr(PostgresStore, "is_provider_blocked")
    assert hasattr(PostgresStore, "remove_provider_event")
    assert callable(PostgresStore.blocked_ids)
    assert callable(PostgresStore.is_provider_blocked)
    assert callable(PostgresStore.remove_provider_event)


def test_blocked_ids_empty_when_blocklist_table_missing() -> None:
    err = ProgrammingError("SELECT", {}, Exception("relation does not exist"))
    err.orig = type("_Orig", (), {"pgcode": "42P01"})()  # type: ignore[attr-defined]

    class _Conn:
        def execute(self, *_args, **_kwargs):
            raise err

    class _Engine:
        @contextmanager
        def connect(self):
            yield _Conn()

    store = PostgresStore(_Engine())  # type: ignore[arg-type]
    assert store.blocked_ids("eventbrite") == set()
    assert store.is_provider_blocked("eventbrite", "x") is False
