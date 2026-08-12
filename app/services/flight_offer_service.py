"""Fetch and reprice Duffel offers for checkout."""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from app.schemas.flight_offer import (
    FlightOfferDetail,
    FlightOfferPriceResponse,
    FlightSegmentDetail,
    FlightSliceDetail,
)
from app.services.duffel_client import get_offer, get_seat_maps as fetch_duffel_seat_maps
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)



def _parse_iso_duration_to_minutes(duration_str: str | None) -> int:
    if not duration_str:
        return 0
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", duration_str)
    if not match:
        return 0
    hours = int(match.group(1)) if match.group(1) else 0
    minutes = int(match.group(2)) if match.group(2) else 0
    return hours * 60 + minutes


def _bag_included(offer: dict[str, Any], bag_type: str) -> bool | None:
    for passenger in offer.get("passengers") or []:
        if not isinstance(passenger, dict):
            continue
        for bag in passenger.get("baggages") or []:
            if isinstance(bag, dict) and bag.get("type") == bag_type:
                return True
    slices = offer.get("slices") or []
    for sl in slices:
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


def _parse_segment(seg: dict[str, Any]) -> FlightSegmentDetail | None:
    if not isinstance(seg, dict):
        return None
    carrier = seg.get("marketing_carrier") or {}
    origin = seg.get("origin") or {}
    dest = seg.get("destination") or {}
    origin_code = str(origin.get("iata_code") or "")
    dest_code = str(dest.get("iata_code") or "")
    if not origin_code or not dest_code:
        return None
    airline_code = str(carrier.get("iata_code") or "").upper()
    flight_num = str(seg.get("marketing_carrier_flight_number") or "")
    return FlightSegmentDetail(
        origin=origin_code,
        origin_name=str(origin.get("name") or origin.get("city_name") or ""),
        destination=dest_code,
        destination_name=str(dest.get("name") or dest.get("city_name") or ""),
        departure_at=str(seg.get("departing_at") or ""),
        arrival_at=str(seg.get("arriving_at") or ""),
        duration_minutes=_parse_iso_duration_to_minutes(str(seg.get("duration") or "")),
        airline_code=airline_code,
        airline_name=str(carrier.get("name") or ""),
        flight_number=f"{airline_code}{flight_num}" if airline_code and flight_num else flight_num,
        aircraft=str((seg.get("aircraft") or {}).get("name") or ""),
        origin_terminal=str(origin.get("terminal") or ""),
        destination_terminal=str(dest.get("terminal") or ""),
    )


def _parse_slice(sl: dict[str, Any]) -> FlightSliceDetail | None:
    if not isinstance(sl, dict):
        return None
    segments_raw = sl.get("segments") or []
    segments: list[FlightSegmentDetail] = []
    for seg in segments_raw:
        parsed = _parse_segment(seg if isinstance(seg, dict) else {})
        if parsed:
            segments.append(parsed)
    if not segments:
        return None
    origin_obj = sl.get("origin") or {}
    dest_obj = sl.get("destination") or {}
    return FlightSliceDetail(
        origin=str(origin_obj.get("iata_code") or segments[0].origin),
        destination=str(dest_obj.get("iata_code") or segments[-1].destination),
        duration_minutes=_parse_iso_duration_to_minutes(str(sl.get("duration") or "")),
        stops=max(0, len(segments) - 1),
        segments=segments,
    )


def parse_duffel_offer_detail(offer: dict[str, Any]) -> FlightOfferDetail:
    rid = str(offer.get("id") or "")
    price_str = offer.get("total_amount")
    if not rid or not price_str:
        raise ValueError("Invalid Duffel offer shape")

    slices_raw = offer.get("slices") or []
    slices: list[FlightSliceDetail] = []
    airlines: list[str] = []
    for sl in slices_raw:
        parsed = _parse_slice(sl if isinstance(sl, dict) else {})
        if parsed:
            slices.append(parsed)
            for seg in parsed.segments:
                if seg.airline_code and seg.airline_code not in airlines:
                    airlines.append(seg.airline_code)

    if not slices:
        raise ValueError("Offer has no slices")

    outbound = slices[0]
    first_seg = outbound.segments[0]
    last_seg = outbound.segments[-1]

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

    owner = offer.get("owner") or {}
    fare_brand = str(owner.get("name") or offer.get("fare_brand_name") or "")

    return FlightOfferDetail(
        id=rid,
        price=float(price_str),
        currency=str(offer.get("total_currency") or "USD").upper(),
        airlines=airlines,
        departure_at=first_seg.departure_at,
        arrival_at=last_seg.arrival_at,
        origin=outbound.origin,
        destination=outbound.destination,
        duration_minutes=outbound.duration_minutes,
        stops=outbound.stops,
        slices=slices,
        cabin_class=str(offer.get("cabin_class") or "economy"),
        fare_brand=fare_brand,
        expires_at=str(offer.get("expires_at") or ""),
        live_mode=bool(offer.get("live_mode")),
        carry_on_included=_bag_included(offer, "carry_on"),
        checked_bag_included=_bag_included(offer, "checked"),
        refundable=refundable,
        changeable=changeable,
    )


class FlightOfferService:
    @staticmethod
    def _require_duffel() -> None:
        if not (settings.duffel_api_key or "").strip():
            AppException.service_unavailable("Flight offers are not configured")

    @staticmethod
    def get_offer_detail(offer_id: str) -> FlightOfferDetail:
        FlightOfferService._require_duffel()
        oid = offer_id.strip()
        if not oid.startswith("off_"):
            AppException.bad_request("Invalid flight offer id")
        try:
            offer = get_offer(oid)
        except httpx.HTTPStatusError:
            AppException.bad_request("This flight offer expired — search again")
        except Exception as exc:
            logger.warning("Duffel offer detail error: %s", exc)
            AppException.bad_request("Could not load flight offer")
        try:
            return parse_duffel_offer_detail(offer)
        except ValueError as exc:
            AppException.bad_request(str(exc))

    @staticmethod
    def reprice_offer(
        offer_id: str,
        *,
        previous_price: float | None = None,
    ) -> FlightOfferPriceResponse:
        detail = FlightOfferService.get_offer_detail(offer_id)
        current = detail.price
        changed = previous_price is not None and abs(current - previous_price) > 0.009
        increased = changed and previous_price is not None and current > previous_price
        message = "Price confirmed."
        if changed and previous_price is not None:
            message = (
                f"The fare changed from {previous_price:.2f} to {current:.2f} {detail.currency}."
            )
        return FlightOfferPriceResponse(
            offer_id=detail.id,
            previous_price=previous_price,
            current_price=current,
            currency=detail.currency,
            price_changed=changed,
            price_increased=increased,
            expires_at=detail.expires_at,
            live_mode=detail.live_mode,
            message=message,
        )

    @staticmethod
    def get_seat_maps(offer_id: str) -> list[dict[str, Any]]:
        FlightOfferService._require_duffel()
        oid = offer_id.strip()
        if not oid.startswith("off_"):
            AppException.bad_request("Invalid flight offer id")
        try:
            return fetch_duffel_seat_maps(oid)
        except Exception as exc:
            logger.warning("Failed to fetch seat maps for offer %s: %s", oid, exc)
            return []

