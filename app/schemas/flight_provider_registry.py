"""Safe provider-registry models for flight metasearch."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.flight_metasearch import ProviderEnvironment, ProviderHealth

ProviderCategory = Literal["distribution", "direct_airline", "regional", "other"]


class FlightProviderCapabilities(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    search: bool = True
    refresh_offer: bool = False
    external_redirect: bool = False
    multi_city: bool = False
    flexible_dates: bool = False
    baggage: bool = False
    fare_conditions: bool = False
    connection_disclosures: bool = False
    search_only: bool = True


class FlightProviderRegistryRecord(BaseModel):
    """Secret-free provider readiness and runtime health."""

    model_config = ConfigDict(from_attributes=False)

    provider_id: str
    display_name: str
    category: ProviderCategory
    enabled: bool
    configured: bool
    status: ProviderHealth
    environment: ProviderEnvironment | None = None
    capabilities: FlightProviderCapabilities
    message: str | None = None
    last_checked_at: str | None = None
    last_search_at: str | None = None
    last_latency_ms: int | None = None
    consecutive_failures: int = 0

