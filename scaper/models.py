"""Typed records passed between connectors, the pipeline, and the store."""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EventStatus = Literal["scheduled", "sold_out", "postponed", "cancelled", "completed"]
RunStatus = Literal["running", "succeeded", "partial", "failed"]


class RawItem(BaseModel):
    """One provider entity exactly as fetched. Stored in ingest.raw_records."""

    model_config = ConfigDict(frozen=True)

    external_id: str = Field(min_length=1)
    payload: dict[str, Any]

    @property
    def sha256(self) -> str:
        canonical = json.dumps(self.payload, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class VenueRecord(BaseModel):
    external_id: str
    name: str = Field(min_length=1)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    freeform: str | None = None
    locality: str | None = None
    region: str | None = None
    postcode: str | None = None
    country: str | None = None

    def overture_address(self) -> dict[str, str]:
        """Same key shape as places.address rows loaded from Overture."""
        parts = {
            "freeform": self.freeform,
            "locality": self.locality,
            "region": self.region,
            "postcode": self.postcode,
            "country": self.country,
        }
        return {k: v for k, v in parts.items() if v}


class EventRecord(BaseModel):
    external_id: str
    title: str = Field(min_length=1)
    description: str | None = None
    category: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    timezone: str | None = None
    status: EventStatus = "scheduled"
    is_free: bool | None = None
    price_min: float | None = Field(default=None, ge=0)
    price_max: float | None = Field(default=None, ge=0)
    currency: str | None = None
    url: str | None = None
    image_url: str | None = None
    venue: VenueRecord | None = None

    @field_validator("starts_at", "ends_at")
    @classmethod
    def _require_tz(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("datetimes must be timezone-aware")
        return value


class Rejected(BaseModel):
    """Extraction decided this payload does not belong in Explorer (not an error)."""

    reason: str


ExtractResult = EventRecord | Rejected


class Source(BaseModel):
    id: uuid.UUID
    connector: str
    name: str
    config: dict[str, Any]
    city_slug: str | None = None
    enabled: bool = True
    interval_minutes: int = 360
    last_run_at: datetime | None = None


class RunStats(BaseModel):
    fetched: int = 0
    unchanged: int = 0
    inserted: int = 0
    updated: int = 0
    rejected: int = 0
    failed: int = 0
    purged: int = 0
    deduped: int = 0


class RunReport(BaseModel):
    run_id: uuid.UUID
    source: str
    status: RunStatus
    stats: RunStats
    error_summary: str | None = None
