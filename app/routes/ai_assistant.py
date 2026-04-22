# NOTE: Register this router in app/main.py manually if not already registered.
# Do not modify app/main.py in this task.
# Example: app.include_router(ai_assistant.router, prefix=settings.api_v1_prefix) or equivalent.

"""
app/routes/ai_assistant.py — Thin API for the Travello sidecar AI helper.
"""
from fastapi import APIRouter, Depends

from app.models.user import User
from app.schemas.ai_assistant import AIAssistantRequest, AIAssistantResponse
from app.services.ai_assistant_service import AIAssistantService
from app.utils.auth import get_current_user

router = APIRouter(tags=["AI Assistant"])


@router.post(
    "/ai/assistant",
    response_model=AIAssistantResponse,
    summary="Sidecar page assistant (OpenAI, read-only help)",
)
def post_ai_assistant(
    body: AIAssistantRequest,
    _user: User = Depends(get_current_user),
) -> AIAssistantResponse:
    """
    Auth required; the handler does not use the user row — presence of `Depends` validates the token.
    """
    return AIAssistantService.respond(body)
