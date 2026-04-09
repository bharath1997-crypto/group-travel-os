"""
app/routes/feed.py — Destination feed and search (Phase 3)

Routes are thin: accept request, call service, return response.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.feed_service import FeedService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/feed", tags=["feed"])


class DestinationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    country: str
    category: str
    trending_score: float
    image_url: str | None
    best_months: list[int] | None
    avg_cost_per_day: float | None


class TrendingResponse(BaseModel):
    items: list[DestinationOut]
    total: int
    page: int
    page_size: int
    pages: int


class SearchResponse(BaseModel):
    items: list[DestinationOut]
    total: int


@router.get("/trending", response_model=TrendingResponse, summary="Trending destinations")
def get_trending(
    category: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return FeedService.get_trending(db, category, page, page_size)


@router.get("/search", response_model=SearchResponse, summary="Search destinations by name or country")
def search_feed(
    q: str = Query(..., min_length=1),
    category: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = FeedService.search_destinations(db, q, category)
    return SearchResponse(items=items, total=len(items))


@router.get(
    "/destinations/{destination_id}",
    response_model=DestinationOut,
    summary="Destination detail",
)
def get_destination(
    destination_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return FeedService.get_destination_detail(db, destination_id)
