"""Tests for multi-source place photo enrichment."""
from __future__ import annotations

import hashlib
import json
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.scripts.enrich_photos import (
    PEXELS_CATEGORY_QUERIES,
    UNSPLASH_FALLBACK_SQL,
    build_mapillary_params,
    build_wikimedia_commons_url,
    pexels_photo_index,
    run_enrichment,
    run_tier1_wikimedia,
    run_tier4_unsplash,
)


@pytest.fixture
def sqlite_db():
    engine = create_engine("sqlite:///:memory:")
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE places (
                    id TEXT PRIMARY KEY,
                    osm_id INTEGER,
                    name TEXT,
                    category TEXT,
                    lat REAL,
                    lng REAL,
                    tags TEXT,
                    photo_url TEXT,
                    photo_source TEXT
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


def _insert_place(
    db,
    *,
    place_id: str,
    osm_id: int,
    category: str,
    tags: dict | None = None,
    lat: float | None = 40.0,
    lng: float | None = -74.0,
    photo_url: str | None = None,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO places (id, osm_id, name, category, lat, lng, tags, photo_url)
            VALUES (:id, :osm_id, :name, :category, :lat, :lng, :tags, :photo_url)
            """
        ),
        {
            "id": place_id,
            "osm_id": osm_id,
            "name": "Test Place",
            "category": category,
            "lat": lat,
            "lng": lng,
            "tags": json.dumps(tags or {}),
            "photo_url": photo_url,
        },
    )
    db.commit()


def test_build_wikimedia_commons_url_from_filename():
    filename = "Eiffel Tower view.jpg"
    url = build_wikimedia_commons_url(filename)
    normalized = filename.replace(" ", "_")
    digest = hashlib.md5(normalized.encode("utf-8")).hexdigest()
    expected = (
        f"https://upload.wikimedia.org/wikipedia/commons/"
        f"{digest[0]}/{digest[0:2]}/{normalized}"
    )
    assert url == expected


def test_build_wikimedia_commons_md5_path_segments():
    filename = "Test_File.png"
    url = build_wikimedia_commons_url(filename)
    digest = hashlib.md5(filename.encode("utf-8")).hexdigest()
    assert f"/{digest[0]}/{digest[0:2]}/Test_File.png" in url


def test_pexels_photo_index_uses_osm_id_modulo():
    assert pexels_photo_index(1001) == 1001 % 15
    assert pexels_photo_index(0) == 0
    assert pexels_photo_index(29) == 14


def test_build_mapillary_params_radius_and_closeto():
    params = build_mapillary_params(40.7128, -74.0060, "token-123", radius=50, limit=1)
    assert params["access_token"] == "token-123"
    assert params["fields"] == "id,thumb_256_url"
    assert params["closeto"] == "-74.006,40.7128"
    assert params["radius"] == 50
    assert params["limit"] == 1


def test_unsplash_fallback_sql_covers_all_pexels_categories():
    for category in PEXELS_CATEGORY_QUERIES:
        assert f"WHEN '{category}' THEN" in UNSPLASH_FALLBACK_SQL
    assert "photo_source = 'unsplash'" in UNSPLASH_FALLBACK_SQL


def test_dry_run_produces_no_db_writes(sqlite_db):
    _insert_place(sqlite_db, place_id="p1", osm_id=101, category="restaurant")
    _insert_place(sqlite_db, place_id="p2", osm_id=202, category="park")

    counts = run_enrichment(sqlite_db, tier="4", dry_run=True)

    assert counts["tier4_unsplash"] == 2

    rows = sqlite_db.execute(
        text("SELECT photo_url, photo_source FROM places ORDER BY id")
    ).mappings().all()
    assert all(row["photo_url"] is None for row in rows)
    assert all(row["photo_source"] is None for row in rows)


def test_limit_restricts_rows_processed(sqlite_db):
    for idx in range(5):
        _insert_place(
            sqlite_db,
            place_id=f"p{idx}",
            osm_id=1000 + idx,
            category="restaurant",
        )

    updated = run_tier4_unsplash(sqlite_db, limit=2, dry_run=True)
    assert updated == 2


def test_tier1_updates_place_from_wikidata(sqlite_db):
    _insert_place(
        sqlite_db,
        place_id="wiki-1",
        osm_id=5001,
        category="landmark",
        tags={"wikidata": "Q42"},
    )

    select_result = MagicMock()
    select_result.mappings.return_value.all.return_value = [
        {"id": "wiki-1", "osm_id": 5001, "tags": {"wikidata": "Q42"}},
    ]

    mock_client = MagicMock()

    real_execute = sqlite_db.execute

    def execute_side_effect(statement, params=None):
        if "SELECT id, osm_id, tags" in str(statement):
            return select_result
        return real_execute(statement, params)

    with patch.object(sqlite_db, "execute", side_effect=execute_side_effect):
        with patch("app.scripts.enrich_photos.time.sleep"):
            with patch(
                "app.scripts.enrich_photos.fetch_wikidata_image_filename",
                return_value="Monument.jpg",
            ):
                updated = run_tier1_wikimedia(sqlite_db, client=mock_client)

    assert updated == 1
    row = sqlite_db.execute(
        text("SELECT photo_url, photo_source FROM places WHERE id = 'wiki-1'")
    ).mappings().one()
    assert row["photo_source"] == "wikimedia"
    assert row["photo_url"].startswith("https://upload.wikimedia.org/wikipedia/commons/")


def test_tier4_updates_null_photo_urls(sqlite_db):
    _insert_place(sqlite_db, place_id="u1", osm_id=1, category="gaming")
    _insert_place(
        sqlite_db,
        place_id="u2",
        osm_id=2,
        category="restaurant",
        photo_url="https://existing.example/photo.jpg",
    )

    updated = run_tier4_unsplash(sqlite_db)
    assert updated == 1

    gaming = sqlite_db.execute(
        text("SELECT photo_url, photo_source FROM places WHERE id = 'u1'")
    ).mappings().one()
    assert gaming["photo_source"] == "unsplash"
    assert "unsplash.com" in gaming["photo_url"]

    existing = sqlite_db.execute(
        text("SELECT photo_url FROM places WHERE id = 'u2'")
    ).mappings().one()
    assert existing["photo_url"] == "https://existing.example/photo.jpg"
