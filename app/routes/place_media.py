"""Live Tab lazy place media lookup by placeKey."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.place_media import PlaceKeyInput, PlaceMediaResolveResponse
from app.services.place_media_service import PlaceMediaService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(tags=["Live Places"])


@router.get(
    "/live/places/media",
    response_model=PlaceMediaResolveResponse,
    summary="Resolve approved Rovvy media for a placeKey (lookup only)",
)
def get_place_media(
    place_key: str = Query(..., min_length=3, max_length=320, alias="placeKey"),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlaceMediaResolveResponse:
    return PlaceMediaService.resolve_place_media(db, place_key)


@router.post(
    "/live/places/media/resolve",
    response_model=PlaceMediaResolveResponse,
    summary="Derive placeKey from place fields and resolve approved media",
)
def post_resolve_place_media(
    body: PlaceKeyInput,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlaceMediaResolveResponse:
    return PlaceMediaService.resolve_from_place_input(db, body)
