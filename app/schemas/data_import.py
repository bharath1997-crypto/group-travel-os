"""
app/schemas/data_import.py — Pydantic v2 schemas for data import endpoints
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ImportPreviewRow(BaseModel):
    """One row shown in the preview table."""
    index: int
    status: str          # "valid" | "duplicate" | "error"
    data: dict[str, Any]
    reason: str | None = None


class ImportPreviewOut(BaseModel):
    import_id: uuid.UUID
    status: str
    import_type: str
    format: str
    original_filename: str | None
    total_items: int
    valid_items: int
    duplicate_items: int
    error_items: int
    preview: list[ImportPreviewRow]   # first 10 rows


class ImportConfirmOut(BaseModel):
    import_id: uuid.UUID
    status: str
    import_type: str
    imported_count: int
    skipped_duplicates: int


class ImportHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    import_type: str
    format: str
    status: str
    original_filename: str | None
    total_items: int
    valid_items: int
    duplicate_items: int
    error_items: int
    created_at: datetime
    imported_at: datetime | None
