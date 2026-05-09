import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.explorer.explorer_service import ExplorerService
from app.schemas.explorer import ExplorerCard
from app.models.explorer_cache import ExplorerCache

@pytest.mark.asyncio
async def test_explorer_service_flow():
    # 1. Setup mocks for providers
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
            location={"name": "venue"}
        )
    ]
    
    mock_geoapify = AsyncMock()
    mock_geoapify.fetch_cards.return_value = [
        ExplorerCard(
            id="geo1",
            source="geoapify",
            title="Concert", # Duplicate of Ticketmaster item
            type="event",
            normalized_title="concert",
            normalized_venue="venue",
            normalized_city="city",
            location={"name": "venue"}
        )
    ]
    
    # 2. Mock DB session
    mock_db = MagicMock()
    # Mock cache miss (return None for the query)
    mock_db.query().filter().first.return_value = None
    
    # 3. Initialize service and inject mocks
    service = ExplorerService()
    service.providers["ticketmaster"] = mock_ticketmaster
    service.providers["geoapify"] = mock_geoapify
    
    # Mock Foursquare to return empty list
    mock_foursquare = AsyncMock()
    mock_foursquare.fetch_cards.return_value = []
    service.providers["foursquare"] = mock_foursquare
    
    # Mock AI ranker to avoid real API calls and check what was passed
    with patch('app.services.explorer.explorer_service.gemini_ranker.rank_cards', new_callable=AsyncMock) as mock_rank:
        # Just return the cards as they are to test the flow
        mock_rank.side_effect = lambda cards, context: cards
        
        # 4. Call get_feed
        results = await service.get_feed(lat=41.88, lon=-87.63, radius=10000, db=mock_db)
        
        # 5. Assertions
        
        # Check that providers were called
        mock_ticketmaster.fetch_cards.assert_called_once()
        mock_geoapify.fetch_cards.assert_called_once()
        
        # Check Deduplication: Since they are duplicates, length should be 1
        assert len(results) == 1
        assert results[0]["id"] == "tm1" # Kept the first one (Ticketmaster)
        
        # Check that the other source was recorded in metadata
        assert "geoapify" in results[0]["metadata"].get("other_sources", [])
        
        # Check that cache was saved
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_explorer_service_cache_hit():
    # 1. Setup mock DB with cached data
    mock_db = MagicMock()
    
    cached_data = [
        {
            "id": "cached1",
            "source": "ticketmaster",
            "title": "Cached Event",
            "type": "event"
        }
    ]
    
    mock_cache_row = MagicMock()
    mock_cache_row.data = cached_data
    mock_cache_row.fetched_at = datetime.now(timezone.utc)
    
    mock_db.query().filter().first.return_value = mock_cache_row
    
    # 2. Initialize service with mocked providers that SHOULD NOT be called
    service = ExplorerService()
    mock_ticketmaster = AsyncMock()
    service.providers["ticketmaster"] = mock_ticketmaster
    
    # 3. Call get_feed
    results = await service.get_feed(lat=41.88, lon=-87.63, radius=10000, db=mock_db)
    
    # 4. Assertions
    assert len(results) == 1
    assert results[0]["id"] == "cached1"
    
    # Providers should NOT have been called on cache hit
    mock_ticketmaster.fetch_cards.assert_not_called()
