"""run-due must keep working when migration 019 (ingest.feed_state) is not applied."""
from __future__ import annotations

from sqlalchemy import create_engine

from scaper.feed.persistence import feed_fresh_within_hours


def test_missing_feed_state_table_means_not_fresh() -> None:
    engine = create_engine("sqlite://")  # no ingest.feed_state, and not even Postgres
    assert feed_fresh_within_hours(engine, "US") is False
