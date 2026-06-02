from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, delete

from app.main import app
from app.models.explore_content import ExploreContent
from app.utils.database import SessionLocal
from app.jobs.foursquare_fetch import run_foursquare_fetch, generate_grid, fetch_with_retry
from app.jobs.osm_fetch import (
    build_osm_query,
    run_osm_fetch,
    _overpass_get,
    OVERPASS_SERVERS,
)
from app.jobs.job_control import foursquare_job, osm_job
from app.utils.foursquare_auth import normalize_foursquare_api_key

client = TestClient(app)

@pytest.fixture(autouse=True)
def _reset_db_session():
    """Clear failed transaction state left by other tests or background tasks."""
    db = SessionLocal()
    try:
        db.rollback()
    finally:
        db.close()
    yield

def test_generate_grid():
    grid = generate_grid(20.0, 30.0, -100.0, -90.0, step=5.0)
    # Expected points:
    # lat=20: lon=-100, -95, -90 (3 points)
    # lat=25: lon=-100, -95, -90 (3 points)
    # lat=30: lon=-100, -95, -90 (3 points)
    # Total = 9 points
    assert len(grid) == 9
    assert grid[0] == {'lat': 20.0, 'lon': -100.0}

def test_normalize_foursquare_api_key_repairs_plus_corruption():
    corrupted = "fsq331maO2syLDq pD2YIsomW5sSJsxPd3ep0lrazwiCtHA="
    assert normalize_foursquare_api_key(corrupted) == "fsq331maO2syLDq+pD2YIsomW5sSJsxPd3ep0lrazwiCtHA="
    assert normalize_foursquare_api_key('"fsq331maO2syLDq+pD2Y"') == "fsq331maO2syLDq+pD2Y"
    assert normalize_foursquare_api_key("Bearer fsq-key") == "fsq-key"

def test_admin_trigger_foursquare_fetch_returns_202(monkeypatch):
    """Verify that the admin trigger Foursquare endpoint returns 202 Accepted."""
    monkeypatch.setattr(
        "app.routes.admin.run_foursquare_fetch",
        lambda: {"fetched": 0, "inserted": 0, "updated": 0},
    )
    response = client.post("/api/v1/admin/trigger-foursquare-fetch")
    assert response.status_code == 202
    assert response.json()["status"] == "success"
    assert "Foursquare fetch triggered" in response.json()["message"]

def test_admin_trigger_osm_fetch_returns_202(monkeypatch):
    """Verify that the admin trigger OSM endpoint returns 202 Accepted."""
    monkeypatch.setattr(
        "app.routes.admin.run_osm_fetch",
        lambda: {"fetched": 0, "inserted": 0, "updated": 0},
    )
    response = client.post("/api/v1/admin/trigger-osm-fetch")
    assert response.status_code == 202
    assert response.json()["status"] == "success"
    assert "OSM fetch triggered" in response.json()["message"]

def test_run_foursquare_fetch_job(monkeypatch):
    """Test run_foursquare_fetch with a mocked Foursquare API response and verify DB insertion."""
    fsq_id = f"test_fsq_job_{uuid.uuid4().hex[:12]}"
    event_id = f"fsq_{fsq_id}"
    
    db = SessionLocal()
    try:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id == event_id))
        db.commit()
        
        monkeypatch.setattr(
            "app.jobs.foursquare_fetch.normalize_foursquare_api_key",
            lambda raw=None: "test-fsq-key",
        )
        # Minimize grid for testing to execute immediately
        monkeypatch.setattr("app.jobs.foursquare_fetch.US_GRID", [{'lat': 30.2672, 'lon': -97.7431}])
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {
                    "fsq_id": fsq_id,
                    "name": "Unique Bistro Shop",
                    "geocodes": {"main": {"latitude": 30.2672, "longitude": -97.7431}},
                    "location": {"city": "Austin", "state": "Texas", "country": "US"},
                    "photos": [{"prefix": "https://example.com/prefix/", "suffix": "/suffix.jpg"}],
                    "price": 2,
                    "rating": 8.6,
                    "categories": [{"id": 13000, "name": "Bistro"}],
                    "stats": {}
                }
            ]
        }
        
        with patch("httpx.Client.get", return_value=mock_response) as mock_get, patch.object(
            foursquare_job, "sleep", return_value=False
        ):
            result = run_foursquare_fetch()
            
        assert mock_get.call_count == 4  # smoke test + Food, Nightlife, Shopping
        first_headers = mock_get.call_args_list[0].kwargs.get("headers", {})
        assert first_headers.get("Authorization") == "Bearer test-fsq-key"
        assert first_headers.get("Accept") == "application/json"
        assert first_headers.get("X-Places-Api-Version") == "2025-06-17"
        assert result["fetched"] > 0
        assert result["inserted"] >= 1
        
        inserted = db.scalar(
            select(ExploreContent).where(ExploreContent.event_id == event_id)
        )
        assert inserted is not None
        assert inserted.title == "Unique Bistro Shop"
        assert inserted.category == "Food"  # Since Food category_id was fetched first in order
        assert inserted.venue_name == "Unique Bistro Shop"
        assert inserted.venue_lat == 30.2672
        assert inserted.venue_lon == -97.7431
        assert inserted.city == "Austin"
        assert inserted.state == "Texas"
        assert inserted.image_url == "https://example.com/prefix/300x200/suffix.jpg"
        assert inserted.price_min == 15.0  # mapped from price=2
        assert inserted.source == "foursquare"
        assert isinstance(inserted.data, list)
        assert inserted.data[0]["rating"] == 4.3  # 8.6 / 2
        assert inserted.data[0]["country"] == "US"
        
    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id == event_id))
        db.commit()
        db.close()

def test_fetch_with_retry_handles_429(monkeypatch):
    client = MagicMock()
    rate_limited = MagicMock(status_code=429, text="rate limited")
    success = MagicMock(status_code=200, text="ok")

    client.get.side_effect = [rate_limited, rate_limited, success]
    sleeps: list[float] = []
    monkeypatch.setattr(
        "app.jobs.foursquare_fetch.foursquare_job.sleep",
        lambda s: sleeps.append(s) or False,
    )

    response = fetch_with_retry(
        client,
        "https://example.com",
        headers={"Authorization": "Bearer test"},
        params={"ll": "1,2"},
    )

    assert response is success
    assert client.get.call_count == 3
    assert sleeps == [1, 2]

def test_build_osm_query_is_lightweight():
    query = build_osm_query('"amenity"="arcade"', 41.8781, -87.6298)
    assert query.startswith("[out:json][timeout:20];")
    assert "node[\"amenity\"=\"arcade\"](around:30000,41.8781,-87.6298);" in query
    assert query.endswith("out body 10;")

def test_overpass_get_tries_next_server_on_failure():
    client = MagicMock()
    fail = MagicMock(status_code=504, text="Gateway Timeout")
    ok = MagicMock(status_code=200, text='{"elements":[]}')
    client.get.side_effect = [fail, ok]

    response = _overpass_get(client, "[out:json];node(1);out;")
    assert response is ok
    assert client.get.call_count == 2
    assert client.get.call_args_list[0].args[0] == OVERPASS_SERVERS[0]
    assert client.get.call_args_list[1].args[0] == OVERPASS_SERVERS[1]

def test_run_osm_fetch_job(monkeypatch):
    """Test run_osm_fetch with a mocked Overpass API response and verify DB insertion."""
    osm_id = 123456789
    event_id = f"osm_{osm_id}"
    
    db = SessionLocal()
    try:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id == event_id))
        db.commit()
        
        # Minimize grid for testing to execute immediately
        monkeypatch.setattr("app.jobs.osm_fetch.US_GRID", [{'lat': 30.2672, 'lon': -97.7431}])
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "elements": [
                {
                    "id": osm_id,
                    "lat": 30.2672,
                    "lon": -97.7431,
                    "tags": {
                        "name": "Super Fun Arcade Center",
                        "amenity": "arcade",
                        "addr:city": "Austin",
                        "addr:state": "TX",
                        "addr:country": "US"
                    }
                }
            ]
        }
        
        with patch("httpx.Client.get", return_value=mock_response) as mock_get, patch.object(
            osm_job, "sleep", return_value=False
        ):
            result = run_osm_fetch()
            
        # smoke test + one tag query per metro point (grid patched to 1 point)
        assert mock_get.call_count >= 2
        get_kwargs = mock_get.call_args.kwargs
        query = get_kwargs.get("params", {}).get("data", "")
        assert query.startswith("[out:json][timeout:20];")
        assert "node[" in query
        assert "out body 10;" in query
        assert get_kwargs.get("headers", {}).get("Accept") == "application/json"
        assert "RovvyExplore" in get_kwargs.get("headers", {}).get("User-Agent", "")
        assert mock_get.call_args.args[0] == OVERPASS_SERVERS[0]
        assert result["fetched"] > 0
        assert result["inserted"] >= 1
        
        inserted = db.scalar(
            select(ExploreContent).where(ExploreContent.event_id == event_id)
        )
        assert inserted is not None
        assert inserted.title == "Super Fun Arcade Center"
        assert inserted.category == "Gaming"  # amenity=arcade maps to Gaming
        assert inserted.venue_name == "Super Fun Arcade Center"
        assert inserted.venue_lat == 30.2672
        assert inserted.venue_lon == -97.7431
        assert inserted.city == "Austin"
        assert inserted.state == "TX"
        assert inserted.source == "openstreetmap"
        assert isinstance(inserted.data, list)
        assert inserted.data[0]["country"] == "US"
        
    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id == event_id))
        db.commit()
        db.close()
