from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class CartItemCreate(BaseModel):
    item_type: str
    item_id: str | None = None
    item_name: str
    item_image: str | None = None
    item_category: str | None = None
    place_name: str | None = None
    full_address: str | None = None
    lat: float = 0.0
    lng: float = 0.0
    price_range: str | None = None
    rating: float | None = None
    source: str = "explore"
    source_url: str | None = None

class CartItemResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    item_type: str
    item_id: str | None = None
    item_name: str
    item_image: str | None = None
    item_category: str | None = None
    place_name: str | None = None
    full_address: str | None = None
    lat: float
    lng: float
    price_range: str | None = None
    rating: float | None = None
    source: str
    source_url: str | None = None
    added_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CartConvertToTripRequest(BaseModel):
    trip_name: str
    selected_item_ids: list[uuid.UUID]

class CartConvertToTripResponse(BaseModel):
    trip_id: uuid.UUID

class CartCountResponse(BaseModel):
    count: int

class VideoExtractRequest(BaseModel):
    url: str

class VideoExtractResponse(BaseModel):
    title: str | None = None
    description: str | None = None
    thumbnail: str | None = None
    extracted_place: str | None = None
    city: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None
    confidence: str | None = None
    platform: str | None = None
