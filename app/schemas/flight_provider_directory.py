"""Public, informational flight-provider directory schemas."""

from typing import Literal

from pydantic import BaseModel, Field


ProviderConnectivityStatus = Literal[
    "information_only",
    "sandbox_connected",
    "live_search_connected",
]


class FlightProviderDirectoryItem(BaseModel):
    catalog_id: int
    slug: str
    provider_name: str
    provider_type: str
    passenger_search_fit: str
    connectivity_status: ProviderConnectivityStatus
    api_access_status: str
    commercial_permission_status: str
    source_status: str
    source: str
    notes: str


class FlightProviderDirectoryResponse(BaseModel):
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    provider_types: list[str]
    connected_sources: int = Field(ge=0)
    items: list[FlightProviderDirectoryItem]

