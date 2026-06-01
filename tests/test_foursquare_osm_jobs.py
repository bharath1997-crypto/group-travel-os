from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, delete

from app.main import app
from app.models.explore_content import ExploreContent
from app.utils.database import SessionLocal
from app.jobs.foursquare_fetch import run_foursquare_fetch, generate_grid
from app.jobs.osm_fetch import run_osm_fetch

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
        
        monkeypatch.setattr("os.environ", {"FOURSQUARE_API_KEY": "test-fsq-key"})
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
        
        with patch("httpx.Client.get", return_value=mock_response) as mock_get, patch(
            "time.sleep", return_value=None
        ):
            result = run_foursquare_fetch()
            
        assert mock_get.call_count == 3  # Food, Nightlife, Shopping
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
        
        with patch("httpx.Client.post", return_value=mock_response) as mock_post, patch(
            "time.sleep", return_value=None
        ):
            result = run_osm_fetch()
            
        assert mock_post.call_count == 1
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
