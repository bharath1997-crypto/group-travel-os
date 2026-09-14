"""Convert journeys/offers into itinerary groups and legacy journey rows."""

from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.flight_journey import FlightJourney
from app.schemas.flight_metasearch import (
    RovvyBaggageSummary,
    RovvyFareConditions,
    RovvyFlightOffer,
    RovvyItineraryGroup,
    RovvySellerOption,
    SellerActionType,
)
from app.services.flight_providers.itinerary_fingerprint import itinerary_key_from_offer


def _baggage_summary(journey: FlightJourney) -> RovvyBaggageSummary:
    parts: list[str] = []
    if journey.carry_on_included is True:
        parts.append("Carry-on included")
    if journey.checked_bag_included is True:
        parts.append("Checked bag included")
    summary = " · ".join(parts) if parts else None
    return RovvyBaggageSummary(
        carry_on_included=journey.carry_on_included,
        checked_bag_included=journey.checked_bag_included,
        summary=summary or "Not confirmed",
    )


def _fare_conditions(journey: FlightJourney) -> RovvyFareConditions:
    parts: list[str] = []
    if journey.changeable is True:
        parts.append("Changeable")
    if journey.refundable is True:
        parts.append("Refundable")
    summary = " · ".join(parts) if parts else None
    return RovvyFareConditions(
        refundable=journey.refundable,
        changeable=journey.changeable,
        summary=summary or "Not confirmed",
    )


def _resolve_action_type(
    provider_id: str,
    provider_offer_id: str,
    redirect_url: str | None,
) -> SellerActionType:
    if redirect_url and redirect_url.strip().startswith(("http://", "https://")):
        return "external_redirect"
    return "unavailable"


def _seller_display_name(provider_id: str, environment: str | None) -> str:
    if provider_id == "duffel":
        return "Duffel sandbox" if environment == "test" else "Duffel"
    if provider_id == "amadeus":
        return "Amadeus test" if environment == "test" else "Amadeus"
    return provider_id.replace("_", " ").title()


def journey_to_offer(journey: FlightJourney, *, cabin: str | None = None) -> RovvyFlightOffer:
    environment = "live" if journey.live_mode else "test"
    redirect_url = journey.deep_link.strip() if journey.deep_link else None
    if redirect_url == "":
        redirect_url = None
    key = itinerary_key_from_offer(
        RovvyFlightOffer(
            provider_id=journey.provider,
            provider_offer_id=journey.provider_offer_id,
            itinerary_key="",
            seller_id=journey.provider,
            seller_name=journey.provider,
            slices=journey.slices,
            total_price=journey.price,
            currency=journey.currency,
            checked_at=journey.checked_at,
            expires_at=journey.expires_at or None,
        ),
        cabin=cabin,
    )
    marketing = list(journey.airlines)
    operating: list[str] = []
    for sl in journey.slices:
        for seg in sl.segments:
            code = seg.operating_airline_code or seg.airline_code
            if code and code not in operating:
                operating.append(code)

    seller_name = _seller_display_name(journey.provider, environment)
    return RovvyFlightOffer(
        provider_id=journey.provider,
        provider_offer_id=journey.provider_offer_id,
        itinerary_key=key,
        seller_id=journey.provider,
        seller_name=seller_name,
        marketing_airlines=marketing,
        operating_airlines=operating,
        slices=journey.slices,
        total_price=journey.price,
        currency=journey.currency,
        baggage=_baggage_summary(journey),
        fare_conditions=_fare_conditions(journey),
        protected_connection=journey.protected_connection,
        ticket_type=journey.ticket_type,
        connection_protection=journey.connection_protection,
        baggage_transfer=journey.baggage_transfer,
        separate_tickets=journey.separate_tickets,
        self_transfer=journey.self_transfer,
        redirect_url=redirect_url,
        action_type=_resolve_action_type(journey.provider, journey.provider_offer_id, redirect_url),
        checked_at=journey.checked_at,
        expires_at=journey.expires_at or None,
        last_ticketing_date=journey.last_ticketing_date,
        environment=environment,
        departure_at=journey.departure_at,
        arrival_at=journey.arrival_at,
        origin=journey.origin,
        destination=journey.destination,
        total_duration_minutes=journey.total_duration_minutes or journey.duration_minutes,
        stops=journey.stops,
        recommendation_score=journey.recommendation_score,
        recommendation_reason=journey.recommendation_reason,
    )


def offer_to_seller_option(offer: RovvyFlightOffer) -> RovvySellerOption:
    return RovvySellerOption(
        provider_id=offer.provider_id,
        provider_offer_id=offer.provider_offer_id,
        seller_id=offer.seller_id,
        seller_name=offer.seller_name,
        total_price=offer.total_price,
        currency=offer.currency,
        baggage=offer.baggage,
        fare_conditions=offer.fare_conditions,
        protected_connection=offer.protected_connection,
        ticket_type=offer.ticket_type,
        connection_protection=offer.connection_protection,
        baggage_transfer=offer.baggage_transfer,
        separate_tickets=offer.separate_tickets,
        self_transfer=offer.self_transfer,
        redirect_url=offer.redirect_url,
        action_type=offer.action_type,
        checked_at=offer.checked_at,
        expires_at=offer.expires_at,
        last_ticketing_date=offer.last_ticketing_date,
        environment=offer.environment,
    )


def _is_expired(expires_at: str | None) -> bool:
    if not expires_at:
        return False
    try:
        dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt <= datetime.now(timezone.utc)
    except ValueError:
        return False


def group_offers_into_itineraries(offers: list[RovvyFlightOffer]) -> list[RovvyItineraryGroup]:
    valid = [o for o in offers if o.slices and not _is_expired(o.expires_at)]
    buckets: dict[str, list[RovvyFlightOffer]] = {}
    for offer in valid:
        key = offer.itinerary_key or itinerary_key_from_offer(offer)
        offer = offer.model_copy(update={"itinerary_key": key})
        buckets.setdefault(key, []).append(offer)

    groups: list[RovvyItineraryGroup] = []
    for key, bucket in buckets.items():
        bucket.sort(key=lambda o: o.total_price)
        unique_bucket: list[RovvyFlightOffer] = []
        seen_seller_offers: set[tuple[str, str, str]] = set()
        for offer in bucket:
            identity = (offer.provider_id, offer.seller_id, offer.provider_offer_id)
            if identity in seen_seller_offers:
                continue
            seen_seller_offers.add(identity)
            unique_bucket.append(offer)

        best = unique_bucket[0]
        seller_options = [offer_to_seller_option(o) for o in unique_bucket]
        groups.append(
            RovvyItineraryGroup(
                itinerary_key=key,
                marketing_airlines=best.marketing_airlines,
                operating_airlines=best.operating_airlines,
                slices=best.slices,
                total_duration_minutes=best.total_duration_minutes,
                stops=best.stops,
                departure_at=best.departure_at,
                arrival_at=best.arrival_at,
                origin=best.origin,
                destination=best.destination,
                seller_options=seller_options,
                lowest_price=best.total_price,
                currency=best.currency,
                recommendation_score=best.recommendation_score,
                recommendation_reason=best.recommendation_reason,
            )
        )

    groups.sort(key=lambda g: g.lowest_price or 0)
    return groups


def offer_to_legacy_journey(offer: RovvyFlightOffer) -> FlightJourney:
    return FlightJourney(
        id=offer.provider_offer_id,
        provider=offer.provider_id,
        provider_offer_id=offer.provider_offer_id,
        price=offer.total_price,
        currency=offer.currency,
        checked_at=offer.checked_at,
        expires_at=offer.expires_at or "",
        last_ticketing_date=offer.last_ticketing_date,
        live_mode=offer.environment == "live",
        slices=offer.slices,
        total_duration_minutes=offer.total_duration_minutes,
        maximum_connections=max(0, offer.stops),
        protected_connection=offer.protected_connection,
        ticket_type=offer.ticket_type,
        connection_protection=offer.connection_protection,
        baggage_transfer=offer.baggage_transfer,
        separate_tickets=offer.separate_tickets,
        self_transfer=offer.self_transfer,
        bookable_in_rovvy=False,
        airlines=offer.marketing_airlines,
        carry_on_included=offer.baggage.carry_on_included,
        checked_bag_included=offer.baggage.checked_bag_included,
        refundable=offer.fare_conditions.refundable,
        changeable=offer.fare_conditions.changeable,
        recommendation_score=offer.recommendation_score,
        recommendation_reason=offer.recommendation_reason,
        departure_at=offer.departure_at,
        arrival_at=offer.arrival_at,
        origin=offer.origin,
        destination=offer.destination,
        duration_minutes=offer.total_duration_minutes,
        stops=offer.stops,
        deep_link=offer.redirect_url or "",
    )


def group_to_legacy_journey(group: RovvyItineraryGroup) -> FlightJourney:
    if not group.seller_options:
        raise ValueError("Itinerary group has no seller options")
    best_option = min(group.seller_options, key=lambda o: o.total_price)
    offer = RovvyFlightOffer(
        provider_id=best_option.provider_id,
        provider_offer_id=best_option.provider_offer_id,
        itinerary_key=group.itinerary_key,
        seller_id=best_option.seller_id,
        seller_name=best_option.seller_name,
        marketing_airlines=group.marketing_airlines,
        operating_airlines=group.operating_airlines,
        slices=group.slices,
        total_price=best_option.total_price,
        currency=best_option.currency,
        baggage=best_option.baggage,
        fare_conditions=best_option.fare_conditions,
        protected_connection=best_option.protected_connection,
        ticket_type=best_option.ticket_type,
        connection_protection=best_option.connection_protection,
        baggage_transfer=best_option.baggage_transfer,
        separate_tickets=best_option.separate_tickets,
        self_transfer=best_option.self_transfer,
        redirect_url=best_option.redirect_url,
        action_type=best_option.action_type,
        checked_at=best_option.checked_at,
        expires_at=best_option.expires_at,
        last_ticketing_date=best_option.last_ticketing_date,
        environment=best_option.environment,
        departure_at=group.departure_at,
        arrival_at=group.arrival_at,
        origin=group.origin,
        destination=group.destination,
        total_duration_minutes=group.total_duration_minutes,
        stops=group.stops,
        recommendation_score=group.recommendation_score,
        recommendation_reason=group.recommendation_reason,
    )
    return offer_to_legacy_journey(offer)
