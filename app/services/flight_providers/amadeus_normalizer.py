"""Normalize Amadeus Flight Offers Search payloads into Rovvy journey models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.schemas.flight_journey import FlightJourney, FlightJourneySegment, FlightJourneySlice
from app.services.flight_journey_parser import (
    _calculate_slice_duration,
    _derive_connections,
    parse_iso_duration_to_minutes,
)


_CABIN_MAP = {
    "ECONOMY": "economy",
    "PREMIUM_ECONOMY": "premium_economy",
    "BUSINESS": "business",
    "FIRST": "first",
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _carrier_name(code: str, dictionaries: dict[str, Any]) -> str:
    carriers = dictionaries.get("carriers") or {}
    if isinstance(carriers, dict):
        name = carriers.get(code)
        if isinstance(name, str) and name.strip():
            return name.strip()
    return ""


def _aircraft_name(code: str, dictionaries: dict[str, Any]) -> str:
    aircraft = dictionaries.get("aircraft") or {}
    if isinstance(aircraft, dict):
        name = aircraft.get(code)
        if isinstance(name, str) and name.strip():
            return name.strip()
    return code


def _parse_checked_bags(included: Any) -> bool | None:
    """Map one Amadeus includedCheckedBags object to included / not included / unknown."""
    if not isinstance(included, dict):
        return None

    quantity_result: bool | None = None
    weight_result: bool | None = None

    quantity = included.get("quantity")
    if quantity is not None:
        try:
            parsed_quantity = int(quantity)
            if parsed_quantity < 0:
                quantity_result = None
            elif parsed_quantity > 0:
                quantity_result = True
            else:
                quantity_result = False
        except (TypeError, ValueError):
            quantity_result = None

    weight = included.get("weight")
    if weight is not None:
        try:
            parsed_weight = float(weight)
            if parsed_weight < 0:
                weight_result = None
            elif parsed_weight > 0:
                weight_result = True
            else:
                weight_result = False
        except (TypeError, ValueError):
            weight_result = None

    if quantity_result is not None and weight_result is not None and quantity_result != weight_result:
        return None
    if quantity_result is not None:
        return quantity_result
    if weight_result is not None:
        return weight_result
    return None


def _merge_traveler_segment_status(values: list[bool | None]) -> bool | None:
    """Merge per-traveler baggage status for one segment.

    Return ``None`` when any traveler is unknown or travelers disagree.
    Return ``True`` or ``False`` only when every traveler shares the same
    explicit included / not-included value.
    """
    if not values:
        return None
    if any(value is None for value in values):
        return None
    if len(set(values)) > 1:
        return None
    return values[0]


def _segment_baggage_statuses(offer: dict[str, Any]) -> dict[str, bool | None]:
    by_segment: dict[str, list[bool | None]] = {}
    for traveler in offer.get("travelerPricings") or []:
        if not isinstance(traveler, dict):
            continue
        for detail in traveler.get("fareDetailsBySegment") or []:
            if not isinstance(detail, dict):
                continue
            segment_id = str(detail.get("segmentId") or "")
            if not segment_id:
                continue
            status = _parse_checked_bags(detail.get("includedCheckedBags"))
            by_segment.setdefault(segment_id, []).append(status)
    return {
        segment_id: _merge_traveler_segment_status(values)
        for segment_id, values in by_segment.items()
    }


def _itinerary_segment_ids(offer: dict[str, Any]) -> list[str]:
    segment_ids: list[str] = []
    for itinerary in offer.get("itineraries") or []:
        if not isinstance(itinerary, dict):
            continue
        for segment in itinerary.get("segments") or []:
            if not isinstance(segment, dict):
                continue
            segment_id = str(segment.get("id") or "")
            if segment_id:
                segment_ids.append(segment_id)
    return segment_ids


def _offer_checked_bag_included(offer: dict[str, Any]) -> bool | None:
    """Aggregate checked-baggage inclusion across all itinerary segments.

    Rules:
    - Return ``True`` only when every applicable itinerary segment confirms included baggage.
    - Return ``False`` when at least one applicable segment explicitly confirms zero/no baggage.
    - Return ``None`` when baggage is missing, incomplete, inconsistent across travelers,
      or cannot be represented accurately at journey level.
    """
    segment_ids = _itinerary_segment_ids(offer)
    if not segment_ids:
        return None

    statuses = _segment_baggage_statuses(offer)
    observed: list[bool | None] = [statuses.get(segment_id) for segment_id in segment_ids]

    if any(status is False for status in observed):
        return False
    if all(status is True for status in observed):
        return True
    return None


def _parse_segment(
    segment: dict[str, Any],
    *,
    dictionaries: dict[str, Any],
) -> FlightJourneySegment | None:
    if not isinstance(segment, dict):
        return None
    departure = segment.get("departure") or {}
    arrival = segment.get("arrival") or {}
    origin = str(departure.get("iataCode") or "").upper()
    destination = str(arrival.get("iataCode") or "").upper()
    if not origin or not destination:
        return None

    marketing_code = str(segment.get("carrierCode") or "").upper()
    operating = segment.get("operating") or {}
    operating_code = str(operating.get("carrierCode") or marketing_code).upper()
    flight_number = str(segment.get("number") or "")
    aircraft_code = str((segment.get("aircraft") or {}).get("code") or "")

    return FlightJourneySegment(
        origin=origin,
        origin_name="",
        destination=destination,
        destination_name="",
        departure_at=str(departure.get("at") or ""),
        arrival_at=str(arrival.get("at") or ""),
        duration_minutes=parse_iso_duration_to_minutes(str(segment.get("duration") or "")),
        airline_code=marketing_code,
        airline_name=_carrier_name(marketing_code, dictionaries),
        operating_airline_code=operating_code,
        operating_airline_name=_carrier_name(operating_code, dictionaries),
        flight_number=f"{marketing_code}{flight_number}" if marketing_code and flight_number else flight_number,
        aircraft=_aircraft_name(aircraft_code, dictionaries) if aircraft_code else "",
        origin_terminal=str(departure.get("terminal") or ""),
        destination_terminal=str(arrival.get("terminal") or ""),
    )


def _parse_itinerary(
    itinerary: dict[str, Any],
    *,
    dictionaries: dict[str, Any],
) -> FlightJourneySlice | None:
    if not isinstance(itinerary, dict):
        return None
    segments: list[FlightJourneySegment] = []
    for raw_segment in itinerary.get("segments") or []:
        parsed = _parse_segment(raw_segment if isinstance(raw_segment, dict) else {}, dictionaries=dictionaries)
        if parsed:
            segments.append(parsed)
    if not segments:
        return None

    connections = _derive_connections(segments)
    duration_minutes = _calculate_slice_duration(
        str(itinerary.get("duration") or "") if itinerary.get("duration") else None,
        segments,
        connections,
    )
    stops = max(0, len(segments) - 1)
    return FlightJourneySlice(
        origin=segments[0].origin,
        destination=segments[-1].destination,
        duration_minutes=duration_minutes,
        stops=stops,
        segments=segments,
        connections=connections,
    )


def _last_ticketing_date_from_offer(offer: dict[str, Any]) -> str | None:
    last_ticketing = str(offer.get("lastTicketingDate") or "").strip()
    if not last_ticketing:
        return None
    return last_ticketing


def normalize_amadeus_offer(
    offer: dict[str, Any],
    *,
    dictionaries: dict[str, Any],
    live_mode: bool,
    checked_at: str | None = None,
) -> FlightJourney | None:
    if not isinstance(offer, dict):
        return None

    offer_id = str(offer.get("id") or "").strip()
    if not offer_id:
        return None

    price = offer.get("price") or {}
    if not isinstance(price, dict):
        return None
    try:
        total_price = float(price.get("total"))
    except (TypeError, ValueError):
        return None
    currency = str(price.get("currency") or "USD").upper()

    slices: list[FlightJourneySlice] = []
    for itinerary in offer.get("itineraries") or []:
        parsed = _parse_itinerary(itinerary if isinstance(itinerary, dict) else {}, dictionaries=dictionaries)
        if parsed:
            slices.append(parsed)
    if not slices:
        return None

    airlines: list[str] = []
    for code in offer.get("validatingAirlineCodes") or []:
        normalized = str(code or "").upper()
        if normalized and normalized not in airlines:
            airlines.append(normalized)
    if not airlines:
        for sl in slices:
            for seg in sl.segments:
                if seg.airline_code and seg.airline_code not in airlines:
                    airlines.append(seg.airline_code)

    first_segment = slices[0].segments[0]
    last_segment = slices[-1].segments[-1]
    total_duration = sum(sl.duration_minutes for sl in slices if sl.duration_minutes > 0)
    total_stops = sum(sl.stops for sl in slices)

    return FlightJourney(
        id=offer_id,
        provider="amadeus",
        provider_offer_id=offer_id,
        price=total_price,
        currency=currency,
        checked_at=checked_at or _utc_now_iso(),
        expires_at="",
        last_ticketing_date=_last_ticketing_date_from_offer(offer),
        live_mode=live_mode,
        slices=slices,
        total_duration_minutes=total_duration,
        maximum_connections=total_stops,
        protected_connection=None,
        ticket_type="unknown",
        connection_protection="unknown",
        baggage_transfer="unknown",
        separate_tickets=None,
        self_transfer=None,
        bookable_in_rovvy=False,
        airlines=airlines,
        carry_on_included=None,
        checked_bag_included=_offer_checked_bag_included(offer),
        refundable=None,
        changeable=None,
        departure_at=first_segment.departure_at,
        arrival_at=last_segment.arrival_at,
        origin=first_segment.origin,
        destination=last_segment.destination,
        duration_minutes=total_duration,
        stops=total_stops,
        deep_link="",
    )


def normalize_amadeus_offers(
    payload: dict[str, Any],
    *,
    live_mode: bool,
    checked_at: str | None = None,
) -> list[FlightJourney]:
    dictionaries = payload.get("dictionaries") if isinstance(payload.get("dictionaries"), dict) else {}
    journeys: list[FlightJourney] = []
    for offer in payload.get("data") or []:
        journey = normalize_amadeus_offer(
            offer if isinstance(offer, dict) else {},
            dictionaries=dictionaries,
            live_mode=live_mode,
            checked_at=checked_at,
        )
        if journey:
            journeys.append(journey)
    return journeys
