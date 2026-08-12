# NOTE: Register this router in app/main.py manually if not already registered.
# Do not modify app/main.py in this task.
# Example: app.include_router(ai_assistant.router, prefix=settings.api_v1_prefix) or equivalent.

"""
app/routes/ai_assistant.py — Thin API for the Rovvy sidecar AI helper.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.ai_assistant import (
    AIAssistantRequest,
    AIAssistantResponse,
    WayraUnmatchedQuestionList,
    WayraUnmatchedQuestionOut,
)
from app.services.ai_assistant_service import AIAssistantService
from app.services.gemini_usage import get_gemini_usage_totals
from app.services.wayra_knowledge_service import WayraKnowledgeService
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

router = APIRouter(tags=["AI Assistant"])


def _require_admin(current_user: User) -> None:
    if not current_user.is_admin:
        AppException.forbidden("Admin privileges required")


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
async def post_ai_assistant(
    body: AIAssistantRequest,
    db: Session = Depends(get_db),
) -> AIAssistantResponse:
    """Browse-first: no login required; optional auth may be added later for personalization."""
    return await AIAssistantService.respond(body, db=db)


@router.get(
    "/ai/wayra/unmatched-questions",
    response_model=WayraUnmatchedQuestionList,
    summary="Inspect frequent unmatched Wayra questions (admin)",
)
def list_unmatched_wayra_questions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WayraUnmatchedQuestionList:
    _require_admin(current_user)
    rows = WayraKnowledgeService.list_unmatched(db, limit=limit, offset=offset)
    return WayraUnmatchedQuestionList(
        items=[WayraUnmatchedQuestionOut.model_validate(row) for row in rows],
        limit=limit,
        offset=offset,
    )
