"""Deterministic itinerary keys for metasearch grouping."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from app.schemas.flight_journey import FlightJourney, FlightJourneySlice
from app.schemas.flight_metasearch import RovvyFlightOffer


def _segment_fingerprint_parts(segment: Any, *, cabin: str | None = None) -> list[str]:
    op_code = getattr(segment, "operating_airline_code", "") or getattr(segment, "airline_code", "")
    flight_number = getattr(segment, "flight_number", "") or ""
    origin = getattr(segment, "origin", "")
    destination = getattr(segment, "destination", "")
    departure_at = getattr(segment, "departure_at", "")
    arrival_at = getattr(segment, "arrival_at", "")
    parts = [
        str(op_code).upper(),
        str(flight_number).upper(),
        str(origin).upper(),
        str(destination).upper(),
        str(departure_at),
        str(arrival_at),
    ]
    if cabin:
        parts.append(str(cabin).lower())
    return parts


def itinerary_key_from_slices(slices: list[FlightJourneySlice], *, cabin: str | None = None) -> str:
    parts: list[str] = []
    for sl in slices:
        for seg in sl.segments:
            parts.extend(_segment_fingerprint_parts(seg, cabin=cabin))
    digest = hashlib.sha256(json.dumps(parts, separators=(",", ":")).encode("utf-8")).hexdigest()
    return digest[:32]


def itinerary_key_from_journey(journey: FlightJourney, *, cabin: str | None = None) -> str:
    return itinerary_key_from_slices(journey.slices, cabin=cabin)


def itinerary_key_from_offer(offer: RovvyFlightOffer, *, cabin: str | None = None) -> str:
    if offer.itinerary_key:
        return offer.itinerary_key
    return itinerary_key_from_slices(offer.slices, cabin=cabin)
