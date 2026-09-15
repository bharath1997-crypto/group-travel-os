"""Phase 4A Amadeus Self-Service provider tests."""

from __future__ import annotations

import logging
import subprocess
import sys
import time
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.schemas.flight_journey import (
    FlightSearchPassengerRequest,
    FlightSearchRequest,
    FlightSearchSliceRequest,
)
from app.services.flight_providers.amadeus_normalizer import (
    _merge_traveler_segment_status,
    _offer_checked_bag_included,
    _parse_checked_bags,
    normalize_amadeus_offers,
)
from app.services.flight_providers.amadeus_oauth import AmadeusOAuthClient, AmadeusOAuthError
from app.services.flight_providers.amadeus_provider import AmadeusFlightProvider
from app.services.flight_providers.coordinator import FlightSearchCoordinator
from app.services.flight_providers.normalizer import group_offers_into_itineraries, journey_to_offer
from app.services.flight_providers.registry import enabled_providers, provider_registry_records
from app.services.flight_providers.types import ProviderSearchResult, ProviderStatus, RovvyFlightSearchRequest
from tests.test_flight_provider_registry import _FakeProvider, _body, _offer


def _one_way_body() -> FlightSearchRequest:
    return FlightSearchRequest(
        trip_type="one_way",
        slices=[
            FlightSearchSliceRequest(
                origin="ORD",
                destination="LAX",
                departure_date=date.today() + timedelta(days=30),
            )
        ],
        passengers=[FlightSearchPassengerRequest(type="adult")],
    )


def _round_trip_body() -> FlightSearchRequest:
    departure = date.today() + timedelta(days=30)
    return FlightSearchRequest(
        trip_type="round_trip",
        slices=[
            FlightSearchSliceRequest(origin="ORD", destination="LHR", departure_date=departure),
            FlightSearchSliceRequest(origin="LHR", destination="ORD", departure_date=departure + timedelta(days=7)),
        ],
        passengers=[FlightSearchPassengerRequest(type="adult")],
    )


def _multi_city_body() -> FlightSearchRequest:
    departure = date.today() + timedelta(days=30)
    return FlightSearchRequest(
        trip_type="multi_city",
        slices=[
            FlightSearchSliceRequest(origin="ORD", destination="LAX", departure_date=departure),
            FlightSearchSliceRequest(origin="LAX", destination="SFO", departure_date=departure + timedelta(days=3)),
        ],
        passengers=[FlightSearchPassengerRequest(type="adult")],
    )


AMADEUS_ONE_WAY_PAYLOAD = {
    "data": [
        {
            "type": "flight-offer",
            "id": "1",
            "lastTicketingDate": "2026-12-01",
            "validatingAirlineCodes": ["AA"],
            "itineraries": [
                {
                    "duration": "PT4H25M",
                    "segments": [
                        {
                            "id": "seg-1",
                            "departure": {"iataCode": "ORD", "at": "2026-10-10T08:00:00"},
                            "arrival": {"iataCode": "LAX", "at": "2026-10-10T10:25:00"},
                            "carrierCode": "AA",
                            "number": "100",
                            "aircraft": {"code": "738"},
                            "operating": {"carrierCode": "AA"},
                            "duration": "PT4H25M",
                        }
                    ],
                }
            ],
            "price": {"currency": "USD", "total": "250.00", "base": "200.00"},
            "travelerPricings": [
                {
                    "fareDetailsBySegment": [
                        {"segmentId": "seg-1", "includedCheckedBags": {"quantity": 1}}
                    ]
                }
            ],
        }
    ],
    "dictionaries": {"carriers": {"AA": "American Airlines"}, "aircraft": {"738": "737-800"}},
}

AMADEUS_CONNECTING_PAYLOAD = {
    "data": [
        {
            "type": "flight-offer",
            "id": "2",
            "validatingAirlineCodes": ["UA"],
            "itineraries": [
                {
                    "duration": "PT8H10M",
                    "segments": [
                        {
                            "id": "seg-a",
                            "departure": {"iataCode": "ORD", "at": "2026-10-10T08:00:00"},
                            "arrival": {"iataCode": "DEN", "at": "2026-10-10T10:00:00"},
                            "carrierCode": "UA",
                            "number": "500",
                            "duration": "PT3H00M",
                        },
                        {
                            "id": "seg-b",
                            "departure": {"iataCode": "DEN", "at": "2026-10-10T11:30:00"},
                            "arrival": {"iataCode": "LAX", "at": "2026-10-10T13:10:00"},
                            "carrierCode": "UA",
                            "number": "700",
                            "duration": "PT2H40M",
                        },
                    ],
                }
            ],
            "price": {"currency": "USD", "total": "320.00"},
            "travelerPricings": [{"fareDetailsBySegment": [{"segmentId": "seg-a"}]}],
        }
    ],
    "dictionaries": {"carriers": {"UA": "United Airlines"}},
}

AMADEUS_ROUND_TRIP_PAYLOAD = {
    "data": [
        {
            "type": "flight-offer",
            "id": "3",
            "validatingAirlineCodes": ["BA"],
            "itineraries": [
                {
                    "duration": "PT8H00M",
                    "segments": [
                        {
                            "id": "out-1",
                            "departure": {"iataCode": "ORD", "at": "2026-10-10T18:00:00"},
                            "arrival": {"iataCode": "LHR", "at": "2026-10-11T08:00:00"},
                            "carrierCode": "BA",
                            "number": "296",
                            "duration": "PT8H00M",
                        }
                    ],
                },
                {
                    "duration": "PT9H00M",
                    "segments": [
                        {
                            "id": "ret-1",
                            "departure": {"iataCode": "LHR", "at": "2026-10-17T11:00:00"},
                            "arrival": {"iataCode": "ORD", "at": "2026-10-17T14:00:00"},
                            "carrierCode": "BA",
                            "number": "295",
                            "duration": "PT9H00M",
                        }
                    ],
                },
            ],
            "price": {"currency": "USD", "total": "980.00"},
            "travelerPricings": [{"fareDetailsBySegment": [{"segmentId": "out-1"}]}],
        }
    ],
    "dictionaries": {"carriers": {"BA": "British Airways"}},
}


@pytest.fixture
def configured_amadeus_settings():
    with patch("app.services.flight_providers.amadeus_oauth.settings") as oauth_settings, patch(
        "app.services.flight_providers.amadeus_provider.settings"
    ) as provider_settings:
        for mocked in (oauth_settings, provider_settings):
            mocked.amadeus_client_id = "test-client-id"
            mocked.amadeus_client_secret = "test-client-secret"
            mocked.amadeus_environment = "test"
            mocked.amadeus_base_url = "https://test.api.amadeus.com"
            mocked.amadeus_timeout_seconds = 15
        yield oauth_settings


def test_amadeus_unconfigured_when_credentials_missing():
    with patch("app.services.flight_providers.amadeus_provider.settings") as mocked:
        mocked.amadeus_client_id = ""
        mocked.amadeus_client_secret = ""
        provider = AmadeusFlightProvider()
    assert provider.is_configured() is False
    result = provider.search(RovvyFlightSearchRequest(body=_one_way_body()))
    assert result.status is not None
    assert result.status.status == "unconfigured"


def test_oauth_token_acquisition(configured_amadeus_settings):
    client = AmadeusOAuthClient()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"access_token": "abc123", "expires_in": 1800}
    http_client = MagicMock()
    http_client.post.return_value = mock_response

    token = client._fetch_token(client=http_client)
    assert token.access_token == "abc123"
    http_client.post.assert_called_once()


def test_oauth_token_caching(configured_amadeus_settings):
    client = AmadeusOAuthClient()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"access_token": "cached-token", "expires_in": 1800}
    http_client = MagicMock()
    http_client.post.return_value = mock_response

    first = client.get_access_token(client=http_client)
    second = client.get_access_token(client=http_client)
    assert first == second == "cached-token"
    http_client.post.assert_called_once()


def test_oauth_token_refresh_before_expiration(configured_amadeus_settings):
    client = AmadeusOAuthClient()
    first_response = MagicMock()
    first_response.status_code = 200
    first_response.json.return_value = {"access_token": "token-one", "expires_in": 1}
    second_response = MagicMock()
    second_response.status_code = 200
    second_response.json.return_value = {"access_token": "token-two", "expires_in": 1800}
    http_client = MagicMock()
    http_client.post.side_effect = [first_response, second_response]

    assert client.get_access_token(client=http_client) == "token-one"
    time.sleep(1.1)
    assert client.get_access_token(client=http_client) == "token-two"
    assert http_client.post.call_count == 2


def test_no_credentials_or_tokens_in_logs_or_public_status(configured_amadeus_settings, caplog):
    caplog.set_level(logging.WARNING)
    with patch("app.services.flight_providers.registry.settings") as mocked:
        mocked.flight_enabled_providers = "amadeus"
        records = provider_registry_records(include_disabled=False)
    serialized = " ".join(record.model_dump_json() for record in records).lower()
    assert "test-client-secret" not in serialized
    assert "access_token" not in serialized
    assert "test-client-id" not in serialized
    assert all("test-client-secret" not in (record.getMessage() or "") for record in caplog.records)


def test_one_way_request_mapping(configured_amadeus_settings):
    provider = AmadeusFlightProvider()
    params = provider._build_search_params(RovvyFlightSearchRequest(body=_one_way_body()))
    assert params["originLocationCode"] == "ORD"
    assert params["destinationLocationCode"] == "LAX"
    assert params["adults"] == 1
    assert "returnDate" not in params


def test_round_trip_request_mapping(configured_amadeus_settings):
    provider = AmadeusFlightProvider()
    params = provider._build_search_params(RovvyFlightSearchRequest(body=_round_trip_body()))
    assert params["originLocationCode"] == "ORD"
    assert params["destinationLocationCode"] == "LHR"
    assert "returnDate" in params


def test_multi_city_is_skipped_without_failure(configured_amadeus_settings):
    provider = AmadeusFlightProvider()
    result = provider.search(RovvyFlightSearchRequest(body=_multi_city_body()))
    assert result.offers == []
    assert result.status is not None
    assert result.status.status == "ok"


def test_amadeus_response_normalization():
    journeys = normalize_amadeus_offers(AMADEUS_ONE_WAY_PAYLOAD, live_mode=False)
    assert len(journeys) == 1
    journey = journeys[0]
    assert journey.provider == "amadeus"
    assert journey.price == 250.0
    assert journey.currency == "USD"
    assert journey.slices[0].segments[0].origin == "ORD"
    assert journey.slices[0].segments[0].destination == "LAX"
    assert journey.checked_bag_included is True
    assert journey.refundable is None
    assert journey.changeable is None
    assert journey.expires_at == ""
    assert journey.last_ticketing_date == "2026-12-01"
    assert "23:59:59" not in (journey.expires_at or "")
    assert journey.ticket_type == "unknown"
    assert journey.connection_protection == "unknown"


def test_multi_segment_normalization():
    journeys = normalize_amadeus_offers(AMADEUS_CONNECTING_PAYLOAD, live_mode=False)
    journey = journeys[0]
    assert len(journey.slices[0].segments) == 2
    assert journey.stops == 1
    assert journey.connection_protection == "unknown"


def test_provider_itinerary_duration_from_amadeus_payload():
    journeys = normalize_amadeus_offers(AMADEUS_ONE_WAY_PAYLOAD, live_mode=False)
    assert journeys[0].total_duration_minutes == 265


def test_missing_baggage_remains_unknown():
    payload = {
        "data": [
            {
                "id": "no-bags",
                "itineraries": [
                    {
                        "duration": "PT2H00M",
                        "segments": [
                        {
                            "id": "seg-1",
                            "departure": {"iataCode": "ORD", "at": "2026-10-10T08:00:00"},
                                "arrival": {"iataCode": "LAX", "at": "2026-10-10T10:00:00"},
                                "carrierCode": "AA",
                                "number": "1",
                                "duration": "PT2H00M",
                            }
                        ],
                    }
                ],
                "price": {"currency": "USD", "total": "100.00"},
                "travelerPricings": [{"fareDetailsBySegment": [{"segmentId": "1"}]}],
            }
        ],
        "dictionaries": {},
    }
    journey = normalize_amadeus_offers(payload, live_mode=False)[0]
    assert journey.checked_bag_included is None


def test_missing_protection_remains_unknown():
    journey = normalize_amadeus_offers(AMADEUS_CONNECTING_PAYLOAD, live_mode=False)[0]
    assert journey.protected_connection is None
    assert journey.connection_protection == "unknown"
    assert journey.baggage_transfer == "unknown"


def test_timeout_handling(configured_amadeus_settings):
    provider = AmadeusFlightProvider()
    oauth = MagicMock()
    oauth.is_configured.return_value = True
    oauth.resolve_environment.return_value = "test"
    oauth.resolve_base_url.return_value = "https://test.api.amadeus.com"
    oauth.get_access_token.side_effect = httpx.TimeoutException("timeout")
    provider._oauth = oauth

    result = provider.search(RovvyFlightSearchRequest(body=_one_way_body()))
    assert result.status is not None
    assert result.status.status == "timeout"


def test_rate_limit_handling(configured_amadeus_settings):
    provider = AmadeusFlightProvider()
    oauth = MagicMock()
    oauth.is_configured.return_value = True
    oauth.resolve_environment.return_value = "test"
    oauth.resolve_base_url.return_value = "https://test.api.amadeus.com"
    oauth.get_access_token.return_value = "token"
    provider._oauth = oauth

    search_response = MagicMock()
    search_response.status_code = 429
    search_response.json.return_value = {"errors": [{"detail": "rate limit"}]}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, *args, **kwargs):
            return search_response

    with patch("app.services.flight_providers.amadeus_provider.httpx.Client", return_value=FakeClient()):
        result = provider.search(RovvyFlightSearchRequest(body=_one_way_body()))
    assert result.status is not None
    assert result.status.status == "error"


def test_authentication_failure_handling(configured_amadeus_settings):
    client = AmadeusOAuthClient()
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_response.json.return_value = {"error": "invalid_client"}
    http_client = MagicMock()
    http_client.post.return_value = mock_response

    with pytest.raises(AmadeusOAuthError):
        client._fetch_token(client=http_client)


def test_duffel_success_amadeus_failure():
    duffel = _FakeProvider(
        "duffel",
        ProviderSearchResult(
            provider_id="duffel",
            offers=[_offer("duffel", "duffel-1", 900)],
            status=ProviderStatus(provider_id="duffel", status="ok", environment="test"),
        ),
    )
    amadeus = _FakeProvider(
        "amadeus",
        ProviderSearchResult(
            provider_id="amadeus",
            offers=[],
            status=ProviderStatus(provider_id="amadeus", status="timeout", environment="test"),
        ),
    )
    with patch("app.services.flight_providers.coordinator._enabled_providers", return_value=[duffel, amadeus]):
        response = FlightSearchCoordinator.search(_body())
    assert len(response.journeys) == 1
    assert response.partial_results is True
    assert response.providers_succeeded == 1
    assert response.providers_failed == 1


def test_amadeus_success_duffel_failure():
    duffel = _FakeProvider(
        "duffel",
        ProviderSearchResult(
            provider_id="duffel",
            offers=[],
            status=ProviderStatus(provider_id="duffel", status="error", environment="test"),
        ),
    )
    amadeus = _FakeProvider(
        "amadeus",
        ProviderSearchResult(
            provider_id="amadeus",
            offers=[_offer("amadeus", "amadeus-1", 850)],
            status=ProviderStatus(provider_id="amadeus", status="ok", environment="test"),
        ),
    )
    with patch("app.services.flight_providers.coordinator._enabled_providers", return_value=[duffel, amadeus]):
        response = FlightSearchCoordinator.search(_body())
    assert len(response.journeys) == 1
    assert response.partial_results is True


def test_both_provider_successes():
    duffel = _FakeProvider(
        "duffel",
        ProviderSearchResult(
            provider_id="duffel",
            offers=[_offer("duffel", "duffel-1", 900)],
            status=ProviderStatus(provider_id="duffel", status="ok", environment="test"),
        ),
    )
    amadeus = _FakeProvider(
        "amadeus",
        ProviderSearchResult(
            provider_id="amadeus",
            offers=[_offer("amadeus", "amadeus-1", 850)],
            status=ProviderStatus(provider_id="amadeus", status="ok", environment="test"),
        ),
    )
    with patch("app.services.flight_providers.coordinator._enabled_providers", return_value=[duffel, amadeus]):
        response = FlightSearchCoordinator.search(_body())
    assert response.providers_succeeded == 2
    assert response.partial_results is False
    assert response.offers_before_grouping == 2


def test_same_itinerary_from_two_providers_groups_once():
    duffel = _FakeProvider(
        "duffel",
        ProviderSearchResult(
            provider_id="duffel",
            offers=[_offer("duffel", "duffel-1", 900)],
            status=ProviderStatus(provider_id="duffel", status="ok", environment="test"),
        ),
    )
    amadeus = _FakeProvider(
        "amadeus",
        ProviderSearchResult(
            provider_id="amadeus",
            offers=[_offer("amadeus", "amadeus-1", 850)],
            status=ProviderStatus(provider_id="amadeus", status="ok", environment="test"),
        ),
    )
    with patch("app.services.flight_providers.coordinator._enabled_providers", return_value=[duffel, amadeus]):
        response = FlightSearchCoordinator.search(_body())
    assert len(response.itinerary_groups) == 1
    assert len(response.itinerary_groups[0].seller_options) == 2
    assert response.unique_itinerary_count == 1


def test_different_itineraries_remain_separate():
    first_offer = _offer("duffel", "duffel-1", 900)
    second_offer = _offer("amadeus", "amadeus-1", 850)
    second_segment = second_offer.slices[0].segments[0].model_copy(update={"flight_number": "BB200"})
    second_slice = second_offer.slices[0].model_copy(update={"segments": [second_segment]})
    second_offer = second_offer.model_copy(update={"slices": [second_slice], "itinerary_key": ""})

    duffel = _FakeProvider(
        "duffel",
        ProviderSearchResult(
            provider_id="duffel",
            offers=[first_offer],
            status=ProviderStatus(provider_id="duffel", status="ok", environment="test"),
        ),
    )
    amadeus = _FakeProvider(
        "amadeus",
        ProviderSearchResult(
            provider_id="amadeus",
            offers=[second_offer],
            status=ProviderStatus(provider_id="amadeus", status="ok", environment="test"),
        ),
    )
    with patch("app.services.flight_providers.coordinator._enabled_providers", return_value=[duffel, amadeus]):
        response = FlightSearchCoordinator.search(_body())
    assert len(response.itinerary_groups) == 2


def test_test_environment_is_never_labeled_live(configured_amadeus_settings):
    provider = AmadeusFlightProvider()
    assert provider.health_check().environment == "test"


def test_provider_directory_sandbox_only_when_configured(monkeypatch):
    monkeypatch.setattr(
        "app.services.flight_provider_directory_service.provider_registry_records",
        lambda **_: [
            type(
                "Record",
                (),
                {
                    "configured": True,
                    "status": "ok",
                    "environment": "test",
                    "provider_id": "amadeus",
                    "display_name": "Amadeus",
                },
            )()
        ],
    )
    from app.services.flight_provider_directory_service import FlightProviderDirectoryService

    detail = FlightProviderDirectoryService.get("amadeus")
    assert detail is not None
    assert detail.connectivity_status == "sandbox_connected"
    assert detail.api_access_status == "sandbox_configured"


def test_unconfigured_amadeus_skipped_for_search():
    with patch("app.services.flight_providers.registry.settings") as mocked:
        mocked.flight_enabled_providers = "duffel,amadeus"
        with patch("app.services.flight_providers.amadeus_provider.settings") as amadeus_settings, patch(
            "app.services.flight_providers.duffel_provider.settings"
        ) as duffel_settings:
            amadeus_settings.amadeus_client_id = ""
            amadeus_settings.amadeus_client_secret = ""
            duffel_settings.duffel_api_key = "duffel_test_key"
            providers = enabled_providers()
    assert [provider.provider_id for provider in providers] == ["duffel"]


def test_amadeus_search_network_success(configured_amadeus_settings):
    provider = AmadeusFlightProvider()
    oauth = MagicMock()
    oauth.is_configured.return_value = True
    oauth.resolve_environment.return_value = "test"
    oauth.resolve_base_url.return_value = "https://test.api.amadeus.com"
    oauth.get_access_token.return_value = "token"
    provider._oauth = oauth

    search_response = MagicMock()
    search_response.status_code = 200
    search_response.json.return_value = AMADEUS_ONE_WAY_PAYLOAD

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, *args, **kwargs):
            return search_response

    with patch("app.services.flight_providers.amadeus_provider.httpx.Client", return_value=FakeClient()):
        result = provider.search(RovvyFlightSearchRequest(body=_one_way_body()))
    assert result.status is not None
    assert result.status.status == "ok"
    assert len(result.offers) == 1
    assert result.offers[0].provider_id == "amadeus"
    assert result.offers[0].redirect_url is None
    assert result.offers[0].action_type == "unavailable"
    assert result.offers[0].fare_conditions.refundable is None
    assert result.offers[0].fare_conditions.changeable is None
    assert result.offers[0].fare_conditions.summary == "Not confirmed"
    assert result.offers[0].expires_at is None
    assert result.offers[0].last_ticketing_date == "2026-12-01"


def _baggage_offer(*, segments: list[dict], traveler_details: list[dict]) -> dict:
    return {
        "id": "bag-offer",
        "itineraries": [{"duration": "PT2H00M", "segments": segments}],
        "price": {"currency": "USD", "total": "100.00"},
        "travelerPricings": [{"fareDetailsBySegment": traveler_details}],
    }


def test_checked_bag_quantity_one_is_included():
    assert _parse_checked_bags({"quantity": 1}) is True


def test_checked_bag_quantity_zero_is_not_included():
    assert _parse_checked_bags({"quantity": 0}) is False


def test_checked_bag_weight_positive_is_included():
    assert _parse_checked_bags({"weight": 23}) is True


def test_checked_bag_weight_zero_is_not_included():
    assert _parse_checked_bags({"weight": 0}) is False


def test_checked_bag_missing_is_unknown():
    assert _parse_checked_bags(None) is None
    assert _parse_checked_bags({}) is None


def test_checked_bag_invalid_values_are_unknown():
    assert _parse_checked_bags({"quantity": "x"}) is None
    assert _parse_checked_bags({"weight": -1}) is None


@pytest.mark.parametrize(
    ("values", "expected"),
    [
        ([], None),
        ([None], None),
        ([True], True),
        ([False], False),
        ([True, True], True),
        ([False, False], False),
        ([True, False], None),
        ([True, None], None),
        ([False, None], None),
        ([True, True, None], None),
        ([False, False, None], None),
    ],
)
def test_merge_traveler_segment_status_matrix(values, expected):
    assert _merge_traveler_segment_status(values) is expected


def test_checked_bag_one_traveler_true_one_traveler_missing_is_unknown():
    offer = {
        "id": "bag-offer",
        "itineraries": [
            {
                "duration": "PT2H00M",
                "segments": [{"id": "seg-1", "departure": {"iataCode": "ORD"}, "arrival": {"iataCode": "LAX"}}],
            }
        ],
        "price": {"currency": "USD", "total": "100.00"},
        "travelerPricings": [
            {"fareDetailsBySegment": [{"segmentId": "seg-1", "includedCheckedBags": {"quantity": 1}}]},
            {"fareDetailsBySegment": [{"segmentId": "seg-1"}]},
        ],
    }
    assert _offer_checked_bag_included(offer) is None


def test_checked_bag_one_traveler_false_one_traveler_missing_is_unknown():
    offer = {
        "id": "bag-offer",
        "itineraries": [
            {
                "duration": "PT2H00M",
                "segments": [{"id": "seg-1", "departure": {"iataCode": "ORD"}, "arrival": {"iataCode": "LAX"}}],
            }
        ],
        "price": {"currency": "USD", "total": "100.00"},
        "travelerPricings": [
            {"fareDetailsBySegment": [{"segmentId": "seg-1", "includedCheckedBags": {"quantity": 0}}]},
            {"fareDetailsBySegment": [{"segmentId": "seg-1"}]},
        ],
    }
    assert _offer_checked_bag_included(offer) is None


def test_checked_bag_one_segment_true_one_missing_is_unknown():
    offer = _baggage_offer(
        segments=[
            {"id": "seg-1", "departure": {"iataCode": "ORD"}, "arrival": {"iataCode": "DEN"}},
            {"id": "seg-2", "departure": {"iataCode": "DEN"}, "arrival": {"iataCode": "LAX"}},
        ],
        traveler_details=[
            {"segmentId": "seg-1", "includedCheckedBags": {"quantity": 1}},
            {"segmentId": "seg-2"},
        ],
    )
    assert _offer_checked_bag_included(offer) is None


def test_checked_bag_one_segment_true_one_false_is_false():
    offer = _baggage_offer(
        segments=[
            {"id": "seg-1", "departure": {"iataCode": "ORD"}, "arrival": {"iataCode": "DEN"}},
            {"id": "seg-2", "departure": {"iataCode": "DEN"}, "arrival": {"iataCode": "LAX"}},
        ],
        traveler_details=[
            {"segmentId": "seg-1", "includedCheckedBags": {"quantity": 1}},
            {"segmentId": "seg-2", "includedCheckedBags": {"quantity": 0}},
        ],
    )
    assert _offer_checked_bag_included(offer) is False


def test_checked_bag_all_segments_true_is_true():
    offer = _baggage_offer(
        segments=[
            {"id": "seg-1", "departure": {"iataCode": "ORD"}, "arrival": {"iataCode": "DEN"}},
            {"id": "seg-2", "departure": {"iataCode": "DEN"}, "arrival": {"iataCode": "LAX"}},
        ],
        traveler_details=[
            {"segmentId": "seg-1", "includedCheckedBags": {"quantity": 1}},
            {"segmentId": "seg-2", "includedCheckedBags": {"weight": 23}},
        ],
    )
    assert _offer_checked_bag_included(offer) is True


def test_checked_bag_inconsistent_travelers_is_unknown():
    offer = {
        "id": "bag-offer",
        "itineraries": [
            {
                "duration": "PT2H00M",
                "segments": [{"id": "seg-1", "departure": {"iataCode": "ORD"}, "arrival": {"iataCode": "LAX"}}],
            }
        ],
        "price": {"currency": "USD", "total": "100.00"},
        "travelerPricings": [
            {"fareDetailsBySegment": [{"segmentId": "seg-1", "includedCheckedBags": {"quantity": 1}}]},
            {"fareDetailsBySegment": [{"segmentId": "seg-1", "includedCheckedBags": {"quantity": 0}}]},
        ],
    }
    assert _offer_checked_bag_included(offer) is None


def test_last_ticketing_date_is_not_used_as_expiration():
    journeys = normalize_amadeus_offers(AMADEUS_ONE_WAY_PAYLOAD, live_mode=False)
    offer = journey_to_offer(journeys[0])
    assert offer.expires_at is None
    assert offer.last_ticketing_date == "2026-12-01"
    groups = group_offers_into_itineraries([offer])
    assert len(groups) == 1


def test_quantity_zero_payload_normalizes_as_not_included():
    payload = {
        "data": [
            {
                "id": "zero-bags",
                "itineraries": [
                    {
                        "duration": "PT2H00M",
                        "segments": [
                            {
                                "id": "seg-1",
                                "departure": {"iataCode": "ORD", "at": "2026-10-10T08:00:00"},
                                "arrival": {"iataCode": "LAX", "at": "2026-10-10T10:00:00"},
                                "carrierCode": "AA",
                                "number": "1",
                                "duration": "PT2H00M",
                            }
                        ],
                    }
                ],
                "price": {"currency": "USD", "total": "100.00"},
                "travelerPricings": [
                    {"fareDetailsBySegment": [{"segmentId": "seg-1", "includedCheckedBags": {"quantity": 0}}]}
                ],
            }
        ],
        "dictionaries": {},
    }
    journey = normalize_amadeus_offers(payload, live_mode=False)[0]
    assert journey.checked_bag_included is False


def test_round_trip_normalization():
    journeys = normalize_amadeus_offers(AMADEUS_ROUND_TRIP_PAYLOAD, live_mode=False)
    assert len(journeys) == 1
    assert len(journeys[0].slices) == 2
    assert journeys[0].slices[0].origin == "ORD"
    assert journeys[0].slices[1].origin == "LHR"


def test_amadeus_registry_capabilities():
    with patch("app.services.flight_providers.registry.settings") as mocked:
        mocked.flight_enabled_providers = "amadeus"
        with patch("app.services.flight_providers.amadeus_provider.settings") as amadeus_settings:
            amadeus_settings.amadeus_client_id = "id"
            amadeus_settings.amadeus_client_secret = "secret"
            amadeus_settings.amadeus_environment = "test"
            records = provider_registry_records(include_disabled=True)
    amadeus = next(record for record in records if record.provider_id == "amadeus")
    assert amadeus.capabilities.search is True
    assert amadeus.capabilities.refresh_offer is False
    assert amadeus.capabilities.multi_city is False
    assert amadeus.capabilities.fare_conditions is False
    assert amadeus.capabilities.search_only is True


_FRESH_IMPORT_STATEMENTS = [
    "from app.services.flight_providers.amadeus_normalizer import normalize_amadeus_offers",
    "from app.services.flight_providers.amadeus_provider import AmadeusFlightProvider",
    "from app.services.flight_providers.coordinator import FlightSearchCoordinator",
    "from app.services.flight_providers.registry import enabled_providers",
]


@pytest.mark.parametrize("statement", _FRESH_IMPORT_STATEMENTS)
def test_flight_provider_modules_import_in_fresh_process(statement: str):
    completed = subprocess.run(
        [sys.executable, "-c", statement],
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr or completed.stdout
