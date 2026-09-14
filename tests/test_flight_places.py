"""Tests for flight airport places API."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.flight_places import FlightPlaceSuggestion
from app.services import airport_dataset_service
from app.services.airport_dataset_service import AirportDatasetService
from app.services.flight_places_service import FlightPlacesService

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clear_airport_cache():
    airport_dataset_service._load_records.cache_clear()
    yield
    airport_dataset_service._load_records.cache_clear()


def test_airport_dataset_loads_with_iata_codes():
    assert AirportDatasetService.is_configured()
    ord_row = AirportDatasetService.get_by_iata("ORD")
    assert ord_row is not None
    assert ord_row.name


def test_airport_dataset_search_by_city():
    hits = AirportDatasetService.search("Chicago", limit=5)
    codes = {row.iata for row in hits}
    assert "ORD" in codes or "MDW" in codes


def test_nearby_airports_sorted_by_distance():
    # Near Chicago O'Hare coordinates
    ranked = AirportDatasetService.nearby(41.9742, -87.9073, limit=5)
    assert ranked
    distances = [dist for _, dist in ranked]
    assert distances == sorted(distances)
    assert ranked[0][0].iata in {"ORD", "MDW", "PWK", "DPA", "UGN"}


def test_nearby_rejects_invalid_coordinates():
    response = client.get("/api/v1/flights/airports/nearby", params={"lat": 999, "lng": 0})
    assert response.status_code == 422


def test_nearby_endpoint_returns_real_airports():
    response = client.get(
        "/api/v1/flights/airports/nearby",
        params={"lat": 41.9742, "lng": -87.9073, "limit": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["airports"]
    first = body["airports"][0]
    assert len(first["iata"]) == 3
    assert first["distance_km"] is not None


def test_validate_iata_for_known_airport():
    response = client.get("/api/v1/flights/places/validate", params={"iata": "ORD"})
    assert response.status_code == 200
    assert response.json()["valid"] is True


def test_validate_iata_rejects_garbage():
    response = client.get("/api/v1/flights/places/validate", params={"iata": "ZZZ"})
    assert response.status_code == 200
    assert response.json()["valid"] is False


@patch("app.services.flight_places_service._from_travelpayouts_places")
def test_places_autocomplete_route(mock_tp):
    mock_tp.return_value = [
        FlightPlaceSuggestion(
            id="tp-city-CHI",
            label="Chicago, United States",
            detail="All airports · CHI",
            iata="CHI",
            place_type="city",
        )
    ]
    response = client.get("/api/v1/flights/places", params={"q": "chi"})
    assert response.status_code == 200
    rows = response.json()
    assert rows
    assert rows[0]["iata"] == "CHI"


def test_countries_browse_endpoint():
    response = client.get("/api/v1/flights/airports/countries")
    assert response.status_code == 200
    rows = response.json()
    assert rows
    assert any(row["code"] == "US" for row in rows)


def test_regions_and_cities_for_us():
    regions = client.get("/api/v1/flights/airports/regions", params={"country": "US"})
    assert regions.status_code == 200
    region_rows = regions.json()
    assert region_rows

    cities = client.get(
        "/api/v1/flights/airports/cities",
        params={"country": "US", "region": "US-IL"},
    )
    assert cities.status_code == 200
    city_rows = cities.json()
    assert city_rows
    assert any("Chicago" in row["name"] or row["name"] for row in city_rows)


def test_list_airports_for_city():
    airports = client.get(
        "/api/v1/flights/airports",
        params={"country": "US", "region": "US-IL", "city": "Chicago", "limit": 10},
    )
    assert airports.status_code == 200
    rows = airports.json()
    codes = {row["iata"] for row in rows}
    assert "ORD" in codes or "MDW" in codes


def test_empty_places_query_returns_empty_list():
    response = client.get("/api/v1/flights/places", params={"q": ""})
    assert response.status_code == 200
    assert response.json() == []


@patch("app.services.flight_places_service._from_travelpayouts_places")
@patch("app.services.flight_places_service._from_duffel_places")
@patch("app.services.flight_places_service._from_kiwi_locations")
def test_suggest_returns_empty_without_providers_or_dataset_match(mock_kiwi, mock_duffel, mock_tp):
    mock_duffel.return_value = []
    mock_tp.return_value = []
    mock_kiwi.return_value = []
    rows = FlightPlacesService.suggest("zzzzzznotfound", limit=5)
    assert rows == []
