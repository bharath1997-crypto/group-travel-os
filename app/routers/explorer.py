"""
app/routers/explorer.py — Explorer and Wayra endpoints.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.explorer_service import explorer_response_to_wire, run_explorer_aggregate_search
from app.services.serpapi_service import search_google_events
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/explorer")
wayra_router = APIRouter(prefix="/wayra")


class ExplorerSaveRequest(BaseModel):
    trip_id: str = Field(..., min_length=1)


class ExplorerVoteRequest(BaseModel):
    trip_id: str = Field(..., min_length=1)
    vote: str = Field(..., min_length=1)


class WayraChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    city: str = "Chicago"
    trip_context: str = ""


@router.get("/feed", status_code=status.HTTP_200_OK)
def get_explorer_feed(
    city: str = Query("Chicago", max_length=120),
    category: str = Query("", max_length=120),
    date_filter: str = Query("today", max_length=40),
    q: str = Query("", max_length=200),
) -> dict[str, Any]:
    query_str = q.strip() or category.strip() or "events"
    events = search_google_events(
        query=query_str,
        city=city.strip() or "Chicago",
        date_filter=date_filter,
    )
    return {
        "events": events,
        "total": len(events),
        "city": city,
        "source": "google_events",
    }


@router.get("/search", status_code=status.HTTP_200_OK)
async def explorer_unified_search(
    q: str | None = Query(None, max_length=200),
    query: str | None = Query(None, max_length=200),
    city: str | None = Query(None, max_length=120),
    location: str | None = Query(None, max_length=120),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Combined Explorer search (`q`/`city` and `query`/`location` aliases).

    Returns normalized Explorer items plus compatibility fields for Travello Explorer UI.
    """
    clean_query = (query or q or "").strip()
    clean_location = (location or city or "Chicago").strip()
    if len(clean_query) < 2:
        AppException.bad_request("Search query too short")

    resp = await asyncio.to_thread(run_explorer_aggregate_search, db, clean_location, clean_query)
    return explorer_response_to_wire(resp)


@router.post("/items/{item_id}/save", status_code=status.HTTP_200_OK)
def save_explorer_item(
    item_id: str,
    body: ExplorerSaveRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    logger.info(
        "Explorer save intent user=%s item=%s trip=%s",
        current_user.id,
        item_id,
        body.trip_id,
    )
    return {"status": "saved", "item_id": item_id, "trip_id": body.trip_id}


@router.post("/items/{item_id}/vote", status_code=status.HTTP_200_OK)
def vote_explorer_item(
    item_id: str,
    body: ExplorerVoteRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    logger.info(
        "Explorer vote intent user=%s item=%s trip=%s vote=%s",
        current_user.id,
        item_id,
        body.trip_id,
        body.vote,
    )
    return {"status": "voted", "item_id": item_id, "vote": body.vote}


@wayra_router.post("/chat", status_code=status.HTTP_200_OK)
def chat_with_wayra(
    body: WayraChatRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    message = body.message.strip()
    lowered = message.lower()
    context = f"city={body.city}; trip_context={body.trip_context}".strip()
    logger.info("Wayra demo chat user=%s %s", current_user.id, context)

    if "food" in lowered:
        response_text = (
            f"In {body.city}, I would start with food tours, local markets, "
            "and a casual dinner spot that works for groups."
        )
    elif "music" in lowered or "jazz" in lowered:
        response_text = (
            f"{body.city} is a good fit for live music tonight. Look for jazz, "
            "small venues, and late evening shows near your stay."
        )
    elif "free" in lowered:
        response_text = (
            f"I can prioritize free events in {body.city}: parks, galleries, "
            "community festivals, and outdoor performances."
        )
    else:
        response_text = (
            f"I can help your group find events, places, and easy plans in {body.city}. "
            "Tell me your mood, budget, and timing."
        )

    return {"response": response_text, "city": body.city}
