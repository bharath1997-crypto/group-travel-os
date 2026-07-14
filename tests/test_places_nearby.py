from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from app.main import app
from app.services.places_nearby_service import PlacesNearbyService

client = TestClient(app)


@pytest.mark.anyio
async def test_search_nearby_places_success():
    # Mock httpx response from Overpass API
    mock_overpass_response = {
        "elements": [
            {
                "type": "node",
                "id": 11111,
                "lat": 41.91,
                "lon": -87.68,
                "tags": {
                    "name": "Shell Gas",
                    "amenity": "fuel",
                    "addr:street": "N Western Ave",
                    "addr:housenumber": "1234",
                    "addr:city": "Chicago",
                    "addr:state": "IL",
                },
            }
        ]
    }

    class MockResponse:
        def __init__(self, json_data, status_code):
            self._json_data = json_data
            self.status_code = status_code

        def json(self):
            return self._json_data

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = MockResponse(mock_overpass_response, 200)

        results = await PlacesNearbyService.search_nearby_places(
            category="gas",
            lat=41.91,
            lng=-87.68,
            radius_meters=5000,
            limit=15,
        )

        assert len(results) == 1
        assert results[0]["name"] == "Shell Gas"
        assert results[0]["category"] == "Gas station"
        assert results[0]["lat"] == 41.91
        assert results[0]["lng"] == -87.68
        assert results[0]["placeKey"] == "osm:node:11111"
        assert results[0]["distanceMiles"] == 0.0


def test_api_places_nearby_endpoint():
    # Test end-to-end endpoint with mocked service layer
    mock_results = [
        {
            "id": "osm:node:11111",
            "placeKey": "osm:node:11111",
            "name": "Shell Gas",
            "category": "Gas station",
            "address": "1234 N Western Ave, Chicago, IL",
            "lat": 41.91,
            "lng": -87.68,
            "distanceMiles": 0.4,
            "source": "osm",
            "osmType": "node",
            "osmId": "11111",
            "tags": {"amenity": "fuel"},
        }
    ]

    with patch(
        "app.services.places_nearby_service.PlacesNearbyService.search_nearby_places",
        new_callable=AsyncMock,
    ) as mock_search:
        mock_search.return_value = mock_results

        res = client.get(
            "/api/v1/places/nearby",
            params={"category": "gas", "lat": 41.91, "lng": -87.68},
        )
        assert res.status_code == 200
        body = res.json()
        assert "results" in body
        assert len(body["results"]) == 1
        assert body["results"][0]["name"] == "Shell Gas"
        assert body["results"][0]["distanceMiles"] == 0.4


def test_resolve_click_with_useful_properties():
    res = client.post(
        "/api/v1/places/resolve-click",
        json={
            "lat": 41.91,
            "lng": -87.68,
            "clickedName": "Shell Gas",
            "featureProperties": {
                "name": "Shell Gas",
                "amenity": "fuel",
                "addr:housenumber": "1234",
                "addr:street": "N Western Ave",
                "addr:city": "Chicago",
                "addr:state": "IL",
                "osm_id": "11111",
                "osm_type": "node",
            },
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["place"]["name"] == "Shell Gas"
    assert body["place"]["category"] == "Gas station"
    assert body["place"]["source"] == "map_feature"
    assert body["place"]["placeKey"] == "osm:node:11111"
    assert "1234 N Western Ave" in body["place"]["address"]
    assert "Chicago" in body["place"]["address"]


def test_resolve_click_liquor_shop_properties():
    res = client.post(
        "/api/v1/places/resolve-click",
        json={
            "lat": 41.91,
            "lng": -87.68,
            "clickedName": "Binny's",
            "featureProperties": {
                "name": "Binny's",
                "shop": "alcohol",
                "addr:housenumber": "2105",
                "addr:street": "W Armitage Ave",
                "addr:city": "Chicago",
                "addr:state": "IL",
                "osm_id": "22222",
                "osm_type": "node",
            },
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["place"]["category"] == "Liquor store"
    assert "2105 W Armitage Ave" in body["place"]["address"]


def test_resolve_click_with_nearby_search_enrichment():
    mock_nearby = [
        {
            "id": "osm:node:11111",
            "placeKey": "osm:node:11111",
            "name": "Shell Gas Station",
            "category": "Gas station",
            "address": "1234 N Western Ave, Chicago, IL",
            "lat": 41.9101,
            "lng": -87.6801,
            "distanceMiles": 0.01,
            "source": "osm",
            "osmType": "node",
            "osmId": "11111",
            "tags": {"amenity": "fuel"},
        }
    ]

    with patch(
        "app.services.places_nearby_service.PlacesNearbyService.search_nearby_places",
        new_callable=AsyncMock,
    ) as mock_search:
        mock_search.return_value = mock_nearby

        res = client.post(
            "/api/v1/places/resolve-click",
            json={
                "lat": 41.91,
                "lng": -87.68,
                "clickedName": "Shell",
                "featureProperties": {},
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["place"]["name"] == "Shell Gas Station"
        assert body["place"]["category"] == "Gas station"
        assert body["place"]["source"] == "osm_enriched"
        assert len(body["candidates"]) > 0


def test_resolve_click_fallback_reverse_geocode():
    mock_geo = {
        "name": "Western Ave & Division St",
        "address": {"road": "Western Ave", "city": "Chicago", "country": "US"},
        "display_name": "Western Ave & Division St, Chicago, US",
        "osm_type": "way",
        "osm_id": 22222,
    }

    with patch(
        "app.services.places_nearby_service.PlacesNearbyService.search_nearby_places",
        new_callable=AsyncMock,
    ) as mock_search, patch(
        "app.services.geocoding_service.GeocodingService.reverse_geocode",
        new_callable=AsyncMock,
    ) as mock_reverse:
        mock_search.return_value = []
        mock_reverse.return_value = mock_geo

        res = client.post(
            "/api/v1/places/resolve-click",
            json={
                "lat": 41.91,
                "lng": -87.68,
                "clickedName": None,
                "featureProperties": {},
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["place"]["category"] == "Address"
        assert body["place"]["source"] == "reverse_geocode"
        assert body["place"]["placeKey"] == "osm:way:22222"


def test_resolve_click_fallback_dropped_pin():
    with patch(
        "app.services.places_nearby_service.PlacesNearbyService.search_nearby_places",
        new_callable=AsyncMock,
    ) as mock_search, patch(
        "app.services.geocoding_service.GeocodingService.reverse_geocode",
        new_callable=AsyncMock,
    ) as mock_reverse:
        mock_search.return_value = []
        mock_reverse.return_value = None

        res = client.post(
            "/api/v1/places/resolve-click",
            json={
                "lat": 41.91,
                "lng": -87.68,
                "clickedName": None,
                "featureProperties": {},
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["place"]["category"] == "Dropped pin"
        assert body["place"]["source"] == "dropped_pin"


def test_search_places_validation_error():
    res = client.get("/api/v1/search/places", params={"q": "a"})
    assert res.status_code == 422


def test_search_places_endpoint():
    mock_results = [
        {
            "id": "osm:node:22222",
            "name": "Starbucks",
            "address": "123 Main St, Chicago, IL",
            "latitude": 41.8781,
            "longitude": -87.6298,
            "category": "Cafe",
            "distanceMeters": 620,
            "source": "osm_local",
        }
    ]

    with patch(
        "app.services.place_autocomplete_service.PlaceAutocompleteService.search_places",
        new_callable=AsyncMock,
    ) as mock_search:
        mock_search.return_value = mock_results

        res = client.get(
            "/api/v1/search/places",
            params={"q": "coffee", "lat": 41.8781, "lng": -87.6298, "radius_km": 10, "limit": 8},
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body["results"]) == 1
        assert body["results"][0]["name"] == "Starbucks"
        assert body["results"][0]["latitude"] == 41.8781
        assert body["results"][0]["source"] == "osm_local"

