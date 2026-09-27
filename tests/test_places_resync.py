"""
Integration test: hand-enriched place fields survive Overture re-sync.

Requires DATABASE_URL pointing at the data-spine places table.
"""
from __future__ import annotations

import csv
import importlib.util
import sys
import tempfile
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _load_db_module():
    spec = importlib.util.spec_from_file_location(
        "places_spine_db",
        ROOT / "scripts" / "places_spine_db.py",
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load places_spine_db.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _connect_or_skip():
    db = _load_db_module()
    try:
        conn = db.connect()
    except Exception as exc:  # pragma: no cover - env dependent
        pytest.skip(f"DATABASE_URL not reachable: {exc}")
    return db, conn


def _write_resync_staging(path: Path, gers_id: str, name: str, lon: float, lat: float, confidence: float) -> None:
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=("gers_id", "name", "lon", "lat", "confidence"),
        )
        writer.writeheader()
        writer.writerow(
            {
                "gers_id": gers_id,
                "name": name,
                "lon": lon,
                "lat": lat,
                "confidence": confidence,
            }
        )


def test_enriched_fields_survive_resync():
    """
    Pick a live row, mark it hand-enriched, re-sync with changed Overture
    fields, and assert enriched values + enriched_at are untouched.
    """
    db, conn = _connect_or_skip()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'places'
          AND column_name = 'wikidata_qid'
        """
    )
    if cur.fetchone() is None:
        conn.close()
        pytest.skip("wikidata_qid column not migrated")

    cur.execute(
        """
        SELECT gers_id, name, confidence,
               ST_X(geog::geometry) AS lon,
               ST_Y(geog::geometry) AS lat
        FROM places
        WHERE city_slug = 'chicago'
        LIMIT 1
        """
    )
    row = cur.fetchone()
    if row is None:
        conn.close()
        pytest.skip("No chicago places loaded")

    gers_id, orig_name, orig_confidence, orig_lon, orig_lat = row
    orig_confidence = float(orig_confidence)
    orig_lon = float(orig_lon)
    orig_lat = float(orig_lat)

    enriched_at = datetime(2026, 9, 15, 12, 0, 0, tzinfo=UTC)
    new_name = f"{orig_name} RESYNC TEST"
    new_confidence = 0.55 if orig_confidence != 0.55 else 0.56
    new_lon = orig_lon + 0.001
    new_lat = orig_lat + 0.001

    try:
        cur.execute(
            """
            UPDATE places SET
              group_capacity = 14,
              price_per_head = 32,
              depth_tier = 2,
              enriched_at = %s,
              wikidata_qid = 'Q99999999',
              short_description = 'Resync survival test venue'
            WHERE gers_id = %s
            """,
            (enriched_at, gers_id),
        )
        conn.commit()

        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            suffix=".csv",
            delete=False,
        ) as tmp:
            staging_path = Path(tmp.name)

        try:
            _write_resync_staging(
                staging_path,
                gers_id,
                new_name,
                new_lon,
                new_lat,
                new_confidence,
            )
            updated = db.resync_places(conn, staging_path, commit=True)
            assert updated == 1

            cur.execute(
                """
                SELECT name, confidence, group_capacity, price_per_head,
                       depth_tier, enriched_at, wikidata_qid, short_description
                FROM places
                WHERE gers_id = %s
                """,
                (gers_id,),
            )
            (
                name,
                confidence,
                group_capacity,
                price_per_head,
                depth_tier,
                got_enriched_at,
                wikidata_qid,
                short_description,
            ) = cur.fetchone()

            assert name == new_name
            assert float(confidence) == pytest.approx(new_confidence)
            assert group_capacity == 14
            assert price_per_head == Decimal("32")
            assert depth_tier == 2
            assert got_enriched_at == enriched_at
            assert wikidata_qid == "Q99999999"
            assert short_description == "Resync survival test venue"
        finally:
            staging_path.unlink(missing_ok=True)
    finally:
        cur.execute(
            """
            UPDATE places SET
              name = %s,
              geog = ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
              confidence = %s,
              group_capacity = NULL,
              price_per_head = NULL,
              depth_tier = 0,
              enriched_at = NULL,
              wikidata_qid = NULL,
              short_description = NULL
            WHERE gers_id = %s
            """,
            (orig_name, orig_lon, orig_lat, orig_confidence, gers_id),
        )
        conn.commit()
        conn.close()
