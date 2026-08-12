"""Authenticated flight meta-search (Kiwi Tequila + Travelpayouts)."""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.flight import FlightResult
from app.schemas.flight_journey import FlightJourneySearchResponse, FlightSearchRequest
from app.schemas.flight_booking import (
    AssociateTripRequest,
    AssociateTripResponse,
    FlightBookRequest,
    FlightBookResponse,
    FlightCancelConfirmResponse,
    FlightCancelQuoteResponse,
    FlightOrderResponse,
)
from app.schemas.flight_offer import FlightOfferDetail, FlightOfferPriceResponse
from app.schemas.flight_places import (
    FlightCityItem,
    FlightCountryItem,
    FlightNearbyAirportsResponse,
    FlightPlaceSuggestion,
    FlightRegionItem,
)
from app.services.flight_booking_service import FlightBookingService
from app.services.flight_offer_service import FlightOfferService
from app.services.flight_places_service import FlightPlacesService
from app.services.flight_journey_service import FlightJourneyService
from app.services.flight_service import FlightService
from app.utils.auth import get_current_user, get_current_user_optional
from app.utils.database import get_db
from app.utils.exceptions import AppException

router = APIRouter(prefix="/flights", tags=["flights"])


@router.get(
    "/places",
    response_model=list[FlightPlaceSuggestion],
    summary="Airport/city autocomplete (Google Flights-style lookup)",
)
def flight_places(
    q: str = Query("", max_length=120),
    limit: int = Query(12, ge=1, le=20),
) -> list[FlightPlaceSuggestion]:
    return FlightPlacesService.suggest(q, limit=limit)


@router.get(
    "/places/validate",
    summary="Validate a three-letter IATA airport or city code",
)
def validate_flight_place(
    iata: str = Query(..., min_length=3, max_length=3),
) -> dict[str, bool]:
    return {"valid": FlightPlacesService.validate_iata(iata)}


@router.get(
    "/airports/nearby",
    response_model=FlightNearbyAirportsResponse,
    summary="Airports near coordinates (sorted by distance)",
)
def nearby_airports(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    limit: int = Query(12, ge=1, le=20),
) -> FlightNearbyAirportsResponse:
    return FlightPlacesService.nearby(lat, lng, limit=limit)


@router.get(
    "/airports/countries",
    response_model=list[FlightCountryItem],
    summary="Browse airports by country",
)
def airport_countries() -> list[FlightCountryItem]:
    return FlightPlacesService.list_countries()


@router.get(
    "/airports/regions",
    response_model=list[FlightRegionItem],
    summary="Browse airport regions/states within a country",
)
def airport_regions(
    country: str = Query(..., min_length=2, max_length=2),
) -> list[FlightRegionItem]:
    return FlightPlacesService.list_regions(country)


@router.get(
    "/airports/cities",
    response_model=list[FlightCityItem],
    summary="Browse airport cities within a country or region",
)
def airport_cities(
    country: str = Query(..., min_length=2, max_length=2),
    region: str | None = Query(None, max_length=8),
) -> list[FlightCityItem]:
    return FlightPlacesService.list_cities(country, region)


@router.get(
    "/airports",
    response_model=list[FlightPlaceSuggestion],
    summary="List airports for a country, region, or city",
)
def airport_list(
    country: str = Query(..., min_length=2, max_length=2),
    region: str | None = Query(None, max_length=8),
    city: str | None = Query(None, max_length=120),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    limit: int = Query(50, ge=1, le=100),
) -> list[FlightPlaceSuggestion]:
    return FlightPlacesService.list_airports(
        country,
        region=region,
        city=city,
        limit=limit,
        lat=lat,
        lng=lng,
    )



@router.post(
    "/search",
    response_model=FlightJourneySearchResponse,
    summary="Search complete Duffel flight journeys (production-safe)",
)
def search_flights_post(
    body: FlightSearchRequest,
    _: User | None = Depends(get_current_user_optional),
) -> FlightJourneySearchResponse:
    return FlightJourneyService.search(body)


@router.get("/search", response_model=list[FlightResult], summary="Search flights (legacy GET)")
def search_flights(
    fly_from: str = Query(..., min_length=2, description="Origin airport / city code"),
    fly_to: str = Query(..., min_length=2, description="Destination airport / city code"),
    date_from: date = Query(..., description="Outbound search start"),
    date_to: date = Query(..., description="Outbound search end"),
    adults: int = Query(1, ge=1, le=9),
    children: int = Query(0, ge=0, le=8),
    infants: int = Query(0, ge=0, le=4),
    currency: str = Query("USD", min_length=3, max_length=3),
    cabins: str = Query("M", min_length=1, max_length=1),
    return_from: date | None = Query(None, description="Return leg start (round trip)"),
    return_to: date | None = Query(None, description="Return leg end (round trip)"),
    _: User | None = Depends(get_current_user_optional),
):
    rf = return_from
    rt = return_to
    if (rf is None) ^ (rt is None):
        AppException.unprocessable(
            "Provide both return_from and return_to, or omit return dates",
        )
    if adults + children + infants > 9:
        AppException.bad_request("Maximum 9 travelers per search")
    return FlightService.search_flights(
        fly_from=fly_from,
        fly_to=fly_to,
        date_from=date_from,
        date_to=date_to,
        adults=adults,
        children=children,
        infants=infants,
        currency=currency.upper(),
        cabins=cabins.upper(),
        return_from=rf,
        return_to=rt,
    )


@router.get(
    "/offers/{offer_id}",
    response_model=FlightOfferDetail,
    summary="Flight offer detail (segments, baggage, fare rules)",
)
def get_flight_offer(
    offer_id: str,
    _: User | None = Depends(get_current_user_optional),
) -> FlightOfferDetail:
    return FlightOfferService.get_offer_detail(offer_id)


@router.post(
    "/offers/{offer_id}/price",
    response_model=FlightOfferPriceResponse,
    summary="Reprice offer before checkout (mandatory production step)",
)
def reprice_flight_offer(
    offer_id: str,
    previous_price: float | None = Query(None, ge=0),
    _: User = Depends(get_current_user),
) -> FlightOfferPriceResponse:
    return FlightOfferService.reprice_offer(offer_id, previous_price=previous_price)


@router.get(
    "/offers/{offer_id}/seatmaps",
    response_model=list[dict[str, Any]],
    summary="Fetch seat maps for a Duffel offer",
)
def get_offer_seatmaps(
    offer_id: str,
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return FlightOfferService.get_seat_maps(offer_id)


@router.post(
    "/book",
    response_model=FlightBookResponse,
    summary="Book a selected Duffel offer inside Rovvy",
)
def book_flight(
    body: FlightBookRequest,
    _: User = Depends(get_current_user),
) -> FlightBookResponse:
    return FlightBookingService.book_offer(body)


@router.get(
    "/orders/{order_id}",
    response_model=FlightOrderResponse,
    summary="Retrieve Duffel flight order status and itinerary",
)
def get_flight_order(
    order_id: str,
    _: User = Depends(get_current_user),
) -> FlightOrderResponse:
    return FlightBookingService.get_order_detail(order_id)


@router.post(
    "/orders/{order_id}/cancel-quote",
    response_model=FlightCancelQuoteResponse,
    summary="Generate cancellation quote for an order",
)
def cancel_quote_order(
    order_id: str,
    _: User = Depends(get_current_user),
) -> FlightCancelQuoteResponse:
    return FlightBookingService.cancel_quote(order_id)


@router.post(
    "/orders/{order_id}/cancel-confirm",
    response_model=FlightCancelConfirmResponse,
    summary="Confirm cancellation of an order using cancellation quote ID",
)
def confirm_cancel_order(
    order_id: str,
    cancellation_id: str = Query(..., min_length=4),
    _: User = Depends(get_current_user),
) -> FlightCancelConfirmResponse:
    return FlightBookingService.confirm_cancel(order_id, cancellation_id)


@router.post(
    "/orders/{order_id}/associate-trip",
    response_model=AssociateTripResponse,
    summary="Attach confirmed flight booking to a Rovvy Trip Space",
)
def associate_trip_space(
    order_id: str,
    body: AssociateTripRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssociateTripResponse:
    return FlightBookingService.associate_trip_space(
        db=db,
        order_id=order_id,
        trip_id_str=body.trip_id,
        current_user=current_user,
    )

