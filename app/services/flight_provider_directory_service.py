"""Read-only knowledge directory for airlines and flight-industry providers."""

from __future__ import annotations

import csv
import re
from functools import lru_cache
from pathlib import Path

from app.schemas.flight_provider_directory import FlightProviderDirectoryItem, FlightProviderDirectoryResponse, ProviderConnectivityStatus
from app.services.flight_providers.registry import provider_registry_records


CATALOG_PATH = Path(__file__).resolve().parents[2] / "docs" / "flight-provider-prospect-catalog-500.csv"


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")


@lru_cache(maxsize=1)
def _catalog_rows() -> tuple[dict[str, str], ...]:
    if not CATALOG_PATH.exists():
        return ()
    with CATALOG_PATH.open(encoding="utf-8-sig", newline="") as handle:
        return tuple(csv.DictReader(handle))


def _connected_sources() -> dict[str, ProviderConnectivityStatus]:
    connected: dict[str, ProviderConnectivityStatus] = {}
    for record in provider_registry_records(include_disabled=False):
        if not record.configured or record.status not in {"ok", "healthy"}:
            continue
        status: ProviderConnectivityStatus = (
            "sandbox_connected"
            if record.environment in {"sandbox", "test"}
            else "live_search_connected"
        )
        connected[record.provider_id.casefold()] = status
        connected[record.display_name.casefold()] = status
    return connected


def _to_item(row: dict[str, str], connected: dict[str, ProviderConnectivityStatus]) -> FlightProviderDirectoryItem:
    name = row["provider_name"].strip()
    connectivity_status = connected.get(name.casefold(), "information_only")
    api_access_status = row["api_access_status"]
    if connectivity_status == "sandbox_connected":
        api_access_status = "sandbox_configured"
    elif connectivity_status == "live_search_connected":
        api_access_status = "live_configured"
    return FlightProviderDirectoryItem(
        catalog_id=int(row["catalog_id"]), slug=_slug(name), provider_name=name,
        provider_type=row["provider_type"], passenger_search_fit=row["passenger_search_fit"],
        connectivity_status=connectivity_status,
        api_access_status=api_access_status, commercial_permission_status=row["commercial_permission_status"],
        source_status=row["source_status"], source=row["source"], notes=row["notes"],
    )


class FlightProviderDirectoryService:
    @staticmethod
    def list(*, query: str = "", provider_type: str | None = None, passenger_only: bool = False, page: int = 1, page_size: int = 24) -> FlightProviderDirectoryResponse:
        connected = _connected_sources()
        all_items = [_to_item(row, connected) for row in _catalog_rows()]
        normalized_query = query.casefold().strip()
        filtered = [item for item in all_items if (not normalized_query or normalized_query in item.provider_name.casefold()) and (not provider_type or item.provider_type == provider_type) and (not passenger_only or item.passenger_search_fit != "unlikely_cargo_only")]
        start = (page - 1) * page_size
        return FlightProviderDirectoryResponse(
            total=len(filtered), page=page, page_size=page_size,
            provider_types=sorted({item.provider_type for item in all_items}),
            connected_sources=sum(item.connectivity_status != "information_only" for item in all_items),
            items=filtered[start:start + page_size],
        )

    @staticmethod
    def get(slug: str) -> FlightProviderDirectoryItem | None:
        connected = _connected_sources()
        return next((item for row in _catalog_rows() if (item := _to_item(row, connected)).slug == slug), None)
