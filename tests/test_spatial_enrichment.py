"""Tests for TIGER spatial address enrichment pipeline."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.scripts.spatial_enrichment import (
    STAGE_1_COUNT_SQL,
    STAGE_1_UPDATE_SQL,
    STAGE_2_COUNT_SQL,
    STAGE_2_UPDATE_SQL,
    STAGE_5_UPDATE_SQL,
    run_enrichment,
    run_stage_1,
    run_stage_2,
    run_stage_5,
)


def test_stage_1_sql_sets_tiger_state_provenance():
    sql = str(STAGE_1_UPDATE_SQL)
    assert "state_source = 'tiger_state'" in sql
    assert "geocode_confidence = 'high'" in sql
    assert "ST_Contains(s.geom, p.geom)" in sql
    assert "tiger_states" in sql


def test_stage_2_sql_sets_tiger_place_provenance():
    sql = str(STAGE_2_UPDATE_SQL)
    assert "city_source = 'tiger_place'" in sql
    assert "geocode_confidence = 'high'" in sql
    assert "ST_Contains(pl.geom, p.geom)" in sql
    assert "tiger_places" in sql


def test_stage_1_count_sql_targets_null_state():
    sql = str(STAGE_1_COUNT_SQL)
    assert "address->>'state' IS NULL" in sql
    assert "tiger_states" in sql


def test_stage_2_count_sql_targets_null_city():
    sql = str(STAGE_2_COUNT_SQL)
    assert "address->>'city' IS NULL" in sql
    assert "tiger_places" in sql


def test_stage_5_update_sql_sets_reverse_geocoder_provenance():
    sql = str(STAGE_5_UPDATE_SQL)
    assert "city_source = 'reverse_geocoder_fallback'" in sql
    assert "geocode_confidence = 'low'" in sql


def test_run_stage_1_dry_run_uses_count_and_skips_commit():
    db = MagicMock()
    db.execute.return_value.scalar_one.return_value = 17

    count = run_stage_1(db, dry_run=True)

    assert count == 17
    executed_sql = str(db.execute.call_args[0][0])
    assert "COUNT" in executed_sql.upper()
    db.commit.assert_not_called()


def test_run_stage_2_dry_run_uses_count_and_skips_commit():
    db = MagicMock()
    db.execute.return_value.scalar_one.return_value = 9

    count = run_stage_2(db, dry_run=True)

    assert count == 9
    executed_sql = str(db.execute.call_args[0][0])
    assert "COUNT" in executed_sql.upper()
    db.commit.assert_not_called()


def test_run_stage_1_writes_and_commits():
    db = MagicMock()
    db.execute.return_value.rowcount = 5

    count = run_stage_1(db, dry_run=False)

    assert count == 5
    executed_sql = str(db.execute.call_args[0][0])
    assert "UPDATE places" in executed_sql
    assert "tiger_state" in executed_sql
    db.commit.assert_called_once()


def test_run_stage_2_writes_and_commits():
    db = MagicMock()
    db.execute.return_value.rowcount = 3

    count = run_stage_2(db, dry_run=False)

    assert count == 3
    executed_sql = str(db.execute.call_args[0][0])
    assert "UPDATE places" in executed_sql
    assert "tiger_place" in executed_sql
    db.commit.assert_called_once()


def test_run_stage_5_reverse_geocoder_batch_logic():
    db = MagicMock()
    rows = [
        SimpleNamespace(id="00000000-0000-0000-0000-000000000001", lat=41.88, lng=-87.63),
        SimpleNamespace(id="00000000-0000-0000-0000-000000000002", lat=40.71, lng=-74.0),
    ]
    db.execute.return_value.fetchall.return_value = rows

    fake_results = [
        {"name": "Chicago", "admin1": "IL", "admin2": "Cook", "cc": "US"},
        {"name": "New York", "admin1": "NY", "admin2": "New York", "cc": "US"},
    ]

    with patch("reverse_geocoder.search", return_value=fake_results) as mock_search:
        updated = run_stage_5(db, batch_size=1000, dry_run=False)

    assert updated == 2
    mock_search.assert_called_once_with([(41.88, -87.63), (40.71, -74.0)])

    update_calls = [
        call
        for call in db.execute.call_args_list
        if call.args and "UPDATE places" in str(call.args[0])
    ]
    assert len(update_calls) == 2
    assert update_calls[0].args[1] == {
        "city": "Chicago",
        "id": "00000000-0000-0000-0000-000000000001",
    }
    assert update_calls[1].args[1] == {
        "city": "New York",
        "id": "00000000-0000-0000-0000-000000000002",
    }
    db.commit.assert_called()


def test_run_stage_5_dry_run_skips_reverse_geocoder_and_writes():
    db = MagicMock()
    rows = [
        SimpleNamespace(id="00000000-0000-0000-0000-000000000001", lat=41.88, lng=-87.63),
    ]
    db.execute.return_value.fetchall.return_value = rows

    with patch("reverse_geocoder.search") as mock_search:
        count = run_stage_5(db, dry_run=True)

    assert count == 1
    mock_search.assert_not_called()
    db.commit.assert_not_called()


def test_run_enrichment_dry_run_produces_no_commits_for_sql_stages():
    db = MagicMock()
    db.execute.return_value.scalar_one.return_value = 0
    db.execute.return_value.fetchall.return_value = []

    counts = run_enrichment(db, stage="all", dry_run=True)

    assert counts == {
        "stage_1": 0,
        "stage_2": 0,
        "stage_3": 0,
        "stage_4": 0,
        "stage_5": 0,
    }
    db.commit.assert_not_called()


@pytest.fixture
def sqlite_places_db():
    engine = create_engine("sqlite:///:memory:")
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE places (
                    id TEXT PRIMARY KEY,
                    lat REAL,
                    lng REAL,
                    address TEXT,
                    city_source TEXT,
                    state_source TEXT,
                    postcode_source TEXT,
                    geocode_confidence TEXT,
                    geocode_updated_at TEXT
                )
                """
            )
        )
        conn.commit()
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def test_provenance_columns_exist_on_places_schema(sqlite_places_db):
    row = sqlite_places_db.execute(
        text("PRAGMA table_info(places)")
    ).fetchall()
    column_names = {entry[1] for entry in row}
    assert "city_source" in column_names
    assert "state_source" in column_names
    assert "postcode_source" in column_names
    assert "geocode_confidence" in column_names
    assert "geocode_updated_at" in column_names
