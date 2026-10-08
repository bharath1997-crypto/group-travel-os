"""PostgresStore surface checks (no database required)."""

from scaper.store import PostgresStore


def test_postgres_store_exposes_dedupe_and_relink() -> None:
    assert hasattr(PostgresStore, "dedupe_city")
    assert hasattr(PostgresStore, "relink_created_places")
    assert callable(PostgresStore.dedupe_city)
    assert callable(PostgresStore.relink_created_places)


def test_postgres_store_exposes_blocklist_and_remove() -> None:
    assert hasattr(PostgresStore, "is_provider_blocked")
    assert hasattr(PostgresStore, "remove_provider_event")
    assert callable(PostgresStore.is_provider_blocked)
    assert callable(PostgresStore.remove_provider_event)
