from __future__ import annotations

import importlib.util
from pathlib import Path
from unittest.mock import MagicMock, call

import pytest

ROOT = Path(__file__).resolve().parents[1]
INGEST_DB = ROOT / "scripts" / "place_ingest_runs_db.py"


def _mod():
    spec = importlib.util.spec_from_file_location("place_ingest_runs_db", INGEST_DB)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_complete_ingest_run_requires_one_row() -> None:
    mod = _mod()
    conn = MagicMock()
    cur = MagicMock()
    cur.rowcount = 0
    conn.cursor.return_value.__enter__.return_value = cur
    with pytest.raises(mod.IngestRunError):
        mod.complete_ingest_run(conn, "run-uuid", row_count=10)


def test_fail_ingest_run_requires_one_row() -> None:
    mod = _mod()
    conn = MagicMock()
    cur = MagicMock()
    cur.rowcount = 0
    conn.cursor.return_value.__enter__.return_value = cur
    with pytest.raises(mod.IngestRunError):
        mod.fail_ingest_run(conn, "run-uuid", error_summary="boom")


def test_begin_ingest_run_already_succeeded() -> None:
    mod = _mod()
    conn = MagicMock()
    cur = MagicMock()
    cur.fetchone.return_value = ("existing-id", "succeeded")
    conn.cursor.return_value.__enter__.return_value = cur
    with pytest.raises(mod.IngestAlreadySucceeded) as exc:
        mod.begin_ingest_run(conn, release_id="2026-01", region_key="midwest", city_slug="chicago")
    assert exc.value.run_id == "existing-id"


def test_begin_ingest_run_restarts_failed() -> None:
    mod = _mod()
    conn = MagicMock()
    cur = MagicMock()
    cur.fetchone.return_value = ("failed-id", "failed")
    cur.rowcount = 1
    conn.cursor.return_value.__enter__.return_value = cur
    run_id, mode = mod.begin_ingest_run(conn, release_id="2026-01", region_key=None, city_slug="chicago")
    assert run_id == "failed-id"
    assert mode == "restarted"
    assert cur.execute.call_count >= 2


def test_replace_run_cities_inserts_distinct() -> None:
    mod = _mod()
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    mod.replace_run_cities(conn, "run-id", ["Chicago", "chicago", ""])
    delete_call = cur.execute.call_args_list[0]
    assert "DELETE FROM place_ingest_run_cities" in delete_call[0][0]
    assert cur.executemany.called
