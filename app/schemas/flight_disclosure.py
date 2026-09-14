"""Provider-neutral connection and ticketing disclosure enums."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TicketType = Literal["single_ticket", "separate_tickets", "unknown"]
ConnectionProtection = Literal["protected", "unprotected", "unknown"]
BaggageTransfer = Literal["automatic", "self_transfer", "unknown"]
YesNoUnknown = Literal["yes", "no", "unknown"]


class DisclosureSourceEvidence(BaseModel):
    """Tracks which provider field supported a normalized value."""

    model_config = ConfigDict(from_attributes=False)

    field: str
    raw_value: str | None = None


class FlightConnectionDisclosureFields(BaseModel):
    """Normalized disclosure fields for a single connection."""

    model_config = ConfigDict(from_attributes=False)

    ticket_type: TicketType = "unknown"
    connection_protection: ConnectionProtection = "unknown"
    baggage_transfer: BaggageTransfer = "unknown"
    airport_change_status: YesNoUnknown = "unknown"
    terminal_change_status: YesNoUnknown = "unknown"
    provider_disclosure_text: str | None = None
    baggage_recheck_required: YesNoUnknown = "unknown"
    source_provider: str | None = None
    source_offer_id: str | None = None
    source_fields: list[DisclosureSourceEvidence] = Field(default_factory=list)
    normalized_at: str | None = None


class FlightJourneyDisclosureFields(BaseModel):
    """Journey-level disclosure rollup."""

    model_config = ConfigDict(from_attributes=False)

    ticket_type: TicketType = "unknown"
    connection_protection: ConnectionProtection = "unknown"
    baggage_transfer: BaggageTransfer = "unknown"
    separate_tickets: bool | None = None
    self_transfer: bool | None = None


class AdaptiveSearchAttemptRecord(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    attempt_number: int
    maximum_connections: int
    date_offset: int | None = None
    departure_date: str | None = None
    offer_count: int = 0
    group_count: int = 0
    status: Literal["ok", "timeout", "error", "skipped"] = "ok"
    elapsed_ms: int | None = None


class FlightSearchMetadata(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    strict_connection_limit: bool = False
    adaptive_attempts: list[AdaptiveSearchAttemptRecord] = Field(default_factory=list)
    merged_offer_count: int = 0
    merged_group_count: int = 0
    requested_destinations: list[str] = Field(default_factory=list)


class RovvyOfferProvenance(BaseModel):
    """Admin-only normalization audit trail."""

    model_config = ConfigDict(from_attributes=False)

    provider_name: str
    provider_environment: Literal["test", "live"] | None = None
    provider_offer_id: str
    raw_itinerary_identifiers: list[str] = Field(default_factory=list)
    search_attempt_number: int = 1
    requested_maximum_connections: int = 1
    ticket_type_source: str | None = None
    protection_source: str | None = None
    baggage_transfer_source: str | None = None
    raw_provider_values: dict[str, str] = Field(default_factory=dict)
    normalized_values: dict[str, str] = Field(default_factory=dict)
    warnings_displayed: list[str] = Field(default_factory=list)
    missing_or_uncertain_fields: list[str] = Field(default_factory=list)
    offer_expires_at: str | None = None
    search_timestamp: str | None = None
    normalization_timestamp: str | None = None
    provider_error_status: str | None = None
