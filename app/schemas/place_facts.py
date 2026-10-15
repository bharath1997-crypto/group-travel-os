"""Provider-stated place facts (Wikipedia, OpenStreetMap)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class PlaceFactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: str
    source: str
    source_url: str | None = None
    license: str
    attribution: str
