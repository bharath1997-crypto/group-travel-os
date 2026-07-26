# NOTE: Register this router in app/main.py manually if not already registered.
# Do not modify app/main.py in this task.
# Example: app.include_router(ai_assistant.router, prefix=settings.api_v1_prefix) or equivalent.

"""
app/routes/ai_assistant.py — Thin API for the Rovvy sidecar AI helper.
"""
from fastapi import APIRouter, Depends

from app.schemas.ai_assistant import AIAssistantRequest, AIAssistantResponse
from app.services.ai_assistant_service import AIAssistantService
from app.services.gemini_usage import get_gemini_usage_totals
from app.utils.auth import get_current_user
from app.models.user import User

router = APIRouter(tags=["AI Assistant"])


@router.get(
    "/ai/usage",
    summary="Gemini token usage counters (current backend process)",
)
def get_ai_usage(_current_user: User = Depends(get_current_user)) -> dict[str, int]:
    """Authenticated snapshot of in-process Gemini token totals since last deploy/restart."""
    return get_gemini_usage_totals()


@router.post(
    "/ai/assistant",
    response_model=AIAssistantResponse,
    summary="Sidecar page assistant (OpenAI, read-only help)",
)
async def post_ai_assistant(body: AIAssistantRequest) -> AIAssistantResponse:
    """Browse-first: no login required; optional auth may be added later for personalization."""
    return await AIAssistantService.respond(body)
