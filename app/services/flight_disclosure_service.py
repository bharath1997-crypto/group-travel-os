"""Normalize provider connection/ticketing disclosures without unsafe inference."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.schemas.flight_disclosure import (
    BaggageTransfer,
    ConnectionProtection,
    DisclosureSourceEvidence,
    FlightConnectionDisclosureFields,
    FlightJourneyDisclosureFields,
    RovvyOfferProvenance,
    TicketType,
    YesNoUnknown,
)
from app.schemas.flight_journey import FlightConnectionDetail, FlightJourney, FlightJourneySlice


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def bool_to_yes_no_unknown(value: bool | None) -> YesNoUnknown:
    if value is True:
        return "yes"
    if value is False:
        return "no"
    return "unknown"


import re

def _extract_duffel_warning_signals(offer: dict[str, Any]) -> dict[str, str]:
    signals: dict[str, str] = {}
    for warning in offer.get("warnings") or []:
        if not isinstance(warning, dict):
            continue
        code = str(warning.get("code") or warning.get("type") or "").lower()
        message = str(warning.get("message") or warning.get("title") or "")
        combined = f"{code} {message}".lower()
        if "self_transfer" in code or "self transfer" in combined or "self-transfer" in combined:
            signals["baggage_transfer"] = "self_transfer"
        if "separate_ticket" in code or "separate ticket" in combined:
            signals["ticket_type"] = "separate_tickets"
        # Check negative protection signals before positive
        if "unprotected" in combined or "not protected" in combined or "not_protected" in combined:
            signals["connection_protection"] = "unprotected"
        elif "protected" in combined:
            signals["connection_protection"] = "protected"
        if message:
            signals.setdefault("disclosure_text", message)
    return signals


def _map_explicit_value(
    raw: Any,
    mapping: dict[str, str],
    *,
    field_name: str,
) -> tuple[str | None, DisclosureSourceEvidence | None]:
    if raw is None:
        return None, None
    text = str(raw).strip().lower()
    if not text:
        return None, None
    clean = re.sub(r"[^a-z0-9]", "", text)

    if field_name == "connection_protection":
        if any(neg in clean for neg in ("unprotected", "notprotected", "noprotected", "false")):
            return "unprotected", DisclosureSourceEvidence(field=field_name, raw_value=str(raw))
        if any(pos in clean for pos in ("protected", "true", "yes")):
            return "protected", DisclosureSourceEvidence(field=field_name, raw_value=str(raw))
        return None, None

    norm = re.sub(r"[\s\-_]+", "_", text)
    for key, value in mapping.items():
        if norm == re.sub(r"[\s\-_]+", "_", key.lower()):
            return value, DisclosureSourceEvidence(field=field_name, raw_value=str(raw))
    sorted_items = sorted(mapping.items(), key=lambda item: len(item[0]), reverse=True)
    for key, value in sorted_items:
        norm_key = re.sub(r"[\s\-_]+", "_", key.lower())
        if norm_key in norm or key.lower() in text:
            return value, DisclosureSourceEvidence(field=field_name, raw_value=str(raw))
    return None, None


def normalize_connection_disclosure(
    *,
    connection: FlightConnectionDetail,
    offer: dict[str, Any],
    provider: str,
    offer_id: str,
    checked_at: str,
    warning_signals: dict[str, str],
) -> FlightConnectionDetail:
    airport_status = bool_to_yes_no_unknown(connection.airport_change)
    terminal_status = bool_to_yes_no_unknown(connection.terminal_change)

    ticket_type: TicketType = "unknown"
    protection: ConnectionProtection = "unknown"
    baggage: BaggageTransfer = "unknown"
    recheck: YesNoUnknown = "unknown"
    disclosure_text = warning_signals.get("disclosure_text")
    sources: list[DisclosureSourceEvidence] = []

    if warning_signals.get("ticket_type") == "separate_tickets":
        ticket_type = "separate_tickets"
        sources.append(DisclosureSourceEvidence(field="warnings", raw_value="separate_tickets"))
    if warning_signals.get("connection_protection") == "unprotected":
        protection = "unprotected"
        sources.append(DisclosureSourceEvidence(field="warnings", raw_value="unprotected"))
    elif warning_signals.get("connection_protection") == "protected":
        protection = "protected"
        sources.append(DisclosureSourceEvidence(field="warnings", raw_value="protected"))
    if warning_signals.get("baggage_transfer") == "self_transfer":
        baggage = "self_transfer"
        recheck = "yes"
        sources.append(DisclosureSourceEvidence(field="warnings", raw_value="self_transfer"))

    # Only use explicit Duffel fields when present — never infer from same airline / single offer.
    explicit_ticket, ticket_evidence = _map_explicit_value(
        offer.get("ticket_type") or offer.get("fare_type"),
        {
            "single_ticket": "single_ticket",
            "single": "single_ticket",
            "through": "single_ticket",
            "separate_tickets": "separate_tickets",
            "separate_ticket": "separate_tickets",
            "separate": "separate_tickets",
        },
        field_name="ticket_type",
    )
    if explicit_ticket == "single_ticket":
        ticket_type = "single_ticket"
        if ticket_evidence:
            sources.append(ticket_evidence)
    elif explicit_ticket == "separate_tickets":
        ticket_type = "separate_tickets"
        if ticket_evidence:
            sources.append(ticket_evidence)

    explicit_protection, protection_evidence = _map_explicit_value(
        offer.get("connection_protection") or offer.get("protected_connection"),
        {
            "unprotected": "unprotected",
            "not_protected": "unprotected",
            "not protected": "unprotected",
            "protected": "protected",
        },
        field_name="connection_protection",
    )
    if explicit_protection == "unprotected":
        protection = "unprotected"
        if protection_evidence:
            sources.append(protection_evidence)
    elif explicit_protection == "protected":
        protection = "protected"
        if protection_evidence:
            sources.append(protection_evidence)

    explicit_baggage, baggage_evidence = _map_explicit_value(
        offer.get("baggage_transfer") or offer.get("through_baggage"),
        {
            "automatic": "automatic",
            "through": "automatic",
            "self": "self_transfer",
            "recheck": "self_transfer",
        },
        field_name="baggage_transfer",
    )
    if explicit_baggage == "automatic":
        baggage = "automatic"
        if baggage_evidence:
            sources.append(baggage_evidence)
    elif explicit_baggage == "self_transfer":
        baggage = "self_transfer"
        recheck = "yes"
        if baggage_evidence:
            sources.append(baggage_evidence)

    return connection.model_copy(
        update={
            "ticket_type": ticket_type,
            "connection_protection": protection,
            "baggage_transfer": baggage,
            "airport_change_status": airport_status,
            "terminal_change_status": terminal_status,
            "provider_disclosure_text": disclosure_text,
            "baggage_recheck_required": recheck,
            "source_provider": provider,
            "source_offer_id": offer_id,
            "normalized_at": checked_at,
            "protected": True if protection == "protected" else False if protection == "unprotected" else None,
        }
    )


def rollup_journey_disclosures(journey: FlightJourney) -> FlightJourneyDisclosureFields:
    ticket: TicketType = "unknown"
    protection: ConnectionProtection = "unknown"
    baggage: BaggageTransfer = "unknown"

    conn_tickets: list[TicketType] = []
    conn_protections: list[ConnectionProtection] = []
    conn_baggage: list[BaggageTransfer] = []

    for sl in journey.slices:
        for conn in sl.connections:
            conn_tickets.append(conn.ticket_type)
            conn_protections.append(conn.connection_protection)
            conn_baggage.append(conn.baggage_transfer)

    if "separate_tickets" in conn_tickets:
        ticket = "separate_tickets"
    elif conn_tickets and all(t == "single_ticket" for t in conn_tickets):
        ticket = "single_ticket"

    if "unprotected" in conn_protections:
        protection = "unprotected"
    elif conn_protections and all(p == "protected" for p in conn_protections):
        protection = "protected"

    if "self_transfer" in conn_baggage:
        baggage = "self_transfer"
    elif conn_baggage and all(b == "automatic" for b in conn_baggage):
        baggage = "automatic"

    separate_tickets: bool | None = None
    if ticket == "separate_tickets":
        separate_tickets = True
    elif ticket == "single_ticket":
        separate_tickets = False

    self_transfer: bool | None = None
    if baggage == "self_transfer":
        self_transfer = True
    elif baggage == "automatic":
        self_transfer = False

    return FlightJourneyDisclosureFields(
        ticket_type=ticket,
        connection_protection=protection,
        baggage_transfer=baggage,
        separate_tickets=separate_tickets,
        self_transfer=self_transfer,
    )


def apply_disclosures_to_journey(
    journey: FlightJourney,
    offer: dict[str, Any],
    *,
    checked_at: str | None = None,
) -> FlightJourney:
    ts = checked_at or _utc_now_iso()
    warning_signals = _extract_duffel_warning_signals(offer)
    updated_slices: list[FlightJourneySlice] = []

    for sl in journey.slices:
        updated_connections = [
            normalize_connection_disclosure(
                connection=conn,
                offer=offer,
                provider=journey.provider,
                offer_id=journey.provider_offer_id,
                checked_at=ts,
                warning_signals=warning_signals,
            )
            for conn in sl.connections
        ]
        updated_slices.append(sl.model_copy(update={"connections": updated_connections}))

    updated = journey.model_copy(update={"slices": updated_slices})
    rollup = rollup_journey_disclosures(updated)
    return updated.model_copy(
        update={
            "ticket_type": rollup.ticket_type,
            "connection_protection": rollup.connection_protection,
            "baggage_transfer": rollup.baggage_transfer,
            "separate_tickets": rollup.separate_tickets,
            "self_transfer": rollup.self_transfer,
            "protected_connection": (
                True
                if rollup.connection_protection == "protected"
                else False
                if rollup.connection_protection == "unprotected"
                else None
            ),
        }
    )


def build_offer_provenance(
    journey: FlightJourney,
    offer: dict[str, Any],
    *,
    search_attempt_number: int,
    requested_maximum_connections: int,
    search_timestamp: str,
    provider_error_status: str | None = None,
) -> RovvyOfferProvenance:
    missing: list[str] = []
    if journey.ticket_type == "unknown":
        missing.append("ticket_type")
    if journey.connection_protection == "unknown":
        missing.append("connection_protection")
    if journey.baggage_transfer == "unknown":
        missing.append("baggage_transfer")

    warnings: list[str] = []
    if journey.baggage_transfer == "self_transfer":
        warnings.append("self_transfer_required")
    if journey.connection_protection == "unknown" and journey.stops > 0:
        warnings.append("connection_protection_not_confirmed")
    if journey.baggage_transfer == "unknown" and journey.stops > 0:
        warnings.append("baggage_transfer_not_confirmed")

    raw_values: dict[str, str] = {}
    for key in ("ticket_type", "fare_type", "connection_protection", "baggage_transfer", "through_baggage"):
        if offer.get(key) is not None:
            raw_values[key] = str(offer.get(key))

    warning_codes = []
    for warning in offer.get("warnings") or []:
        if isinstance(warning, dict):
            warning_codes.append(str(warning.get("code") or warning.get("type") or ""))
    if warning_codes:
        raw_values["warnings"] = ",".join(w for w in warning_codes if w)

    segment_ids: list[str] = []
    for sl in offer.get("slices") or []:
        if not isinstance(sl, dict):
            continue
        for seg in sl.get("segments") or []:
            if isinstance(seg, dict) and seg.get("id"):
                segment_ids.append(str(seg["id"]))

    return RovvyOfferProvenance(
        provider_name=journey.provider,
        provider_environment="live" if journey.live_mode else "test",
        provider_offer_id=journey.provider_offer_id,
        raw_itinerary_identifiers=segment_ids,
        search_attempt_number=search_attempt_number,
        requested_maximum_connections=requested_maximum_connections,
        ticket_type_source="warnings" if "separate_tickets" in raw_values.get("warnings", "") else None,
        protection_source="warnings" if any("protect" in w.lower() for w in warning_codes) else None,
        baggage_transfer_source="warnings" if any("self" in w.lower() for w in warning_codes) else None,
        raw_provider_values=raw_values,
        normalized_values={
            "ticket_type": journey.ticket_type,
            "connection_protection": journey.connection_protection,
            "baggage_transfer": journey.baggage_transfer,
        },
        warnings_displayed=warnings,
        missing_or_uncertain_fields=missing,
        offer_expires_at=journey.expires_at or None,
        search_timestamp=search_timestamp,
        normalization_timestamp=journey.slices[0].connections[0].normalized_at
        if journey.slices and journey.slices[0].connections
        else search_timestamp,
        provider_error_status=provider_error_status,
    )


# Admin-only in-memory provenance store (never returned in public search responses).
_provenance_store: dict[str, RovvyOfferProvenance] = {}


def store_offer_provenance(provenance: RovvyOfferProvenance) -> None:
    _provenance_store[provenance.provider_offer_id] = provenance


def get_offer_provenance(provider_offer_id: str) -> RovvyOfferProvenance | None:
    return _provenance_store.get(provider_offer_id)


def clear_provenance_store() -> None:
    _provenance_store.clear()
