"""Parse Duffel offers into complete Rovvy journey models with connections."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from app.schemas.flight_journey import (
    FlightConnectionDetail,
    FlightJourney,
    FlightJourneySegment,
    FlightJourneySlice,
)


def parse_iso_duration_to_minutes(duration_str: str | None) -> int:
    if not duration_str:
        return 0
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", duration_str)
    if not match:
        return 0
    hours = int(match.group(1)) if match.group(1) else 0
    minutes = int(match.group(2)) if match.group(2) else 0
    return hours * 60 + minutes


def _parse_iso_datetime(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None


def _bag_included(offer: dict[str, Any], bag_type: str) -> bool | None:
    for passenger in offer.get("passengers") or []:
        if not isinstance(passenger, dict):
            continue
        for bag in passenger.get("baggages") or []:
            if isinstance(bag, dict) and bag.get("type") == bag_type:
                return True
    for sl in offer.get("slices") or []:
        if not isinstance(sl, dict):
            continue
        for seg in sl.get("segments") or []:
            if not isinstance(seg, dict):
                continue
            for pax in seg.get("passengers") or []:
                if not isinstance(pax, dict):
                    continue
                for bag in pax.get("baggages") or []:
                    if isinstance(bag, dict) and bag.get("type") == bag_type:
                        return True
    return None


def _parse_segment(seg: dict[str, Any]) -> FlightJourneySegment | None:
    if not isinstance(seg, dict):
        return None
    carrier = seg.get("marketing_carrier") or {}
    operating = seg.get("operating_carrier") or carrier
    origin = seg.get("origin") or {}
    dest = seg.get("destination") or {}
    origin_code = str(origin.get("iata_code") or "")
    dest_code = str(dest.get("iata_code") or "")
    if not origin_code or not dest_code:
        return None
    airline_code = str(carrier.get("iata_code") or "").upper()
    op_code = str(operating.get("iata_code") or airline_code).upper()
    flight_num = str(seg.get("marketing_carrier_flight_number") or "")
    return FlightJourneySegment(
        origin=origin_code,
        origin_name=str(origin.get("name") or origin.get("city_name") or ""),
        destination=dest_code,
        destination_name=str(dest.get("name") or dest.get("city_name") or ""),
        departure_at=str(seg.get("departing_at") or ""),
        arrival_at=str(seg.get("arriving_at") or ""),
        duration_minutes=parse_iso_duration_to_minutes(str(seg.get("duration") or "")),
        airline_code=airline_code,
        airline_name=str(carrier.get("name") or ""),
        operating_airline_code=op_code,
        operating_airline_name=str(operating.get("name") or carrier.get("name") or ""),
        flight_number=f"{airline_code}{flight_num}" if airline_code and flight_num else flight_num,
        aircraft=str((seg.get("aircraft") or {}).get("name") or ""),
        origin_terminal=str(origin.get("terminal") or ""),
        destination_terminal=str(dest.get("terminal") or ""),
    )


def _derive_connections(segments: list[FlightJourneySegment]) -> list[FlightConnectionDetail]:
    connections: list[FlightConnectionDetail] = []
    for idx in range(len(segments) - 1):
        prev = segments[idx]
        nxt = segments[idx + 1]
        arrival_dt = _parse_iso_datetime(prev.arrival_at)
        depart_dt = _parse_iso_datetime(nxt.departure_at)
        layover_minutes: int | None = None
        overnight: bool | None = None
        if arrival_dt and depart_dt:
            delta = depart_dt - arrival_dt
            layover_minutes = max(0, int(delta.total_seconds() // 60))
            overnight = arrival_dt.date() != depart_dt.date()
        same_airport = prev.destination == nxt.origin
        airport_change = not same_airport if prev.destination and nxt.origin else None
        term_a = (prev.destination_terminal or "").strip()
        term_b = (nxt.origin_terminal or "").strip()
        terminal_change: bool | None = None
        if same_airport and term_a and term_b:
            terminal_change = term_a != term_b
        connections.append(
            FlightConnectionDetail(
                airport=prev.destination,
                airport_name=prev.destination_name,
                arrival_at=prev.arrival_at or None,
                next_departure_at=nxt.departure_at or None,
                layover_minutes=layover_minutes,
                overnight=overnight,
                same_airport=same_airport,
                airport_change=airport_change,
                terminal_change=terminal_change,
                # The Duffel offer payload does not explicitly guarantee
                # connection protection here. Preserve the value as unknown.
                protected=None,
            )
        )
    return connections


def _parse_slice(sl: dict[str, Any]) -> FlightJourneySlice | None:
    if not isinstance(sl, dict):
        return None
    segments: list[FlightJourneySegment] = []
    for seg in sl.get("segments") or []:
        parsed = _parse_segment(seg if isinstance(seg, dict) else {})
        if parsed:
            segments.append(parsed)
    if not segments:
        return None
    origin_obj = sl.get("origin") or {}
    dest_obj = sl.get("destination") or {}
    return FlightJourneySlice(
        origin=str(origin_obj.get("iata_code") or segments[0].origin),
        destination=str(dest_obj.get("iata_code") or segments[-1].destination),
        duration_minutes=parse_iso_duration_to_minutes(str(sl.get("duration") or "")),
        stops=max(0, len(segments) - 1),
        segments=segments,
        connections=_derive_connections(segments),
    )


def parse_duffel_journey(
    offer: dict[str, Any],
    *,
    currency_preference: str,
    checked_at: str,
    maximum_connections: int = 0,
) -> FlightJourney | None:
    try:
        rid = str(offer.get("id") or "")
        price_str = offer.get("total_amount")
        if not rid or price_str is None:
            return None
        price_f = float(price_str)
        currency = str(offer.get("total_currency") or currency_preference).upper()

        slices_raw = offer.get("slices") or []
        slices: list[FlightJourneySlice] = []
        airlines: list[str] = []
        total_duration = 0
        total_stops = 0

        for sl in slices_raw:
            parsed = _parse_slice(sl if isinstance(sl, dict) else {})
            if parsed:
                slices.append(parsed)
                total_duration += parsed.duration_minutes
                total_stops += parsed.stops
                for seg in parsed.segments:
                    for code in (seg.airline_code, seg.operating_airline_code):
                        if code and code not in airlines:
                            airlines.append(code)

        if not slices:
            return None

        first_seg = slices[0].segments[0]
        last_slice = slices[-1]
        last_seg = last_slice.segments[-1]

        refundable: bool | None = None
        changeable: bool | None = None
        conditions = offer.get("conditions") or {}
        if isinstance(conditions, dict):
            refund = conditions.get("refund_before_departure") or {}
            change = conditions.get("change_before_departure") or {}
            if isinstance(refund, dict) and refund.get("allowed") is not None:
                refundable = bool(refund.get("allowed"))
            if isinstance(change, dict) and change.get("allowed") is not None:
                changeable = bool(change.get("allowed"))

        return FlightJourney(
            id=rid,
            provider="duffel",
            provider_offer_id=rid,
            price=price_f,
            currency=currency,
            checked_at=checked_at,
            expires_at=str(offer.get("expires_at") or ""),
            live_mode=bool(offer.get("live_mode")),
            slices=slices,
            total_duration_minutes=total_duration,
            maximum_connections=maximum_connections,
            protected_connection=None,
            bookable_in_rovvy=True,
            airlines=airlines,
            carry_on_included=_bag_included(offer, "carry_on"),
            checked_bag_included=_bag_included(offer, "checked"),
            refundable=refundable,
            changeable=changeable,
            departure_at=first_seg.departure_at,
            arrival_at=last_seg.arrival_at,
            origin=slices[0].origin,
            destination=last_slice.destination,
            duration_minutes=total_duration,
            stops=total_stops,
            deep_link="",
        )
    except Exception:
        return None


def segment_departure_local_minutes(iso: str) -> int | None:
    dt = _parse_iso_datetime(iso)
    if not dt:
        return None
    return dt.hour * 60 + dt.minute


def hhmm_to_minutes(hhmm: str) -> int:
    parts = hhmm.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def slice_matches_time_window(
    slice_obj: FlightJourneySlice,
    time_from: str | None,
    time_to: str | None,
) -> bool:
    """Filter on first segment departure in origin-local time (embedded in ISO)."""
    if not time_from and not time_to:
        return True
    if not slice_obj.segments:
        return False
    dep_mins = segment_departure_local_minutes(slice_obj.segments[0].departure_at)
    if dep_mins is None:
        return True
    start = hhmm_to_minutes(time_from) if time_from else 0
    end = hhmm_to_minutes(time_to) if time_to else 24 * 60 - 1
    if start <= end:
        return start <= dep_mins <= end
    # Window crosses midnight
    return dep_mins >= start or dep_mins <= end
