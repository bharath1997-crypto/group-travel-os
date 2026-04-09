"""
app/routes/pins.py — Saved map pins API
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.models.saved_pin import SavedPin
from app.models.user import User
from app.services.pin_service import PinService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/pins", tags=["pins"])


class CreatePinRequest(BaseModel):
    lat: float
    lng: float
    name: str = Field(..., min_length=1, max_length=200)
    flag_type: str = Field(..., max_length=30)
    note: str | None = Field(None, max_length=1000)


class UpdatePinRequest(BaseModel):
    note: str | None = Field(None, max_length=1000)
    flag_type: str | None = Field(None, max_length=30)


class PinOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    latitude: float
    longitude: float
    name: str
    note: str | None
    flag_type: str
    created_at: datetime


def pin_to_out(row: SavedPin) -> PinOut:
    return PinOut(
        id=row.id,
        user_id=row.user_id,
        latitude=row.latitude,
        longitude=row.longitude,
        name=row.name,
        note=row.note,
        flag_type=row.flag_type,
        created_at=row.created_at,
    )


@router.post(
    "",
    response_model=PinOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a saved pin",
)
def create_pin(
    data: CreatePinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = PinService.create_pin(
        db,
        current_user.id,
        data.lat,
        data.lng,
        data.name,
        data.flag_type,
        data.note,
    )
    return pin_to_out(row)


@router.get(
    "",
    response_model=list[PinOut],
    summary="List your saved pins",
)
def list_pins(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = PinService.get_user_pins(db, current_user.id)
    return [pin_to_out(r) for r in rows]


@router.delete(
    "/{pin_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a saved pin",
)
def delete_pin(
    pin_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    PinService.delete_pin(db, pin_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/{pin_id}",
    response_model=PinOut,
    summary="Update a saved pin",
)
def update_pin(
    pin_id: uuid.UUID,
    data: UpdatePinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump(exclude_unset=True)
    row = PinService.update_pin_fields(db, pin_id, current_user.id, payload)
    return pin_to_out(row)
