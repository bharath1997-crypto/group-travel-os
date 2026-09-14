"""Tests for provider-neutral flight metasearch foundation."""

from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import patch

import pytest

from app.schemas.flight_journey import (
    FlightJourney,
    FlightJourneySegment,
    FlightJourneySlice,
    FlightSearchPassengerRequest,
    FlightSearchRequest,
    FlightSearchSliceRequest,
)
from app.schemas.flight_metasearch import RovvyFlightOffer
from app.services.flight_providers.coordinator import FlightSearchCoordinator
from app.services.flight_providers.duffel_provider import DuffelFlightProvider
from app.services.flight_providers.itinerary_fingerprint import (
    itinerary_key_from_journey,
    itinerary_key_from_slices,
)
from app.services.flight_providers.normalizer import (
    group_offers_into_itineraries,
    journey_to_offer,
    offer_to_seller_option,
)
from app.services.flight_providers.types import ProviderSearchResult, ProviderStatus, RovvyFlightSearchRequest
from app.services.flight_route_recovery_service import FlightRouteRecoveryService


def _segment(
    *,
    op: str = "AA",
    flight: str = "AA100",
    origin: str = "ORD",
    destination: str = "JFK",
    dep: str = "2026-10-10T08:00:00Z",
    arr: str = "2026-10-10T11:00:00Z",
) -> FlightJourneySegment:
    return FlightJourneySegment(
        origin=origin,
        destination=destination,
        departure_at=dep,
        arrival_at=arr,
        duration_minutes=180,
        airline_code=op,
        airline_name="American",
        operating_airline_code=op,
        operating_airline_name="American",
        flight_number=flight,
    )


def _journey(**kwargs) -> FlightJourney:
    seg = _segment()
    sl = FlightJourneySlice(origin="ORD", destination="JFK", duration_minutes=180, stops=0, segments=[seg])
    defaults = dict(
        id="off_1",
        provider="duffel",
        provider_offer_id="off_1",
        price=500.0,
        currency="USD",
        checked_at="2026-10-01T12:00:00Z",
        expires_at="2026-10-01T18:00:00Z",
        live_mode=False,
        slices=[sl],
        total_duration_minutes=180,
        maximum_connections=0,
        protected_connection=None,
        bookable_in_rovvy=False,
        airlines=["AA"],
        carry_on_included=None,
        checked_bag_included=None,
        refundable=None,
        changeable=None,
        departure_at=seg.departure_at,
        arrival_at=seg.arrival_at,
        origin="ORD",
        destination="JFK",
        duration_minutes=180,
        stops=0,
        deep_link="",
    )
    defaults.update(kwargs)
    return FlightJourney(**defaults)


def _search_body() -> FlightSearchRequest:
    depart = date.today() + timedelta(days=30)
    return FlightSearchRequest(
        trip_type="one_way",
        slices=[
            FlightSearchSliceRequest(origin="ORD", destination="JFK", departure_date=depart),
        ],
        passengers=[FlightSearchPassengerRequest(type="adult")],
        cabin="economy",
        currency="USD",
    )


def test_duffel_provider_implements_contract():
    provider = DuffelFlightProvider()
    assert provider.provider_id == "duffel"
    assert callable(provider.search)
    assert callable(provider.refresh_offer)
    assert callable(provider.get_redirect)
    assert callable(provider.health_check)


def test_duffel_provider_unconfigured_returns_empty():
    provider = DuffelFlightProvider()
    with patch("app.services.flight_providers.duffel_provider.settings") as mock_settings:
        mock_settings.duffel_api_key = ""
        result = provider.search(RovvyFlightSearchRequest(body=_search_body()))
    assert result.offers == []
    assert result.status is not None
    assert result.status.status == "unconfigured"


def test_coordinator_one_successful_provider():
    offer = journey_to_offer(_journey())
    fake_result = ProviderSearchResult(
        provider_id="duffel",
        offers=[offer],
        status=ProviderStatus(provider_id="duffel", status="ok", environment="test"),
    )
    with patch.object(DuffelFlightProvider, "search", return_value=fake_result):
        response = FlightSearchCoordinator.search(_search_body())
    assert response.providers_requested == 1
    assert response.providers_succeeded == 1
    assert response.providers_failed == 0
    assert len(response.itinerary_groups) == 1
    assert len(response.journeys) == 1


def test_route_recovery_builds_bounded_honest_alternatives():
    body = FlightSearchRequest(
        trip_type="one_way",
        slices=[FlightSearchSliceRequest(
            origin="HLC",
            destination="KHG",
            departure_date=date(2026, 9, 11),
        )],
        passengers=[FlightSearchPassengerRequest(type="adult")],
    )

    options = FlightRouteRecoveryService.build(body)

    assert 1 <= len(options) <= 8
    assert all((row.origin, row.destination) != ("HLC", "KHG") for row in options)
    assert any(row.tier == "nearby_origin" and row.origin_distance_km for row in options)
    assert any(row.tier == "nearby_destination" and row.destination_distance_km for row in options)
    assert all(row.separate_searches_required for row in options if "gateway" in row.tier)


def test_route_recovery_does_not_invent_round_trip_combinations():
    body = FlightSearchRequest(
        trip_type="round_trip",
        slices=[
            FlightSearchSliceRequest(origin="HLC", destination="KHG", departure_date=date(2026, 9, 11)),
            FlightSearchSliceRequest(origin="KHG", destination="HLC", departure_date=date(2026, 9, 20)),
        ],
        passengers=[FlightSearchPassengerRequest(type="adult")],
    )

    assert FlightRouteRecoveryService.build(body) == []


def test_coordinator_provider_timeout():
    def _timeout(_request):
        return ProviderSearchResult(
            provider_id="duffel",
            offers=[],
            status=ProviderStatus(provider_id="duffel", status="timeout"),
        )

    with patch.object(DuffelFlightProvider, "search", side_effect=_timeout):
        response = FlightSearchCoordinator.search(_search_body())
    assert response.providers_failed == 1
    assert response.journeys == []


def test_coordinator_partial_provider_failure():
    ok = journey_to_offer(_journey(id="off_ok", provider_offer_id="off_ok"))
    fake_ok = ProviderSearchResult(
        provider_id="duffel",
        offers=[ok],
        status=ProviderStatus(provider_id="duffel", status="ok", environment="test"),
    )

    class _FailingProvider:
        provider_id = "future"

        def search(self, request):
            return ProviderSearchResult(
                provider_id="future",
                offers=[],
                status=ProviderStatus(provider_id="future", status="error"),
            )

        def refresh_offer(self, provider_offer_id: str):
            raise NotImplementedError

        def get_redirect(self, provider_offer_id: str):
            return None

        def health_check(self):
            return ProviderStatus(provider_id="future", status="error")

    with patch("app.services.flight_providers.coordinator._enabled_providers") as mock_enabled:
        mock_enabled.return_value = [DuffelFlightProvider(), _FailingProvider()]
        with patch.object(DuffelFlightProvider, "search", return_value=fake_ok):
            response = FlightSearchCoordinator.search(_search_body())
    assert response.providers_requested == 2
    assert response.providers_succeeded == 1
    assert response.providers_failed == 1
    assert response.partial_results is True
    assert len(response.journeys) == 1


def test_offer_normalization_unknown_baggage():
    offer = journey_to_offer(_journey(carry_on_included=None, checked_bag_included=None))
    assert offer.baggage.carry_on_included is None
    assert offer.baggage.checked_bag_included is None
    assert offer.baggage.summary == "Not confirmed"


def test_deterministic_itinerary_key():
    j1 = _journey()
    j2 = _journey(id="off_2", provider_offer_id="off_2", price=600)
    assert itinerary_key_from_journey(j1) == itinerary_key_from_journey(j2)


def test_different_segments_do_not_group():
    seg_a = _segment(flight="AA100")
    seg_b = _segment(flight="AA200")
    key_a = itinerary_key_from_slices([FlightJourneySlice(origin="ORD", destination="JFK", duration_minutes=180, stops=0, segments=[seg_a])])
    key_b = itinerary_key_from_slices([FlightJourneySlice(origin="ORD", destination="JFK", duration_minutes=180, stops=0, segments=[seg_b])])
    assert key_a != key_b


def test_same_itinerary_two_providers_group_together():
    offer_a = journey_to_offer(_journey(id="off_a", provider_offer_id="off_a", price=500))
    offer_b = journey_to_offer(_journey(id="off_b", provider_offer_id="off_b", price=520))
    offer_b = offer_b.model_copy(update={"provider_id": "future", "seller_id": "future", "seller_name": "Future"})
    groups = group_offers_into_itineraries([offer_a, offer_b])
    assert len(groups) == 1
    assert len(groups[0].seller_options) == 2


def test_expired_offers_removed():
    expired = journey_to_offer(
        _journey(expires_at="2020-01-01T00:00:00Z"),
    )
    valid = journey_to_offer(_journey(id="off_valid", provider_offer_id="off_valid"))
    groups = group_offers_into_itineraries([expired, valid])
    assert len(groups) == 1
    assert groups[0].seller_options[0].provider_offer_id == "off_valid"


def test_duffel_missing_redirect_uses_unavailable():
    offer = journey_to_offer(_journey(deep_link=""))
    option = offer_to_seller_option(offer)
    assert option.redirect_url is None
    assert option.action_type == "unavailable"


def test_non_duffel_missing_redirect_unavailable():
    offer = journey_to_offer(_journey(provider="amadeus", deep_link=""))
    option = offer_to_seller_option(offer)
    assert option.redirect_url is None
    assert option.action_type == "unavailable"


def test_duplicate_provider_offer_is_removed_from_group():
    offer = journey_to_offer(_journey())
    duplicate = offer.model_copy()
    groups = group_offers_into_itineraries([offer, duplicate])
    assert len(groups) == 1
    assert len(groups[0].seller_options) == 1


def test_external_redirect_only_when_valid_url():
    offer = journey_to_offer(_journey(deep_link="https://partner.example/book"))
    option = offer_to_seller_option(offer)
    assert option.action_type == "external_redirect"
    assert option.redirect_url == "https://partner.example/book"


def test_duffel_get_redirect_returns_none():
    provider = DuffelFlightProvider()
    assert provider.get_redirect("off_test") is None


def test_test_live_metadata():
    offer = journey_to_offer(_journey(live_mode=False))
    assert offer.environment == "test"
    live_offer = journey_to_offer(_journey(id="off_live", provider_offer_id="off_live", live_mode=True))
    assert live_offer.environment == "live"


def test_coordinator_slow_provider_times_out_without_blocking():
    import time

    slow_sleep_seconds = 2.0
    coordinator_timeout_seconds = 0.2

    class _FastProvider:
        provider_id = "fast"

        def search(self, request):
            offer = journey_to_offer(_journey(id="off_fast", provider_offer_id="off_fast"))
            return ProviderSearchResult(
                provider_id="fast",
                offers=[offer],
                status=ProviderStatus(provider_id="fast", status="ok", environment="test"),
            )

        def refresh_offer(self, provider_offer_id: str):
            raise NotImplementedError

        def get_redirect(self, provider_offer_id: str):
            return None

        def health_check(self):
            return ProviderStatus(provider_id="fast", status="ok")

    class _SlowProvider:
        provider_id = "slow"

        def search(self, request):
            time.sleep(slow_sleep_seconds)
            offer = journey_to_offer(_journey(id="off_slow", provider_offer_id="off_slow"))
            return ProviderSearchResult(
                provider_id="slow",
                offers=[offer],
                status=ProviderStatus(provider_id="slow", status="ok", environment="test"),
            )

        def refresh_offer(self, provider_offer_id: str):
            raise NotImplementedError

        def get_redirect(self, provider_offer_id: str):
            return None

        def health_check(self):
            return ProviderStatus(provider_id="slow", status="ok")

    with patch("app.services.flight_providers.coordinator._enabled_providers") as mock_enabled:
        mock_enabled.return_value = [_FastProvider(), _SlowProvider()]
        started = time.perf_counter()
        response = FlightSearchCoordinator.search(
            _search_body(),
            timeout_seconds=coordinator_timeout_seconds,
        )
        elapsed = time.perf_counter() - started

    assert elapsed < slow_sleep_seconds - 0.5
    assert elapsed < coordinator_timeout_seconds + 0.75

    status_by_provider = {status.provider_id: status for status in response.provider_statuses}
    assert len(status_by_provider) == 2
    assert status_by_provider["slow"].status == "timeout"
    assert status_by_provider["fast"].status == "ok"

    assert response.providers_requested == 2
    assert response.providers_succeeded == 1
    assert response.providers_failed == 1
    assert response.partial_results is True
    assert len(response.journeys) == 1
