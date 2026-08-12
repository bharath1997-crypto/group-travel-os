import logging
import uuid
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingProvider, BookingStatus
from app.models.user import User
from app.schemas.flight_booking import (
    AssociateTripResponse,
    FlightBookRequest,
    FlightBookResponse,
    FlightCancelConfirmResponse,
    FlightCancelQuoteResponse,
    FlightOrderPassenger,
    FlightOrderResponse,
    FlightPassengerInput,
)
from app.services.duffel_client import (
    confirm_cancellation,
    create_cancellation_quote,
    create_order,
    get_offer,
    get_order,
)
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)


def _booking_reference(order: dict[str, Any]) -> str:
    refs = order.get("booking_references") or []
    if isinstance(refs, list) and refs:
        first = refs[0]
        if isinstance(first, dict):
            ref = str(first.get("booking_reference") or "").strip()
            if ref:
                return ref
    return str(order.get("booking_reference") or "").strip()


class FlightBookingService:
    @staticmethod
    def book_offer(data: FlightBookRequest) -> FlightBookResponse:
        api_key = (settings.duffel_api_key or "").strip()
        if not api_key:
            AppException.service_unavailable("Flight booking is not configured")

        offer_id = data.offer_id.strip()
        if not offer_id.startswith("off_"):
            AppException.bad_request("Invalid flight offer id")

        try:
            offer = get_offer(offer_id)
        except httpx.HTTPStatusError as exc:
            logger.warning("Duffel offer fetch failed for booking: %s", exc)
            AppException.bad_request("This flight offer expired — search again")
        except Exception as exc:
            logger.warning("Duffel offer fetch error: %s", exc)
            AppException.bad_request("Could not load flight offer")

        offer_passengers = offer.get("passengers") or []
        if not isinstance(offer_passengers, list) or not offer_passengers:
            AppException.bad_request("Offer has no passenger slots")

        if len(data.passengers) != len(offer_passengers):
            AppException.bad_request(
                f"Provide details for {len(offer_passengers)} passenger(s)",
            )

        duffel_passengers: list[dict[str, Any]] = []
        for idx, slot in enumerate(offer_passengers):
            if not isinstance(slot, dict):
                continue
            inp: FlightPassengerInput = data.passengers[idx]
            duffel_passengers.append(
                {
                    "id": slot.get("id"),
                    "type": slot.get("type") or "adult",
                    "given_name": inp.given_name.strip(),
                    "family_name": inp.family_name.strip(),
                    "email": str(inp.email),
                    "phone_number": inp.phone_number.strip(),
                    "born_on": inp.born_on,
                    "title": inp.title,
                    "gender": inp.gender,
                }
            )

        amount = str(offer.get("total_amount") or "")
        currency = str(offer.get("total_currency") or "USD").upper()
        if not amount:
            AppException.bad_request("Offer price unavailable — search again")

        try:
            order = create_order(
                offer_id=offer_id,
                passengers=duffel_passengers,
                amount=amount,
                currency=currency,
            )
        except httpx.HTTPStatusError as exc:
            logger.warning("Duffel order failed: %s", exc.response.text[:300])
            AppException.bad_request("Booking failed — offer may have expired. Search again.")
        except Exception as exc:
            logger.warning("Duffel order error: %s", exc)
            AppException.bad_request("Booking failed")

        ref = _booking_reference(order)
        if not ref:
            ref = str(order.get("id") or "")

        return FlightBookResponse(
            order_id=str(order.get("id") or ""),
            booking_reference=ref,
            total_amount=float(order.get("total_amount") or amount),
            currency=str(order.get("total_currency") or currency).upper(),
            live_mode=bool(order.get("live_mode")),
            message=(
                "Test booking confirmed in Rovvy."
                if not order.get("live_mode")
                else "Booking confirmed in Rovvy."
            ),
        )

    @staticmethod
    def get_order_detail(order_id: str) -> FlightOrderResponse:
        api_key = (settings.duffel_api_key or "").strip()
        if not api_key:
            AppException.service_unavailable("Flight booking is not configured")

        oid = order_id.strip()
        if not oid.startswith("ord_"):
            AppException.bad_request("Invalid flight order id")

        try:
            order = get_order(oid)
        except httpx.HTTPStatusError as exc:
            logger.warning("Duffel order lookup failed: %s", exc)
            AppException.not_found("Flight booking order not found")
        except Exception as exc:
            logger.warning("Duffel order lookup error: %s", exc)
            AppException.bad_request("Could not load flight booking status")

        pax_list: list[FlightOrderPassenger] = []
        for p in order.get("passengers") or []:
            if isinstance(p, dict):
                ticket_num = ""
                documents = p.get("documents") or []
                if isinstance(documents, list) and documents:
                    doc = documents[0]
                    if isinstance(doc, dict):
                        ticket_num = str(doc.get("unique_identifier") or "")
                pax_list.append(
                    FlightOrderPassenger(
                        id=str(p.get("id") or ""),
                        type=str(p.get("type") or "adult"),
                        given_name=str(p.get("given_name") or ""),
                        family_name=str(p.get("family_name") or ""),
                        email=str(p.get("email") or ""),
                        ticket_number=ticket_num,
                    )
                )

        actions = order.get("available_actions") or []
        available_actions = [str(a) for a in actions] if isinstance(actions, list) else []

        status_str = "cancelled" if order.get("cancelled_at") else "confirmed"

        return FlightOrderResponse(
            id=str(order.get("id") or oid),
            booking_reference=_booking_reference(order) or oid,
            status=status_str,
            total_amount=float(order.get("total_amount") or 0.0),
            currency=str(order.get("total_currency") or "USD").upper(),
            slices=order.get("slices") if isinstance(order.get("slices"), list) else [],
            passengers=pax_list,
            available_actions=available_actions,
            live_mode=bool(order.get("live_mode")),
            created_at=str(order.get("created_at") or ""),
        )

    @staticmethod
    def cancel_quote(order_id: str) -> FlightCancelQuoteResponse:
        api_key = (settings.duffel_api_key or "").strip()
        if not api_key:
            AppException.service_unavailable("Flight booking is not configured")

        oid = order_id.strip()
        if not oid.startswith("ord_"):
            AppException.bad_request("Invalid flight order id")

        try:
            quote = create_cancellation_quote(oid)
        except httpx.HTTPStatusError as exc:
            logger.warning("Duffel cancellation quote failed: %s", exc)
            AppException.bad_request("This order cannot be cancelled online via API.")
        except Exception as exc:
            logger.warning("Duffel cancellation quote error: %s", exc)
            AppException.bad_request("Failed to create cancellation quote")

        return FlightCancelQuoteResponse(
            cancellation_id=str(quote.get("id") or ""),
            order_id=str(quote.get("order_id") or oid),
            refund_amount=float(quote.get("refund_amount") or 0.0),
            currency=str(quote.get("refund_currency") or "USD").upper(),
            expires_at=str(quote.get("expires_at") or ""),
            message="Cancellation quote generated. Confirm to complete cancellation.",
        )

    @staticmethod
    def confirm_cancel(order_id: str, cancellation_id: str) -> FlightCancelConfirmResponse:
        api_key = (settings.duffel_api_key or "").strip()
        if not api_key:
            AppException.service_unavailable("Flight booking is not configured")

        cid = cancellation_id.strip()
        if not cid.startswith("noc_"):
            AppException.bad_request("Invalid cancellation id")

        try:
            result = confirm_cancellation(cid)
        except httpx.HTTPStatusError as exc:
            logger.warning("Duffel confirm cancellation failed: %s", exc)
            AppException.bad_request("Cancellation confirmation failed or quote expired.")
        except Exception as exc:
            logger.warning("Duffel confirm cancellation error: %s", exc)
            AppException.bad_request("Could not confirm cancellation")

        return FlightCancelConfirmResponse(
            cancellation_id=str(result.get("id") or cid),
            order_id=str(result.get("order_id") or order_id),
            status="confirmed",
            refund_amount=float(result.get("refund_amount") or 0.0),
            currency=str(result.get("refund_currency") or "USD").upper(),
            message="Order successfully cancelled.",
        )

    @staticmethod
    def associate_trip_space(
        db: Session,
        order_id: str,
        trip_id_str: str,
        current_user: User,
    ) -> AssociateTripResponse:
        try:
            trip_id = uuid.UUID(trip_id_str)
        except ValueError:
            AppException.bad_request("Invalid trip_id UUID format")

        # Check existing booking record (SQLAlchemy 2.0 select)
        stmt = select(Booking).where(
            Booking.provider_reference == order_id,
            Booking.trip_id == trip_id,
        )
        existing = db.execute(stmt).scalar_one_or_none()
        if existing:
            return AssociateTripResponse(
                booking_id=str(existing.id),
                trip_id=str(trip_id),
                status="existing",
                message="Booking is already associated with this Trip Space.",
            )

        # Get details of the order to record amount and currency
        order_detail = FlightBookingService.get_order_detail(order_id)

        booking = Booking(
            trip_id=trip_id,
            created_by=current_user.id,
            provider=BookingProvider.duffel,
            provider_reference=order_id,
            status=BookingStatus.confirmed,
            booking_url=f"/flights/booking/{order_id}/confirmation",
            amount=order_detail.total_amount,
            currency=order_detail.currency,
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)

        return AssociateTripResponse(
            booking_id=str(booking.id),
            trip_id=str(trip_id),
            status="created",
            message="Flight booking attached to your Trip Space timeline.",
        )

