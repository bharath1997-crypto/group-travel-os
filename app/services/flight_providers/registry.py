"""Flight-provider registration, configuration, capabilities, and health."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Callable

from app.schemas.flight_provider_registry import (
    FlightProviderCapabilities,
    FlightProviderRegistryRecord,
    ProviderCategory,
)
from app.services.flight_providers.amadeus_provider import AmadeusFlightProvider
from app.services.flight_providers.duffel_provider import DuffelFlightProvider
from app.services.flight_providers.travelpayouts_provider import TravelpayoutsFlightProvider
from app.services.flight_providers.protocol import FlightProvider
from app.services.flight_providers.types import ProviderStatus
from config import settings

logger = logging.getLogger(__name__)

_DEFAULT_PROVIDER_ID = "duffel"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class FlightProviderRegistration:
    provider_id: str
    display_name: str
    category: ProviderCategory
    factory: Callable[[], FlightProvider]
    capabilities: FlightProviderCapabilities = field(default_factory=FlightProviderCapabilities)


@dataclass
class _RuntimeHealth:
    last_search_at: str | None = None
    last_latency_ms: int | None = None
    consecutive_failures: int = 0
    last_status: str | None = None


_REGISTRY: dict[str, FlightProviderRegistration] = {
    "duffel": FlightProviderRegistration(
        provider_id="duffel",
        display_name="Duffel",
        category="distribution",
        factory=DuffelFlightProvider,
        capabilities=FlightProviderCapabilities(
            search=True,
            refresh_offer=True,
            external_redirect=False,
            multi_city=True,
            flexible_dates=True,
            baggage=True,
            fare_conditions=True,
            connection_disclosures=True,
            search_only=True,
        ),
    ),
    "amadeus": FlightProviderRegistration(
        provider_id="amadeus",
        display_name="Amadeus",
        category="distribution",
        factory=AmadeusFlightProvider,
        capabilities=FlightProviderCapabilities(
            search=True,
            refresh_offer=False,
            external_redirect=False,
            multi_city=False,
            flexible_dates=False,
            baggage=True,
            fare_conditions=False,
            connection_disclosures=False,
            search_only=True,
        ),
    ),
    "travelpayouts": FlightProviderRegistration(
        provider_id="travelpayouts",
        display_name="Aviasales via Travelpayouts",
        category="other",
        factory=TravelpayoutsFlightProvider,
        capabilities=FlightProviderCapabilities(
            search=True,
            refresh_offer=False,
            external_redirect=True,
            multi_city=False,
            flexible_dates=False,
            baggage=False,
            fare_conditions=False,
            connection_disclosures=False,
            search_only=True,
        ),
    ),
}
_RUNTIME: dict[str, _RuntimeHealth] = {}
_LOCK = Lock()


def configured_provider_ids() -> set[str]:
    raw = str(getattr(settings, "flight_enabled_providers", "duffel") or "")
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def register_provider(registration: FlightProviderRegistration) -> None:
    """Register an authorized adapter. Intended for startup wiring and tests."""
    provider_id = registration.provider_id.strip().lower()
    if not provider_id:
        raise ValueError("provider_id is required")
    if provider_id in _REGISTRY:
        raise ValueError(f"Provider '{provider_id}' is already registered")
    _REGISTRY[provider_id] = registration


def enabled_providers() -> list[FlightProvider]:
    """Return enabled adapters. Skip extras that lack credentials; keep Duffel if listed."""
    enabled_ids = configured_provider_ids()
    providers: list[FlightProvider] = []
    for provider_id, registration in _REGISTRY.items():
        if provider_id not in enabled_ids:
            continue
        try:
            provider = registration.factory()
            health = provider.health_check()
        except Exception:
            logger.warning("Flight provider %s failed health check; skipping", provider_id)
            continue
        # Duffel is the baseline adapter. Keep it when enabled so search/booking
        # can still run (and report unconfigured themselves). Skip only extra
        # providers that have no credentials, so one missing key cannot empty the list.
        if health.status == "unconfigured" and provider_id != _DEFAULT_PROVIDER_ID:
            continue
        providers.append(provider)
    return providers


def record_provider_search(status: ProviderStatus) -> None:
    with _LOCK:
        runtime = _RUNTIME.setdefault(status.provider_id, _RuntimeHealth())
        runtime.last_search_at = _utc_now_iso()
        runtime.last_latency_ms = status.elapsed_ms
        runtime.last_status = status.status
        if status.status == "ok":
            runtime.consecutive_failures = 0
        else:
            runtime.consecutive_failures += 1


def provider_registry_records(*, include_disabled: bool) -> list[FlightProviderRegistryRecord]:
    enabled_ids = configured_provider_ids()
    records: list[FlightProviderRegistryRecord] = []
    for provider_id, registration in _REGISTRY.items():
        enabled = provider_id in enabled_ids
        if not enabled and not include_disabled:
            continue
        provider = registration.factory()
        health = provider.health_check() if enabled else ProviderStatus(provider_id=provider_id, status="disabled")
        configured = health.status not in {"unconfigured", "disabled"}
        with _LOCK:
            runtime = _RUNTIME.get(provider_id, _RuntimeHealth())
            runtime_copy = _RuntimeHealth(
                last_search_at=runtime.last_search_at,
                last_latency_ms=runtime.last_latency_ms,
                consecutive_failures=runtime.consecutive_failures,
                last_status=runtime.last_status,
            )
        effective_status = health.status
        if enabled and runtime_copy.last_status in {"timeout", "error"}:
            effective_status = runtime_copy.last_status  # type: ignore[assignment]
        message = health.message
        if effective_status in {"timeout", "error"}:
            message = "Flight search is temporarily unavailable"
        records.append(
            FlightProviderRegistryRecord(
                provider_id=provider_id,
                display_name=registration.display_name,
                category=registration.category,
                enabled=enabled,
                configured=configured,
                status=effective_status,
                environment=health.environment,
                capabilities=registration.capabilities,
                message=message,
                last_checked_at=_utc_now_iso(),
                last_search_at=runtime_copy.last_search_at,
                last_latency_ms=runtime_copy.last_latency_ms,
                consecutive_failures=runtime_copy.consecutive_failures,
            )
        )
    return records
