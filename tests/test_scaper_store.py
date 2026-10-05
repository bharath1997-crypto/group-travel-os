"""PostgresStore surface checks (no database required)."""

from scaper.store import PostgresStore


def test_postgres_store_exposes_dedupe_and_relink() -> None:
    assert hasattr(PostgresStore, "dedupe_city")
    assert hasattr(PostgresStore, "relink_created_places")
    assert callable(PostgresStore.dedupe_city)
    assert callable(PostgresStore.relink_created_places)
