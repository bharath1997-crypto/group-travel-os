"""Tests for Overpass OSM ETL into places table."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.scripts.osm_etl import (
    build_overpass_query,
    fetch_overpass_tile,
    map_category,
    map_node_to_place,
    run_etl,
    upsert_place,
    upsert_places,
)

SAMPLE_NODES = [
    {
        "type": "node",
        "id": 1001,
        "lat": 40.7128,
        "lon": -74.0060,
        "tags": {
            "amenity": "restaurant",
            "name": "Joe's Diner",
            "addr:street": "Main St",
            "addr:city": "New York",
        },
    },
    {
        "type": "node",
        "id": 1002,
        "lat": 40.7580,
        "lon": -73.9855,
        "tags": {
            "tourism": "museum",
            "name": "City Museum",
            "website": "https://museum.example",
        },
    },
    {
        "type": "node",
        "id": 1003,
        "lat": 40.7300,
        "lon": -73.9900,
        "tags": {"amenity": "cafe"},
    },
    {
        "type": "node",
        "id": 1004,
        "lat": 41.0,
        "lon": -80.0,
        "tags": {"natural": "peak", "name": "Mt Test"},
    },
]


@pytest.fixture
def sqlite_db():
    engine = create_engine("sqlite:///:memory:")
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE places (
                    id TEXT PRIMARY KEY,
                    osm_id INTEGER UNIQUE NOT NULL,
                    name TEXT,
                    category TEXT,
                    subcategory TEXT,
                    lat REAL,
                    lng REAL,
                    address TEXT,
                    tags TEXT,
                    website TEXT,
                    phone TEXT,
                    opening_hours TEXT,
                    photo_url TEXT,
                    source TEXT
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


def test_map_category_restaurant_and_landmark():
    assert map_category({"amenity": "cafe"}) == ("restaurant", "cafe")
    assert map_category({"tourism": "museum"}) == ("landmark", "museum")
    assert map_category({"tourism": "theme_park"}) == ("amusement", "theme_park")
    assert map_category({"natural": "peak"}) == ("trekking", "peak")
    assert map_category({"historic": "monument"}) == ("landmark", "monument")
    assert map_category({"amenity": "theatre"}) == ("entertainment", "theatre")
    assert map_category({"amenity": "arts_centre"}) == ("entertainment", "arts_centre")
    assert map_category({"amenity": "bowling_alley"}) == ("gaming", "bowling_alley")
    assert map_category({"leisure": "playground"}) is None


def test_build_overpass_query_excludes_playground():
    query = build_overpass_query(24.0, -125.0, 29.0, -120.0)
    assert "playground" not in query


def test_map_node_to_place_skips_missing_name():
    skipped = map_node_to_place(SAMPLE_NODES[2])
    assert skipped is None


def test_map_node_to_place_maps_fields():
    place = map_node_to_place(SAMPLE_NODES[0])
    assert place is not None
    assert place["osm_id"] == 1001
    assert place["name"] == "Joe's Diner"
    assert place["category"] == "restaurant"
    assert place["subcategory"] == "restaurant"
    assert place["lat"] == 40.7128
    assert place["lng"] == -74.0060
    assert place["address"]["city"] == "New York"
    assert place["address"]["country"] == "US"


def test_build_overpass_query_contains_bbox():
    query = build_overpass_query(24.0, -125.0, 29.0, -120.0)
    assert query.startswith("[out:json][timeout:60];")
    assert "24.0,-125.0,29.0,-120.0" in query
    assert "out body;" in query


def test_fetch_overpass_tile_parses_mock_response():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"elements": SAMPLE_NODES}
    mock_response.raise_for_status = MagicMock()

    mock_client = MagicMock()
    mock_client.post.return_value = mock_response

    elements = fetch_overpass_tile(40.0, -75.0, 41.0, -74.0, client=mock_client)
    assert len(elements) == 4
    mock_client.post.assert_called_once()


def test_upsert_no_duplicate_on_rerun(sqlite_db):
    place = map_node_to_place(SAMPLE_NODES[0])
    assert place is not None

    upsert_place(sqlite_db, place)
    sqlite_db.commit()
    upsert_place(sqlite_db, place)
    sqlite_db.commit()

    count = sqlite_db.execute(text("SELECT COUNT(*) FROM places")).scalar()
    assert count == 1

    row = sqlite_db.execute(
        text("SELECT name, category FROM places WHERE osm_id = :id"),
        {"id": place["osm_id"]},
    ).mappings().one()
    assert row["name"] == "Joe's Diner"
    assert row["category"] == "restaurant"


def test_upsert_places_batch(sqlite_db):
    places = []
    for node in SAMPLE_NODES:
        mapped = map_node_to_place(node)
        if mapped:
            places.append(mapped)

    assert len(places) == 3
    inserted = upsert_places(sqlite_db, places)
    assert inserted == 3

    count = sqlite_db.execute(text("SELECT COUNT(*) FROM places")).scalar()
    assert count == 3


def test_run_etl_with_mocked_overpass(sqlite_db):
    with patch("app.scripts.osm_etl.fetch_overpass_tile", return_value=SAMPLE_NODES):
        with patch("app.scripts.osm_etl.time.sleep"):
            stats = run_etl(
                sw_lat=40.0,
                sw_lng=-75.0,
                ne_lat=40.5,
                ne_lng=-74.5,
                db=sqlite_db,
            )

    assert stats["tiles_completed"] >= 1
    assert stats["total_fetched"] == len(SAMPLE_NODES)
    assert stats["total_inserted"] == 3

    count = sqlite_db.execute(text("SELECT COUNT(*) FROM places")).scalar()
    assert count == 3
