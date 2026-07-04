"""
Route Intelligence — Rovi smart route output endpoints.

POST /route-intelligence/resolve
  → deterministic route options

POST /route-intelligence/explain
  → deterministic resolve + Rovi AI explanation
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.models.user import User
from app.schemas.route_intelligence import (
    RouteIntelligenceRequest,
    RouteIntelligenceResponse,
)
from app.services.route_intelligence_service import RouteIntelligenceService
from app.services.rovi_route_ai_service import RoviRouteAIService
from app.utils.auth import get_current_user

router = APIRouter(prefix="/route-intelligence", tags=["Route Intelligence"])


@router.post(
    "/resolve",
    response_model=RouteIntelligenceResponse,
    summary="Deterministic route resolver — no AI",
)
def resolve_route(
    body: RouteIntelligenceRequest,
    _user: User = Depends(get_current_user),
) -> RouteIntelligenceResponse:
    """
    Returns structured route options for origin→destination.
    Pure backend logic — no Gemini call.
    Use this to get the structured data before asking Rovi to explain it.
    """
    return RouteIntelligenceService.resolve(
        origin=body.origin,
        destination=body.destination,
        user_preference=body.user_preference,
    )


@router.post(
    "/explain",
    response_model=RouteIntelligenceResponse,
    summary="Resolve routes + Rovi AI explanation in one call",
)
def explain_route(
    body: RouteIntelligenceRequest,
    _user: User = Depends(get_current_user),
) -> RouteIntelligenceResponse:
    """
    Resolves route options deterministically, then calls Rovi AI to produce
    a clean user-facing travel explanation. Returns the full response including
    rovi_explanation field.
    """
    resp = RouteIntelligenceService.resolve(
        origin=body.origin,
        destination=body.destination,
        user_preference=body.user_preference,
    )
    explanation = RoviRouteAIService.explain(resp)
    resp.rovi_explanation = explanation
    return resp
