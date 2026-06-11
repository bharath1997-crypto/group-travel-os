import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.explorer_cache import ExplorerCache
from app.schemas.explorer import ExplorerCard
from app.services.explorer.explorer_service import ExplorerService
from app.utils.database import Base, engine, SessionLocal


@pytest.fixture
def db():
    import sqlalchemy as sa
    from sqlalchemy.dialects.postgresql import JSONB, ARRAY

    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, JSONB):
                col.type = sa.JSON()
            elif isinstance(col.type, ARRAY):
                col.type = sa.JSON()

    ExplorerCache.__table__.create(bind=engine, checkfirst=True)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.query(ExplorerCache).delete()
        session.commit()
        session.close()


def test_set_cache_and_get_cache_by_key(db):
    service = ExplorerService()
    cache_key = "feed:41.88,-87.63:10000"
    bbox = {"min_lat": 41.0, "max_lat": 42.0, "min_lon": -88.0, "max_lon": -87.0}
    result_ids = [{"id": "card1", "title": "Event A"}]

    service.set_cache(db, cache_key, bbox, result_ids, ttl_seconds=3600)

    cached = service.get_cache(db, cache_key)
    assert cached == result_ids


def test_get_cache_returns_none_when_missing(db):
    service = ExplorerService()
    assert service.get_cache(db, "nonexistent-key") is None


def test_get_cache_returns_none_when_expired(db):
    service = ExplorerService()
    cache_key = "feed:41.88,-87.63:5000"
    bbox = {"min_lat": 41.0, "max_lat": 42.0, "min_lon": -88.0, "max_lon": -87.0}
    result_ids = [{"id": "expired-card"}]

    service.set_cache(db, cache_key, bbox, result_ids, ttl_seconds=-60)

    assert service.get_cache(db, cache_key) is None


def test_set_cache_updates_existing_row(db):
    service = ExplorerService()
    cache_key = "feed:40.0,-75.0:8000"
    bbox = {"min_lat": 39.0, "max_lat": 41.0, "min_lon": -76.0, "max_lon": -74.0}

    service.set_cache(db, cache_key, bbox, ["a"], ttl_seconds=3600)
    service.set_cache(db, cache_key, bbox, ["b", "c"], ttl_seconds=3600)

    assert service.get_cache(db, cache_key) == ["b", "c"]
    assert db.query(ExplorerCache).filter_by(cache_key=cache_key).count() == 1


def test_invalidate_expired_removes_stale_rows(db):
    service = ExplorerService()
    bbox = {"min_lat": 0.0, "max_lat": 1.0, "min_lon": 0.0, "max_lon": 1.0}

    service.set_cache(db, "stale-key", bbox, ["old"], ttl_seconds=-120)
    service.set_cache(db, "fresh-key", bbox, ["new"], ttl_seconds=3600)

    deleted = service.invalidate_expired(db)
    assert deleted == 1
    assert service.get_cache(db, "stale-key") is None
    assert service.get_cache(db, "fresh-key") == ["new"]


@pytest.mark.asyncio
async def test_explorer_service_flow():
    mock_ticketmaster = AsyncMock()
    mock_ticketmaster.fetch_cards.return_value = [
        ExplorerCard(
            id="tm1",
            source="ticketmaster",
            title="Concert",
            type="event",
            normalized_title="concert",
            normalized_venue="venue",
            normalized_city="city",
            location={"name": "venue"},
        )
    ]

    mock_geoapify = AsyncMock()
    mock_geoapify.fetch_cards.return_value = [
        ExplorerCard(
            id="geo1",
            source="geoapify",
            title="Concert",
            type="event",
            normalized_title="concert",
            normalized_venue="venue",
            normalized_city="city",
            location={"name": "venue"},
        )
    ]

    mock_db = MagicMock()
    mock_db.query().filter().first.return_value = None

    service = ExplorerService()
    service.providers["ticketmaster"] = mock_ticketmaster
    service.providers["geoapify"] = mock_geoapify

    mock_foursquare = AsyncMock()
    mock_foursquare.fetch_cards.return_value = []
    service.providers["foursquare"] = mock_foursquare

    mock_template = {
        "country_code": "US",
        "default_radius_meters": 10000,
        "modules": [
            {
                "id": "events",
                "priority": 1,
                "providers": ["ticketmaster", "geoapify", "foursquare"],
                "cache_ttl_hours": 3.0,
            }
        ],
    }
    with patch(
        "app.services.explorer.explorer_service.gemini_ranker.rank_cards",
        new_callable=AsyncMock,
    ) as mock_rank:
        mock_rank.side_effect = lambda cards, context: cards

        with patch(
            "app.services.explorer.explorer_service.country_template_service.get_template",
            return_value=mock_template,
        ):
            results = await service.get_feed(
                lat=41.88, lon=-87.63, radius=10000, db=mock_db
            )

        mock_ticketmaster.fetch_cards.assert_called_once()
        mock_geoapify.fetch_cards.assert_called_once()

        assert len(results) == 1
        assert results[0]["id"] == "tm1"
        assert "geoapify" in results[0]["metadata"].get("other_sources", [])

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called()


@pytest.mark.asyncio
async def test_explorer_service_cache_hit():
    mock_db = MagicMock()

    cached_data = [
        {
            "id": "cached1",
            "source": "ticketmaster",
            "title": "Cached Event",
            "type": "event",
        }
    ]

    mock_cache_row = MagicMock()
    mock_cache_row.result_ids = cached_data
    mock_cache_row.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    mock_db.query().filter().first.return_value = mock_cache_row

    service = ExplorerService()
    mock_ticketmaster = AsyncMock()
    service.providers["ticketmaster"] = mock_ticketmaster

    results = await service.get_feed(lat=41.88, lon=-87.63, radius=10000, db=mock_db)

    assert len(results) == 1
    assert results[0]["id"] == "cached1"
    mock_ticketmaster.fetch_cards.assert_not_called()
