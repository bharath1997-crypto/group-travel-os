from fastapi import APIRouter, Depends

from app.models.user import User
from app.schemas.live_routing import RoutePreviewRequest, RoutePreviewResponse
from app.services.live_routing_service import LiveRoutingService
from app.utils.auth import get_current_user_optional

router = APIRouter(tags=["Live Routing"])


@router.post(
    "/live/route-preview",
    response_model=RoutePreviewResponse,
    summary="Get route preview coordinate geometry from OSRM",
)
async def get_route_preview(
    body: RoutePreviewRequest,
    _user: User | None = Depends(get_current_user_optional),
) -> RoutePreviewResponse:
    return await LiveRoutingService.get_route_preview(body)
