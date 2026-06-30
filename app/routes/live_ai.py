"""Live Tab location context + Rovi AI endpoints."""
from fastapi import APIRouter, Depends

from app.models.user import User
from app.schemas.live_location_context import (
    LiveLocationContextRequest,
    LiveLocationContextResponse,
    LivePlaceExplanationRequest,
    LivePlaceExplanationResponse,
)
from app.services.live_ai_service import LiveAIService
from app.services.live_location_context_service import resolve_location_context
from app.utils.auth import get_current_user

router = APIRouter(tags=["Live AI"])


@router.post(
    "/live/location-context",
    response_model=LiveLocationContextResponse,
    summary="Build deterministic Live place location context (no AI)",
)
def post_location_context(
    body: LiveLocationContextRequest,
    _user: User = Depends(get_current_user),
) -> LiveLocationContextResponse:
    return resolve_location_context(body)


@router.post(
    "/live/ai/place-explanation",
    response_model=LivePlaceExplanationResponse,
    summary="Rovi AI place explanation (compact context only)",
)
def post_place_explanation(
    body: LivePlaceExplanationRequest,
    _user: User = Depends(get_current_user),
) -> LivePlaceExplanationResponse:
    return LiveAIService.explain_place(body)
