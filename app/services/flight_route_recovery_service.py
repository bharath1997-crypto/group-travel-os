"""Bounded, transparent alternatives for exact flight searches with no fares."""

from __future__ import annotations

from app.schemas.flight_journey import FlightRouteRecoveryOption, FlightSearchRequest
from app.services.airport_dataset_service import AirportDatasetService, AirportRecord


_COUNTRY_GATEWAYS: dict[str, tuple[str, ...]] = {
    "US": ("ORD", "JFK", "LAX", "DFW", "ATL", "SFO"),
    "IN": ("DEL", "BOM", "BLR", "HYD", "MAA"),
    "CN": ("PEK", "PVG", "CAN", "CTU", "URC"),
    "GB": ("LHR", "LGW", "MAN"),
    "AE": ("DXB", "AUH"),
    "QA": ("DOH",),
    "TR": ("IST",),
}

_GLOBAL_GATEWAYS = ("LHR", "DXB", "DOH", "IST", "PEK", "PVG")


def _usable_nearby(record: AirportRecord, original: str) -> list[tuple[AirportRecord, float]]:
    rows = AirportDatasetService.nearby(
        record.latitude,
        record.longitude,
        limit=30,
        max_km=500.0,
    )
    return [
        (airport, distance)
        for airport, distance in rows
        if airport.iata != original
        and airport.scheduled_service
        and airport.airport_type in {"large_airport", "medium_airport"}
    ]


class FlightRouteRecoveryService:
    @staticmethod
    def build(body: FlightSearchRequest, *, limit: int = 8) -> list[FlightRouteRecoveryOption]:
        if body.trip_type != "one_way" or not body.slices:
            return []

        flight = body.slices[0]
        origin = AirportDatasetService.get_by_iata(flight.origin)
        destination = AirportDatasetService.get_by_iata(flight.destination)
        if origin is None or destination is None:
            return []

        options: list[FlightRouteRecoveryOption] = []
        seen: set[tuple[str, str]] = {(flight.origin, flight.destination)}

        def add(option: FlightRouteRecoveryOption) -> None:
            key = (option.origin, option.destination)
            if key not in seen and len(options) < limit:
                seen.add(key)
                options.append(option)

        for airport, distance in _usable_nearby(origin, flight.origin)[:2]:
            add(FlightRouteRecoveryOption(
                origin=airport.iata,
                destination=flight.destination,
                departure_date=flight.departure_date,
                tier="nearby_origin",
                title=f"Depart from {airport.iata} instead",
                explanation=f"Search from {airport.name}, about {distance:.0f} km from {origin.name}.",
                origin_distance_km=round(distance, 1),
            ))

        for airport, distance in _usable_nearby(destination, flight.destination)[:2]:
            add(FlightRouteRecoveryOption(
                origin=flight.origin,
                destination=airport.iata,
                departure_date=flight.departure_date,
                tier="nearby_destination",
                title=f"Arrive at {airport.iata} instead",
                explanation=f"Search to {airport.name}, about {distance:.0f} km from {destination.name}.",
                destination_distance_km=round(distance, 1),
            ))

        for gateway in _COUNTRY_GATEWAYS.get(origin.iso_country, ()):
            if gateway != flight.origin:
                add(FlightRouteRecoveryOption(
                    origin=gateway,
                    destination=flight.destination,
                    departure_date=flight.departure_date,
                    tier="national_gateway",
                    title=f"Try national gateway {gateway}",
                    explanation=f"Reach {gateway} separately, then search {gateway} to {flight.destination}.",
                    separate_searches_required=True,
                ))
                break

        for gateway in _COUNTRY_GATEWAYS.get(destination.iso_country, ()):
            if gateway != flight.destination:
                add(FlightRouteRecoveryOption(
                    origin=flight.origin,
                    destination=gateway,
                    departure_date=flight.departure_date,
                    tier="national_gateway",
                    title=f"Try destination gateway {gateway}",
                    explanation=f"Search {flight.origin} to {gateway}, then arrange onward travel to {flight.destination} separately.",
                    separate_searches_required=True,
                ))
                break

        for gateway in _GLOBAL_GATEWAYS:
            if gateway not in {flight.origin, flight.destination}:
                add(FlightRouteRecoveryOption(
                    origin=flight.origin,
                    destination=gateway,
                    departure_date=flight.departure_date,
                    tier="international_gateway",
                    title=f"Explore a connection via {gateway}",
                    explanation=f"Search the first leg to {gateway}; a second ticket to {flight.destination} may be required.",
                    separate_searches_required=True,
                ))
                break

        return options
