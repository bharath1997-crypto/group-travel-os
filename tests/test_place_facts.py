"""
Place facts (F50) unit tests + optional Postgres upsert read test.

Postgres upsert/read (opt-in, rolled back):

  SCAPER_PG_TEST_URL=postgresql://USER:PASS@HOST:5432/db \\
    pytest tests/test_place_facts.py -v -k upsert

Requires migrations/012_place_facts.sql applied inside the `pg_place_facts` fixture transaction.
All other tests run on sqlite CI with mocks (no network).
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.main import app
from app.schemas.place_facts import PlaceFactOut
from app.schemas.place_spine import PlaceSpineDetail
import time
from dataclasses import dataclass

from app.services.place_facts_match import (
    haversine_meters,
    match_places_to_osm_brute,
    match_places_to_osm_indexed,
    normalize_place_name,
    osm_fact_rows_from_tags,
    osm_matches_place,
)
from app.services.place_facts_opening_hours import opening_hours_structurally_valid
from app.services.place_facts_service import PlaceFactsService
from app.services.place_facts_wikipedia import first_paragraph, wikipedia_fact_from_qid
from app.services.place_spine_service import PlaceSpineService

client = TestClient(app)

MIGRATION_012 = Path(__file__).resolve().parents[1] / "migrations" / "012_place_facts.sql"


def test_normalize_place_name():
    assert normalize_place_name("The Art Institute of Chicago") == normalize_place_name(
        "the art institute of chicago"
    )


def test_osm_match_accept_30m_same_name():
    assert osm_matches_place(
        place_name="Millennium Park",
        place_lat=41.8826,
        place_lon=-87.6226,
        place_wikidata_qid=None,
        place_website=None,
        osm_name="Millennium Park",
        osm_lat=41.8827,
        osm_lon=-87.6226,
        osm_tags={"name": "Millennium Park"},
        max_radius_m=50,
    )


def test_osm_match_reject_80m():
    assert not osm_matches_place(
        place_name="Millennium Park",
        place_lat=41.8826,
        place_lon=-87.6226,
        place_wikidata_qid=None,
        place_website=None,
        osm_name="Millennium Park",
        osm_lat=41.89,
        osm_lon=-87.6226,
        osm_tags={"name": "Millennium Park"},
        max_radius_m=50,
    )


def test_osm_match_reject_different_name():
    dist = haversine_meters(41.8826, -87.6226, 41.8827, -87.6226)
    assert dist < 50
    assert not osm_matches_place(
        place_name="Millennium Park",
        place_lat=41.8826,
        place_lon=-87.6226,
        place_wikidata_qid=None,
        place_website=None,
        osm_name="Grant Park",
        osm_lat=41.8827,
        osm_lon=-87.6226,
        osm_tags={"name": "Grant Park"},
    )


def test_osm_facts_odbl_credit():
    rows = osm_fact_rows_from_tags(
        {"opening_hours": "Mo-Fr 09:00-17:00", "wheelchair": "yes"},
        source_url="https://www.openstreetmap.org/node/1",
    )
    assert rows[0]["license"] == "ODbL"
    assert "OpenStreetMap" in rows[0]["attribution"]


def test_invalid_opening_hours_not_structurally_valid():
    assert not opening_hours_structurally_valid("Mo-Fr 09:00-17:00; Sa 10:00-14:00")
    assert opening_hours_structurally_valid("Mo-Fr 09:00-17:00")
    assert opening_hours_structurally_valid("24/7")


def test_wikipedia_first_paragraph():
    text = "First para.\n\nSecond para."
    assert first_paragraph(text) == "First para."


def test_wikipedia_fact_from_qid_mocked():
    entity = {
        "sitelinks": {"enwiki": {"title": "Art Institute of Chicago"}},
    }
    summary = {
        "title": "Art Institute of Chicago",
        "extract": "The Art Institute of Chicago is a museum.",
        "source_url": "https://en.wikipedia.org/wiki/Art_Institute_of_Chicago",
    }
    with patch(
        "app.services.place_facts_wikipedia.fetch_wikidata_entity",
        return_value=entity,
    ), patch(
        "app.services.place_facts_wikipedia.fetch_wikipedia_summary",
        return_value=summary,
    ):
        fact = wikipedia_fact_from_qid("Q1568434")
    assert fact is not None
    assert fact["license"] == "CC BY-SA 4.0"
    assert fact["attribution"] == "Wikipedia"
    assert fact["key"] == "extract"


def test_wikipedia_skips_disambiguation():
    with patch(
        "app.services.place_facts_wikipedia.fetch_wikidata_entity",
        return_value={"sitelinks": {"enwiki": {"title": "Mercury"}}},
    ), patch(
        "app.services.place_facts_wikipedia.fetch_wikipedia_summary",
        return_value=None,
    ):
        assert wikipedia_fact_from_qid("Q123") is None


def test_spine_endpoint_includes_facts_empty():
    mock_detail = PlaceSpineDetail(
        gers_id="08f2664a1c2b3d4e5f6789012345678",
        name="Sample",
        category="museum",
        category_label="Museum",
        lat=41.88,
        lon=-87.63,
        facts=[],
    )
    with patch.object(PlaceSpineService, "get_by_gers_id", return_value=mock_detail):
        res = client.get("/api/v1/places/spine/08f2664a1c2b3d4e5f6789012345678")
    assert res.status_code == 200
    assert res.json()["facts"] == []


def test_spine_endpoint_facts_with_odbl():
    facts = [
        PlaceFactOut(
            key="opening_hours",
            value="Mo-Fr 09:00-17:00",
            source="osm",
            source_url="https://www.openstreetmap.org/node/1",
            license="ODbL",
            attribution="© OpenStreetMap contributors",
        )
    ]
    mock_detail = PlaceSpineDetail(
        gers_id="08f2664a1c2b3d4e5f6789012345678",
        name="Sample",
        category="museum",
        category_label="Museum",
        lat=41.88,
        lon=-87.63,
        facts=facts,
    )
    with patch.object(PlaceSpineService, "get_by_gers_id", return_value=mock_detail):
        res = client.get("/api/v1/places/spine/08f2664a1c2b3d4e5f6789012345678")
    body = res.json()
    assert body["facts"][0]["attribution"].startswith("© OpenStreetMap")


@pytest.fixture()
def pg_place_facts():
    url = os.getenv("SCAPER_PG_TEST_URL")
    if not url or not url.startswith("postgres"):
        pytest.skip("set SCAPER_PG_TEST_URL (postgresql://…) for place_facts Postgres tests")
    engine = create_engine(url)
    conn = engine.connect()
    outer = conn.begin()
    try:
        conn.exec_driver_sql(MIGRATION_012.read_text(encoding="utf-8"))
        place_id = uuid.uuid4()
        gers_id = "a" * 32
        conn.execute(
            text(
                """
                INSERT INTO places (id, gers_id, name, geog, city_slug)
                VALUES (
                  :id, :gers_id, 'Facts Test Place',
                  ST_SetSRID(ST_MakePoint(-87.63, 41.88), 4326)::geography,
                  'chicago'
                )
                """
            ),
            {"id": str(place_id), "gers_id": gers_id},
        )
        from sqlalchemy.orm import Session

        session = Session(bind=conn)
        yield session, str(place_id), gers_id
    finally:
        outer.rollback()
        conn.close()
        engine.dispose()


def test_place_facts_upsert_and_read_pg(pg_place_facts):
    session, place_id, gers_id = pg_place_facts
    PlaceFactsService.upsert_fact(
        session,
        place_id,
        {
            "key": "extract",
            "value": "A museum in Chicago.",
            "source": "wikipedia",
            "source_url": "https://en.wikipedia.org/wiki/X",
            "license": "CC BY-SA 4.0",
            "attribution": "Wikipedia",
        },
    )
    session.flush()
    facts = PlaceFactsService.facts_for_gers_id(session, gers_id)
    assert len(facts) == 1
    assert facts[0].key == "extract"


@dataclass
class _SyntheticOsm:
    osm_id: int
    lat: float
    lon: float
    name: str | None
    tags: dict


def _synthetic_osm_grid(count: int, *, base_lat: float = 41.88, base_lon: float = -87.63) -> list[_SyntheticOsm]:
    pois: list[_SyntheticOsm] = []
    for i in range(count):
        # Spread across ~2 km so most cells are sparse; occasional name collisions by design.
        lat = base_lat + (i % 200) * 0.00008
        lon = base_lon + (i // 200) * 0.00011
        name = f"Venue {i % 17}" if i % 23 else f"Unique Match {i}"
        tags = {"name": name}
        if i % 50 == 0:
            tags["wikidata"] = f"Q{i}"
        pois.append(_SyntheticOsm(osm_id=i, lat=lat, lon=lon, name=name, tags=tags))
    return pois


def test_osm_index_matches_brute_force() -> None:
    pois = _synthetic_osm_grid(4000)
    places = [
        {
            "id": f"p{i}",
            "gers_id": f"g{i}",
            "name": f"Unique Match {i * 50}" if i % 50 == 0 else f"Venue {i % 17}",
            "lat": pois[i * 3].lat + 0.00001,
            "lon": pois[i * 3].lon + 0.00001,
            "wikidata_qid": f"Q{i * 50}" if i % 50 == 0 else None,
            "website": None,
        }
        for i in range(120)
    ]
    brute = match_places_to_osm_brute(places, pois)
    indexed = match_places_to_osm_indexed(places, pois)
    assert [k for k, _ in brute] == [k for k, _ in indexed]
    assert [p.osm_id for _, p in brute] == [p.osm_id for _, p in indexed]


def test_osm_index_speed_under_two_seconds() -> None:
    pois = _synthetic_osm_grid(5000)
    places = [
        {
            "id": f"p{i}",
            "gers_id": f"g{i}",
            "name": f"Venue {i % 17}",
            "lat": 41.881 + (i % 100) * 0.0002,
            "lon": -87.631 + (i // 100) * 0.0002,
            "wikidata_qid": None,
            "website": None,
        }
        for i in range(800)
    ]
    t0 = time.perf_counter()
    match_places_to_osm_indexed(places, pois)
    elapsed = time.perf_counter() - t0
    assert elapsed < 2.0


def test_facts_service_missing_table_returns_empty():
    from sqlalchemy.exc import ProgrammingError

    db = MagicMock()
    db.execute.side_effect = ProgrammingError("stmt", {}, Exception("missing"))
    assert PlaceFactsService.facts_for_place_uuid(db, uuid.uuid4()) == []
    db.rollback.assert_called_once()
