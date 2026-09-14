"""Phase 3A flight-provider registry and health tests."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from unittest.mock import patch

from app.schemas.flight_journey import (
    FlightJourney,
    FlightJourneySegment,
    FlightJourneySlice,
    FlightSearchPassengerRequest,
    FlightSearchRequest,
    FlightSearchSliceRequest,
)
from app.schemas.flight_provider_registry import FlightProviderCapabilities
from app.services.flight_providers.coordinator import FlightSearchCoordinator
from app.services.flight_providers.normalizer import journey_to_offer
from app.services.flight_providers.registry import (
    FlightProviderRegistration,
    _REGISTRY,
    _RUNTIME,
    enabled_providers,
    provider_registry_records,
    record_provider_search,
)
from app.services.flight_providers.types import ProviderSearchResult, ProviderStatus


def _body() -> FlightSearchRequest:
    return FlightSearchRequest(
        trip_type="one_way",
        slices=[
            FlightSearchSliceRequest(
                origin="ORD",
                destination="HBA",
                departure_date=date.today() + timedelta(days=30),
            )
        ],
        passengers=[FlightSearchPassengerRequest(type="adult")],
    )


def _offer(provider_id: str, offer_id: str, price: float):
    segment = FlightJourneySegment(
        origin="ORD",
        destination="HBA",
        departure_at="2026-10-10T08:00:00Z",
        arrival_at="2026-10-11T08:00:00Z",
        duration_minutes=1440,
        airline_code="AA",
        operating_airline_code="AA",
        flight_number="AA100",
    )
    flight_slice = FlightJourneySlice(
        origin="ORD",
        destination="HBA",
        duration_minutes=1440,
        stops=0,
        segments=[segment],
    )
    journey = FlightJourney(
        id=offer_id,
        provider=provider_id,
        provider_offer_id=offer_id,
        price=price,
        currency="USD",
        checked_at="2026-10-01T12:00:00Z",
        expires_at="2099-10-01T13:00:00Z",
        live_mode=False,
        slices=[flight_slice],
        total_duration_minutes=1440,
        bookable_in_rovvy=False,
        departure_at=segment.departure_at,
        arrival_at=segment.arrival_at,
        origin="ORD",
        destination="HBA",
        duration_minutes=1440,
        stops=0,
    )
    return journey_to_offer(journey).model_copy(
        update={
            "provider_id": provider_id,
            "seller_id": provider_id,
            "seller_name": provider_id.title(),
        }
    )


@dataclass
class _FakeProvider:
    provider_id: str
    result: ProviderSearchResult

    def search(self, request):
        del request
        return self.result

    def refresh_offer(self, provider_offer_id: str):
        raise NotImplementedError(provider_offer_id)

    def get_redirect(self, provider_offer_id: str):
        del provider_offer_id
        return None

    def health_check(self):
        return self.result.status or ProviderStatus(provider_id=self.provider_id, status="error")


def test_registry_enables_only_configured_ids():
    with patch("app.services.flight_providers.registry.settings") as mocked:
        mocked.flight_enabled_providers = "duffel"
        providers = enabled_providers()
    assert [provider.provider_id for provider in providers] == ["duffel"]


def test_public_registry_excludes_disabled_adapters():
    registration = FlightProviderRegistration(
        provider_id="future",
        display_name="Future Provider",
        category="distribution",
        factory=lambda: _FakeProvider(
            "future",
            ProviderSearchResult(
                provider_id="future",
                status=ProviderStatus(provider_id="future", status="unconfigured"),
            ),
        ),
        capabilities=FlightProviderCapabilities(search=True),
    )
    with patch.dict(_REGISTRY, {"future": registration}, clear=False):
        with patch("app.services.flight_providers.registry.settings") as mocked:
            mocked.flight_enabled_providers = "duffel"
            public = provider_registry_records(include_disabled=False)
            admin = provider_registry_records(include_disabled=True)
    assert "future" not in {record.provider_id for record in public}
    future = next(record for record in admin if record.provider_id == "future")
    assert future.enabled is False
    assert future.status == "disabled"


def test_registry_never_exposes_credentials():
    with patch("app.services.flight_providers.registry.settings") as mocked:
        mocked.flight_enabled_providers = "duffel"
        records = provider_registry_records(include_disabled=False)
    serialized = " ".join(record.model_dump_json() for record in records).lower()
    assert "api_key" not in serialized
    assert "duffel_test_" not in serialized


def test_runtime_health_tracks_failure_and_recovery():
    with patch.dict(_RUNTIME, {}, clear=True):
        record_provider_search(ProviderStatus(provider_id="duffel", status="timeout", elapsed_ms=500))
        record_provider_search(ProviderStatus(provider_id="duffel", status="error", elapsed_ms=200))
        assert _RUNTIME["duffel"].consecutive_failures == 2
        record_provider_search(ProviderStatus(provider_id="duffel", status="ok", elapsed_ms=100))
        assert _RUNTIME["duffel"].consecutive_failures == 0
        assert _RUNTIME["duffel"].last_latency_ms == 100


def test_coordinator_groups_same_itinerary_from_two_providers():
    first = _FakeProvider(
        "first",
        ProviderSearchResult(
            provider_id="first",
            offers=[_offer("first", "first-1", 900)],
            status=ProviderStatus(provider_id="first", status="ok", environment="test"),
        ),
    )
    second = _FakeProvider(
        "second",
        ProviderSearchResult(
            provider_id="second",
            offers=[_offer("second", "second-1", 850)],
            status=ProviderStatus(provider_id="second", status="ok", environment="test"),
        ),
    )
    with patch("app.services.flight_providers.coordinator._enabled_providers", return_value=[first, second]):
        response = FlightSearchCoordinator.search(_body())
    assert response.provider == "multiple"
    assert response.providers_requested == 2
    assert response.providers_succeeded == 2
    assert len(response.itinerary_groups) == 1
    assert len(response.itinerary_groups[0].seller_options) == 2
    assert response.itinerary_groups[0].lowest_price == 850


def test_coordinator_mixed_environments_are_not_mislabeled():
    test_provider = _FakeProvider(
        "test_source",
        ProviderSearchResult(
            provider_id="test_source",
            offers=[_offer("test_source", "test-1", 900)],
            status=ProviderStatus(provider_id="test_source", status="ok", environment="test"),
        ),
    )
    live_provider = _FakeProvider(
        "live_source",
        ProviderSearchResult(
            provider_id="live_source",
            offers=[_offer("live_source", "live-1", 850)],
            status=ProviderStatus(provider_id="live_source", status="ok", environment="live"),
        ),
    )
    with patch(
        "app.services.flight_providers.coordinator._enabled_providers",
        return_value=[test_provider, live_provider],
    ):
        response = FlightSearchCoordinator.search(_body())
    assert response.environment is None
    assert response.live_mode is None
    assert {status.environment for status in response.provider_statuses} == {"test", "live"}

