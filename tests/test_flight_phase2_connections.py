"""Phase 2 connecting-itinerary, disclosure, and adaptive search tests."""

from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import patch

import pytest

from app.schemas.flight_journey import (
    FlightConnectionDetail,
    FlightJourney,
    FlightJourneySegment,
    FlightJourneySlice,
    FlightSearchPassengerRequest,
    FlightSearchRequest,
    FlightSearchSliceRequest,
)
from app.services.flight_adaptive_search import resolve_adaptive_limits
from app.services.flight_disclosure_service import (
    apply_disclosures_to_journey,
    build_offer_provenance,
    clear_provenance_store,
    get_offer_provenance,
    rollup_journey_disclosures,
    store_offer_provenance,
)
from app.services.flight_journey_parser import parse_duffel_journey
from app.services.flight_journey_service import FlightJourneyService, _rank_journeys
from app.services.flight_service import _normalize_fly_term


def _segment(
    *,
    origin: str = "ORD",
    destination: str = "LAX",
    dep: str = "2026-10-10T08:00:00Z",
    arr: str = "2026-10-10T11:00:00Z",
    flight: str = "UA123",
) -> FlightJourneySegment:
    return FlightJourneySegment(
        origin=origin,
        origin_name=origin,
        destination=destination,
        destination_name=destination,
        departure_at=dep,
        arrival_at=arr,
        duration_minutes=180,
        airline_code="UA",
        airline_name="United",
        operating_airline_code="UA",
        operating_airline_name="United",
        flight_number=flight,
    )


def _three_connection_offer() -> dict:
    return {
        "id": "off_hba",
        "total_amount": "2400.00",
        "total_currency": "USD",
        "expires_at": "2099-01-01T00:00:00Z",
        "live_mode": False,
        "slices": [
            {
                "duration": "PT31H45M",
                "origin": {"iata_code": "ORD"},
                "destination": {"iata_code": "HBA"},
                "segments": [
                    {
                        "departing_at": "2026-10-10T08:00:00-05:00",
                        "arriving_at": "2026-10-10T11:10:00-07:00",
                        "duration": "PT4H10M",
                        "marketing_carrier": {"iata_code": "UA", "name": "United"},
                        "operating_carrier": {"iata_code": "UA", "name": "United"},
                        "marketing_carrier_flight_number": "123",
                        "origin": {"iata_code": "ORD", "name": "Chicago", "terminal": "1"},
                        "destination": {"iata_code": "LAX", "name": "Los Angeles", "terminal": "7"},
                    },
                    {
                        "departing_at": "2026-10-10T13:20:00-07:00",
                        "arriving_at": "2026-10-12T06:00:00+10:00",
                        "duration": "PT15H40M",
                        "marketing_carrier": {"iata_code": "UA", "name": "United"},
                        "operating_carrier": {"iata_code": "UA", "name": "United"},
                        "marketing_carrier_flight_number": "839",
                        "origin": {"iata_code": "LAX", "name": "Los Angeles", "terminal": "7"},
                        "destination": {"iata_code": "SYD", "name": "Sydney", "terminal": "1"},
                    },
                    {
                        "departing_at": "2026-10-12T11:35:00+10:00",
                        "arriving_at": "2026-10-12T13:10:00+10:00",
                        "duration": "PT1H35M",
                        "marketing_carrier": {"iata_code": "VA", "name": "Virgin Australia"},
                        "operating_carrier": {"iata_code": "VA", "name": "Virgin Australia"},
                        "marketing_carrier_flight_number": "1528",
                        "origin": {"iata_code": "SYD", "name": "Sydney", "terminal": "2"},
                        "destination": {"iata_code": "HBA", "name": "Hobart"},
                    },
                ],
            }
        ],
    }


def _search_body(**kwargs) -> FlightSearchRequest:
    depart = date.today() + timedelta(days=30)
    defaults = dict(
        trip_type="one_way",
        slices=[FlightSearchSliceRequest(origin="ORD", destination="HBA", departure_date=depart)],
        passengers=[FlightSearchPassengerRequest(type="adult")],
        cabin="economy",
        currency="USD",
    )
    defaults.update(kwargs)
    return FlightSearchRequest(**defaults)


def test_parse_three_connection_itinerary():
    journey = parse_duffel_journey(
        _three_connection_offer(),
        currency_preference="USD",
        checked_at="2026-10-01T12:00:00Z",
        maximum_connections=3,
    )
    assert journey is not None
    assert journey.destination == "HBA"
    assert journey.stops == 2
    assert len(journey.slices[0].segments) == 3
    assert len(journey.slices[0].connections) == 2
    assert journey.slices[0].connections[0].layover_minutes == 130


def test_parse_two_connection_itinerary():
    offer = _three_connection_offer()
    offer["slices"][0]["segments"] = offer["slices"][0]["segments"][:2]
    offer["slices"][0]["destination"] = {"iata_code": "SYD"}
    journey = parse_duffel_journey(offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    assert journey.stops == 1
    assert len(journey.slices[0].connections) == 1


def test_terminal_and_airport_change_detection():
    seg_a = _segment(origin="LAX", destination="LAX", dep="2026-10-10T08:00:00Z", arr="2026-10-10T10:00:00Z")
    seg_a = seg_a.model_copy(update={"destination": "LAX", "destination_terminal": "1"})
    seg_b = _segment(origin="BUR", destination="SYD", dep="2026-10-10T12:00:00Z", arr="2026-10-11T08:00:00Z")
    seg_b = seg_b.model_copy(update={"origin": "BUR", "origin_terminal": "2"})
    sl = FlightJourneySlice(
        origin="LAX",
        destination="SYD",
        duration_minutes=600,
        stops=1,
        segments=[seg_a, seg_b],
        connections=[
            FlightConnectionDetail(
                airport="LAX",
                airport_name="Los Angeles",
                layover_minutes=120,
                airport_change=True,
                terminal_change=True,
            )
        ],
    )
    journey = FlightJourney(
        id="off_1",
        provider="duffel",
        provider_offer_id="off_1",
        price=1000,
        currency="USD",
        checked_at="2026-10-01T12:00:00Z",
        expires_at="2099-01-01T00:00:00Z",
        live_mode=False,
        slices=[sl],
        total_duration_minutes=600,
        maximum_connections=1,
        bookable_in_rovvy=False,
        airlines=["UA"],
        departure_at=seg_a.departure_at,
        arrival_at=seg_b.arrival_at,
        origin="LAX",
        destination="SYD",
        duration_minutes=600,
        stops=1,
    )
    updated = apply_disclosures_to_journey(journey, {}, checked_at="2026-10-01T12:00:00Z")
    conn = updated.slices[0].connections[0]
    assert conn.airport_change_status == "yes"
    assert conn.terminal_change_status == "yes"


def test_unknown_protection_and_baggage_remain_unknown():
    journey = parse_duffel_journey(
        _three_connection_offer(),
        currency_preference="USD",
        checked_at="2026-10-01T12:00:00Z",
    )
    assert journey is not None
    assert journey.connection_protection == "unknown"
    assert journey.baggage_transfer == "unknown"
    assert journey.ticket_type == "unknown"


def test_self_transfer_from_duffel_warning():
    offer = _three_connection_offer()
    offer["warnings"] = [{"code": "self_transfer", "message": "Self transfer required in Sydney"}]
    journey = parse_duffel_journey(offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    assert journey.baggage_transfer == "self_transfer"
    assert journey.self_transfer is True


def test_adaptive_limits_nonstop_only():
    body = _search_body(maximum_connections=0, strict_connection_limit=True)
    assert resolve_adaptive_limits(body) == [0]


def test_adaptive_limits_strict_max():
    body = _search_body(maximum_connections=2, strict_connection_limit=True)
    assert resolve_adaptive_limits(body) == [2]


def test_adaptive_limits_default_expansion():
    body = _search_body(maximum_connections=1, strict_connection_limit=False)
    assert resolve_adaptive_limits(body) == [1, 2]


def test_adaptive_limits_cap_duffel_at_two_connections():
    body = _search_body(maximum_connections=3, strict_connection_limit=False)
    assert resolve_adaptive_limits(body) == [2]


def test_adaptive_limits_cap_strict_duffel_at_two_connections():
    body = _search_body(maximum_connections=3, strict_connection_limit=True)
    assert resolve_adaptive_limits(body) == [2]


def test_destination_codes_preserved():
    assert _normalize_fly_term("HBA") == "HBA"
    assert _normalize_fly_term("VGA") == "VGA"
    assert _normalize_fly_term("SAN") == "SAN"
    assert _normalize_fly_term("VIJAYAWADA") == "VGA"


def test_long_itinerary_not_discarded_in_ranking():
    long_journey = parse_duffel_journey(
        _three_connection_offer(),
        currency_preference="USD",
        checked_at="2026-10-01T12:00:00Z",
    )
    short = long_journey.model_copy(
        update={
            "id": "off_short",
            "provider_offer_id": "off_short",
            "price": long_journey.price + 200,
            "total_duration_minutes": 600,
            "duration_minutes": 600,
            "stops": 0,
            "slices": [
                FlightJourneySlice(
                    origin="ORD",
                    destination="HBA",
                    duration_minutes=600,
                    stops=0,
                    segments=[_segment(origin="ORD", destination="HBA", flight="AA1")],
                )
            ],
        }
    )
    ranked = _rank_journeys([long_journey, short])
    assert any(j.id == long_journey.id for j in ranked)


def test_ranking_reason_does_not_claim_protection():
    j1 = parse_duffel_journey(_three_connection_offer(), currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    j2 = j1.model_copy(update={"id": "off_2", "provider_offer_id": "off_2", "price": j1.price + 100})
    ranked = _rank_journeys([j1, j2])
    for row in ranked:
        assert "protected" not in (row.recommendation_reason or "").lower()


def test_admin_provenance_stored_not_in_public_search():
    clear_provenance_store()
    journey = parse_duffel_journey(_three_connection_offer(), currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    provenance = build_offer_provenance(
        journey,
        _three_connection_offer(),
        search_attempt_number=1,
        requested_maximum_connections=3,
        search_timestamp="2026-10-01T12:00:00Z",
    )
    store_offer_provenance(provenance)
    stored = get_offer_provenance(journey.provider_offer_id)
    assert stored is not None
    assert stored.provider_offer_id == journey.provider_offer_id


def test_adaptive_search_retries_and_deduplicates():
    from app.services.flight_adaptive_search import execute_adaptive_duffel_search

    offer_one = _three_connection_offer()
    offer_one["id"] = "off_a"
    offer_two = _three_connection_offer()
    offer_two["id"] = "off_b"
    offer_two["total_amount"] = "2500.00"
    offer_two["slices"][0]["segments"][0]["marketing_carrier_flight_number"] = "999"

    calls: list[int] = []

    def fake_create_offer_request(**kwargs):
        calls.append(kwargs["max_connections"])
        offers = [offer_one] if kwargs["max_connections"] == 1 else [offer_one, offer_two]
        return {"offers": offers}

    body = _search_body(maximum_connections=1, strict_connection_limit=False)
    journeys, metadata = execute_adaptive_duffel_search(
        body,
        create_offer_request=fake_create_offer_request,
        build_duffel_slices=lambda b: [{"origin": "ORD", "destination": "HBA", "departure_date": b.slices[0].departure_date.isoformat()}],
        build_duffel_passengers=lambda p: [{"type": "adult"}],
        cabin_to_duffel={"economy": "economy"},
        apply_post_time_filters=lambda j, b: True,
        rank_journeys=_rank_journeys,
        checked_at="2026-10-01T12:00:00Z",
    )
    assert calls == [1, 2]
    assert len(journeys) == 2
    assert metadata.merged_group_count >= 1
    assert metadata.requested_destinations == ["HBA"]


def test_adaptive_partial_timeout_keeps_successful_results():
    from app.services.flight_adaptive_search import execute_adaptive_duffel_search
    import httpx

    offer = _three_connection_offer()

    def fake_create_offer_request(**kwargs):
        if kwargs["max_connections"] == 2:
            raise httpx.TimeoutException("timeout")
        return {"offers": [offer]}

    body = _search_body(maximum_connections=1, strict_connection_limit=False)
    journeys, metadata = execute_adaptive_duffel_search(
        body,
        create_offer_request=fake_create_offer_request,
        build_duffel_slices=lambda b: [{"origin": "ORD", "destination": "HBA", "departure_date": b.slices[0].departure_date.isoformat()}],
        build_duffel_passengers=lambda p: [{"type": "adult"}],
        cabin_to_duffel={"economy": "economy"},
        apply_post_time_filters=lambda j, b: True,
        rank_journeys=_rank_journeys,
        checked_at="2026-10-01T12:00:00Z",
    )
    assert len(journeys) == 1
    assert any(a.status == "timeout" for a in metadata.adaptive_attempts)


def test_build_duffel_slices_preserves_regional_destination():
    from app.services.flight_journey_service import _build_duffel_slices

    body = _search_body()
    body.slices[0].destination = "VGA"
    slices = _build_duffel_slices(body)
    assert slices[0]["destination"] == "VGA"


def test_missing_slice_duration_derived_from_timestamps():
    offer = _three_connection_offer()
    offer["slices"][0]["duration"] = "PT0S"
    journey = parse_duffel_journey(offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    # ORD 10-10 08:00 -05:00 (13:00 UTC) to HBA 10-12 13:10 +10:00 (03:10 UTC Oct 12) -> 38h 10m = 2290 mins
    assert journey.total_duration_minutes > 0
    assert journey.slices[0].duration_minutes > 0


def test_missing_slice_duration_derived_from_segments_and_layovers():
    from app.services.flight_journey_parser import _calculate_slice_duration
    seg1 = _segment(dep="invalid", arr="invalid").model_copy(update={"duration_minutes": 100})
    seg2 = _segment(dep="invalid", arr="invalid").model_copy(update={"duration_minutes": 200})
    conn = FlightConnectionDetail(airport="LAX", layover_minutes=90)
    dur = _calculate_slice_duration(None, [seg1, seg2], [conn])
    assert dur == 390  # 100 + 200 + 90


def test_multi_segment_duration_never_becomes_zero():
    offer = _three_connection_offer()
    offer["slices"][0]["duration"] = ""
    journey = parse_duffel_journey(offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    assert journey.total_duration_minutes > 0
    assert journey.duration_minutes > 0


def test_round_trip_slices_do_not_include_stay_time():
    offer = _three_connection_offer()
    return_slice = {
        "duration": "PT10H00M",
        "origin": {"iata_code": "HBA"},
        "destination": {"iata_code": "ORD"},
        "segments": [
            {
                "departing_at": "2026-10-20T08:00:00+10:00",
                "arriving_at": "2026-10-20T18:00:00-05:00",
                "duration": "PT10H00M",
                "marketing_carrier": {"iata_code": "UA", "name": "United"},
                "origin": {"iata_code": "HBA"},
                "destination": {"iata_code": "ORD"},
            }
        ],
    }
    offer["slices"].append(return_slice)
    journey = parse_duffel_journey(offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    # Outbound PT31H45M (1905m) + Return PT10H00M (600m) = 2505m, excluding 8-day stay
    assert journey.total_duration_minutes == 1905 + 600


def test_protection_normalization_unprotected_forms():
    for raw in ["unprotected", "not_protected", "not protected", "un-protected"]:
        offer = _three_connection_offer()
        offer["connection_protection"] = raw
        journey = parse_duffel_journey(offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
        assert journey is not None
        assert journey.connection_protection == "unprotected", f"Failed for raw protection string: {raw}"
        assert journey.protected_connection is False


def test_protection_normalization_exact_protected():
    offer = _three_connection_offer()
    offer["connection_protection"] = "protected"
    journey = parse_duffel_journey(offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    assert journey.connection_protection == "protected"
    assert journey.protected_connection is True


def test_protection_normalization_missing_remains_unknown():
    offer = _three_connection_offer()
    offer.pop("connection_protection", None)
    journey = parse_duffel_journey(offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    assert journey.connection_protection == "unknown"
    assert journey.protected_connection is None


def test_flexible_dates_search_every_requested_date_and_never_skip_selected_date():
    from app.services.flight_adaptive_search import execute_adaptive_duffel_search

    offer = _three_connection_offer()
    dates_called: list[str] = []

    def fake_create_offer_request(**kwargs):
        departure_date = kwargs["slices"][0]["departure_date"]
        dates_called.append(departure_date)
        # Return 5 offers for every date
        return {"offers": [offer] * 5}

    body = _search_body(flexible_dates=True, maximum_connections=1, strict_connection_limit=False)
    journeys, metadata = execute_adaptive_duffel_search(
        body,
        create_offer_request=fake_create_offer_request,
        build_duffel_slices=lambda b: [{"origin": "ORD", "destination": "HBA", "departure_date": b.slices[0].departure_date.isoformat()}],
        build_duffel_passengers=lambda p: [{"type": "adult"}],
        cabin_to_duffel={"economy": "economy"},
        apply_post_time_filters=lambda j, b: True,
        rank_journeys=_rank_journeys,
        checked_at="2026-10-01T12:00:00Z",
    )
    # Must search all 5 date offsets [-2, -1, 0, 1, 2]
    unique_dates = sorted(set(dates_called))
    assert len(unique_dates) == 5
    selected_date_str = body.slices[0].departure_date.isoformat()
    assert selected_date_str in unique_dates


def test_strict_connection_limit_runs_once_per_date():
    from app.services.flight_adaptive_search import execute_adaptive_duffel_search

    offer = _three_connection_offer()
    attempts_made: list[tuple[str, int]] = []

    def fake_create_offer_request(**kwargs):
        attempts_made.append((kwargs["slices"][0]["departure_date"], kwargs["max_connections"]))
        return {"offers": [offer]}

    body = _search_body(flexible_dates=True, maximum_connections=2, strict_connection_limit=True)
    journeys, metadata = execute_adaptive_duffel_search(
        body,
        create_offer_request=fake_create_offer_request,
        build_duffel_slices=lambda b: [{"origin": "ORD", "destination": "HBA", "departure_date": b.slices[0].departure_date.isoformat()}],
        build_duffel_passengers=lambda p: [{"type": "adult"}],
        cabin_to_duffel={"economy": "economy"},
        apply_post_time_filters=lambda j, b: True,
        rank_journeys=_rank_journeys,
        checked_at="2026-10-01T12:00:00Z",
    )
    assert len(attempts_made) == 5
    assert all(conn == 2 for _, conn in attempts_made)


def test_nonstop_runs_once_per_date():
    from app.services.flight_adaptive_search import execute_adaptive_duffel_search

    offer = _three_connection_offer()
    attempts_made: list[tuple[str, int]] = []

    def fake_create_offer_request(**kwargs):
        attempts_made.append((kwargs["slices"][0]["departure_date"], kwargs["max_connections"]))
        return {"offers": [offer]}

    body = _search_body(flexible_dates=True, maximum_connections=0, strict_connection_limit=False)
    journeys, metadata = execute_adaptive_duffel_search(
        body,
        create_offer_request=fake_create_offer_request,
        build_duffel_slices=lambda b: [{"origin": "ORD", "destination": "HBA", "departure_date": b.slices[0].departure_date.isoformat()}],
        build_duffel_passengers=lambda p: [{"type": "adult"}],
        cabin_to_duffel={"economy": "economy"},
        apply_post_time_filters=lambda j, b: True,
        rank_journeys=_rank_journeys,
        checked_at="2026-10-01T12:00:00Z",
    )
    assert len(attempts_made) == 5
    assert all(conn == 0 for _, conn in attempts_made)


def test_recommendation_copy_no_self_comparison_or_zero_delta():
    j1 = parse_duffel_journey(_three_connection_offer(), currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    j2 = j1.model_copy(update={"id": "off_2", "provider_offer_id": "off_2", "price": j1.price + 100})
    ranked = _rank_journeys([j1, j2])
    reason_cheapest = ranked[0].recommendation_reason or ""
    assert "0m longer" not in reason_cheapest
    assert "0h longer" not in reason_cheapest
    assert "longer than itself" not in reason_cheapest


def _ord_hba_naive_timestamps_offer(**extra: object) -> dict:
    offer = {
        "id": "off_ord_hba_naive",
        "total_amount": "2400.00",
        "total_currency": "USD",
        "expires_at": "2099-01-01T00:00:00Z",
        "live_mode": False,
        "slices": [
            {
                "duration": None,
                "origin": {"iata_code": "ORD"},
                "destination": {"iata_code": "HBA"},
                "segments": [
                    {
                        "departing_at": "2026-10-10T08:00:00",
                        "arriving_at": "2026-10-10T21:30:00",
                        "duration": "PT13H30M",
                        "marketing_carrier": {"iata_code": "NH", "name": "ANA"},
                        "operating_carrier": {"iata_code": "NH", "name": "ANA"},
                        "marketing_carrier_flight_number": "111",
                        "origin": {"iata_code": "ORD"},
                        "destination": {"iata_code": "HND"},
                    },
                    {
                        "departing_at": "2026-10-10T23:00:00",
                        "arriving_at": "2026-10-11T23:40:00",
                        "duration": "PT9H40M",
                        "marketing_carrier": {"iata_code": "NH", "name": "ANA"},
                        "operating_carrier": {"iata_code": "NQ", "name": "Air Japan"},
                        "marketing_carrier_flight_number": "879",
                        "origin": {"iata_code": "HND"},
                        "destination": {"iata_code": "SYD"},
                    },
                    {
                        "departing_at": "2026-10-12T08:05:00",
                        "arriving_at": "2026-10-12T10:00:00",
                        "duration": "PT1H55M",
                        "marketing_carrier": {"iata_code": "VA", "name": "Virgin Australia"},
                        "operating_carrier": {"iata_code": "VA", "name": "Virgin Australia"},
                        "marketing_carrier_flight_number": "1528",
                        "origin": {"iata_code": "SYD"},
                        "destination": {"iata_code": "HBA"},
                    },
                ],
            }
        ],
    }
    offer.update(extra)
    return offer


def test_aware_timestamps_elapsed_duration_when_no_slice_duration():
    offer = _ord_hba_naive_timestamps_offer()
    for seg in offer["slices"][0]["segments"]:
        if seg["origin"]["iata_code"] == "ORD":
            seg["departing_at"] = "2026-10-10T08:00:00-05:00"
            seg["arriving_at"] = "2026-10-10T21:30:00+09:00"
        elif seg["origin"]["iata_code"] == "HND":
            seg["departing_at"] = "2026-10-10T23:00:00+09:00"
            seg["arriving_at"] = "2026-10-11T23:40:00+10:00"
        else:
            seg["departing_at"] = "2026-10-12T08:05:00+10:00"
            seg["arriving_at"] = "2026-10-12T10:00:00+10:00"
    journey = parse_duffel_journey(offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    assert journey.total_duration_minutes == 2100


def test_naive_ord_hba_uses_segments_plus_layovers_not_timestamp_subtraction():
    journey = parse_duffel_journey(
        _ord_hba_naive_timestamps_offer(),
        currency_preference="USD",
        checked_at="2026-10-01T12:00:00Z",
    )
    assert journey is not None
    assert journey.total_duration_minutes == 2100
    assert journey.duration_minutes == 2100
    assert journey.total_duration_minutes != 3000


def test_mixed_aware_naive_timestamps_use_segment_fallback():
    offer = _ord_hba_naive_timestamps_offer()
    offer["slices"][0]["segments"][0]["departing_at"] = "2026-10-10T08:00:00-05:00"
    offer["slices"][0]["segments"][-1]["arriving_at"] = "2026-10-12T10:00:00"
    journey = parse_duffel_journey(offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    assert journey.total_duration_minutes == 2100


def test_invalid_timestamps_use_segment_plus_layover_fallback():
    from app.services.flight_journey_parser import _calculate_slice_duration

    seg1 = _segment(dep="not-a-date", arr="also-not-a-date").model_copy(update={"duration_minutes": 810})
    seg2 = _segment(dep="bad", arr="bad").model_copy(update={"duration_minutes": 580})
    seg3 = _segment(dep="bad", arr="bad").model_copy(update={"duration_minutes": 115})
    conn1 = FlightConnectionDetail(airport="HND", layover_minutes=90)
    conn2 = FlightConnectionDetail(airport="SYD", layover_minutes=505)
    dur = _calculate_slice_duration(None, [seg1, seg2, seg3], [conn1, conn2])
    assert dur == 2100


def test_airport_change_naive_timestamps_skip_layover_invention():
    from app.services.flight_journey_parser import _derive_connections

    seg_a = _segment(origin="ORD", destination="LAX", dep="2026-10-10T08:00:00", arr="2026-10-10T11:00:00")
    seg_b = _segment(origin="BUR", destination="SYD", dep="2026-10-10T14:00:00", arr="2026-10-11T08:00:00")
    seg_b = seg_b.model_copy(update={"origin": "BUR", "duration_minutes": 600})
    connections = _derive_connections([seg_a, seg_b])
    assert connections[0].layover_minutes is None
    assert connections[0].airport_change is True


def test_multi_does_not_normalize_to_separate_tickets():
    journey = parse_duffel_journey(
        _ord_hba_naive_timestamps_offer(ticket_type="multi", fare_type="multi"),
        currency_preference="USD",
        checked_at="2026-10-01T12:00:00Z",
    )
    assert journey is not None
    assert journey.ticket_type == "unknown"


def test_multi_city_does_not_normalize_to_separate_tickets():
    journey = parse_duffel_journey(
        _ord_hba_naive_timestamps_offer(fare_type="multi_city"),
        currency_preference="USD",
        checked_at="2026-10-01T12:00:00Z",
    )
    assert journey is not None
    assert journey.ticket_type == "unknown"


def test_explicit_separate_tickets_remains_separate_tickets():
    journey = parse_duffel_journey(
        _ord_hba_naive_timestamps_offer(ticket_type="separate_tickets"),
        currency_preference="USD",
        checked_at="2026-10-01T12:00:00Z",
    )
    assert journey is not None
    assert journey.ticket_type == "separate_tickets"


def test_explicit_self_transfer_warning_remains_self_transfer():
    offer = _ord_hba_naive_timestamps_offer()
    offer["warnings"] = [{"code": "self_transfer", "message": "Self transfer required in Sydney"}]
    journey = parse_duffel_journey(offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    assert journey.baggage_transfer == "self_transfer"
    assert journey.self_transfer is True


def test_unknown_ticket_type_remains_unknown():
    journey = parse_duffel_journey(
        _ord_hba_naive_timestamps_offer(ticket_type="corporate"),
        currency_preference="USD",
        checked_at="2026-10-01T12:00:00Z",
    )
    assert journey is not None
    assert journey.ticket_type == "unknown"

