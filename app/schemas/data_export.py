"""
app/schemas/data_export.py — Pydantic v2 schemas for data export endpoints
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


class ExportRequestIn(BaseModel):
    export_type: str = "full"   # full | trips | maps


class ExportTripsIn(BaseModel):
    trip_ids: list[uuid.UUID]
    format: Literal["json", "ics"] = "json"

    @field_validator("trip_ids")
    @classmethod
    def trip_ids_not_empty(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        if not v:
            raise ValueError("trip_ids cannot be empty")
        return v


class ExportMapsIn(BaseModel):
    format: Literal["geojson"] = "geojson"


class ExportStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    export_type: str
    format: str
    status: str              # pending | processing | ready | failed | expired
    file_url: str | None
    file_size_kb: int | None
    error_message: str | None
    requested_at: datetime
    ready_at: datetime | None
    expires_at: datetime | None


class ExportHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    export_type: str
    status: str
    file_size_kb: int | None
    requested_at: datetime
    ready_at: datetime | None
    expires_at: datetime | None
