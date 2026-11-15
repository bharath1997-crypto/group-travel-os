"""
app/routes/collection.py — My Space / Collection API
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.collection_item import CollectionItem
from app.models.user import User
from app.models.user_collection import UserCollection
from app.services import link_reader_service
from app.services.collection_service import CollectionService
from config import settings
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

router = APIRouter(prefix="/collection", tags=["collection"])


class CollectionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    collection_id: uuid.UUID | None
    name: str
    latitude: float | None
    longitude: float | None
    city: str | None
    country: str | None
    category: str | None
    subcategory: str | None
    source: str
    saved_from: str | None
    note: str | None
    stars: int
    match_status: str
    is_unsorted: bool
    tags: list[str] = Field(default_factory=list)
    shared_by_user_id: uuid.UUID | None = None
    shared_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    group_id: uuid.UUID | None
    created_at: datetime


class CollectionListResponse(BaseModel):
    items: list[CollectionItemOut]
    total_count: int
    unsorted_count: int
    facets: dict[str, list[str]]
    city_counts: dict[str, int]


class CreateCollectionItemRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    city: str | None = Field(None, max_length=120)
    country: str | None = Field(None, max_length=120)
    category: str | None = Field(None, max_length=80)
    subcategory: str | None = Field(None, max_length=80)
    source: str = Field(default="Search", max_length=40)
    saved_from: str | None = Field(None, max_length=500)
    note: str | None = Field(None, max_length=1000)
    stars: int = Field(default=0, ge=0, le=5)
    match_status: str = Field(default="sure", max_length=20)
    is_unsorted: bool = False
    collection_id: uuid.UUID | None = None
    tags: list[str] = Field(default_factory=list, max_length=10)


class ShareItemRequest(BaseModel):
    friend_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=20)


class ShareItemResponse(BaseModel):
    sent: list[uuid.UUID]
    already_shared: list[uuid.UUID]


class UpdateCollectionItemRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    note: str | None = Field(None, max_length=1000)
    stars: int | None = Field(None, ge=0, le=5)
    category: str | None = Field(None, max_length=80)
    subcategory: str | None = Field(None, max_length=80)
    city: str | None = Field(None, max_length=120)
    country: str | None = Field(None, max_length=120)
    is_unsorted: bool | None = None
    match_status: str | None = Field(None, max_length=20)
    collection_id: uuid.UUID | None = None
    tags: list[str] | None = Field(None, max_length=10)


class CreateCollectionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    group_id: uuid.UUID | None = None


class ExtractLinkRequest(BaseModel):
    url: HttpUrl


class ExtractCandidateOut(BaseModel):
    name: str
    city: str | None = None
    country: str | None = None
    category: str | None = None
    subcategory: str | None = None
    match_status: str = "unknown"
    saved_from: str | None = None
    already_saved: bool = False


class PreviewOut(BaseModel):
    platform: str | None = None
    author: str | None = None
    thumbnail_url: str | None = None
    video_id: str | None = None


class ExtractLinkResponse(BaseModel):
    source_title: str
    source_label: str
    source_url: str | None = None
    candidates: list[ExtractCandidateOut]
    link_only: bool = False
    link_saved: bool = False
    message: str | None = None
    preview: PreviewOut | None = None


def _item_out(row: CollectionItem, names: dict[uuid.UUID, str] | None = None) -> CollectionItemOut:
    return CollectionItemOut(
        tags=row.tags,
        shared_by_user_id=row.shared_by_user_id,
        shared_by_name=(names or {}).get(row.shared_by_user_id) if row.shared_by_user_id else None,
        id=row.id,
        user_id=row.user_id,
        collection_id=row.collection_id,
        name=row.name,
        latitude=row.latitude,
        longitude=row.longitude,
        city=row.city,
        country=row.country,
        category=row.category,
        subcategory=row.subcategory,
        source=row.source,
        saved_from=row.saved_from,
        note=row.note,
        stars=row.stars,
        match_status=row.match_status,
        is_unsorted=row.is_unsorted,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _collection_out(row: UserCollection) -> CollectionOut:
    return CollectionOut(
        id=row.id,
        user_id=row.user_id,
        name=row.name,
        group_id=row.group_id,
        created_at=row.created_at,
    )


@router.get(
    "/items",
    response_model=CollectionListResponse,
    summary="List saved collection places",
)
def list_collection_items(
    country: str | None = Query(None),
    city: str | None = Query(None),
    category: str | None = Query(None),
    tag: str | None = Query(None, max_length=40),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # One query; the filters are applied in memory (this used to read every row twice).
    all_items = CollectionService.list_items(db, current_user.id)
    filtered = CollectionService.apply_filters(
        all_items, country=country, city=city, category=category, tag=tag
    )
    sender_ids = {r.shared_by_user_id for r in filtered if r.shared_by_user_id}
    names: dict[uuid.UUID, str] = {}
    if sender_ids:
        names = {
            u.id: u.full_name
            for u in db.execute(select(User).where(User.id.in_(sender_ids))).scalars()
        }
    return CollectionListResponse(
        items=[_item_out(r, names) for r in filtered],
        total_count=len(all_items),
        unsorted_count=CollectionService.unsorted_count(all_items),
        facets=CollectionService.filter_facets(all_items),
        city_counts=CollectionService.city_counts(all_items),
    )


@router.post(
    "/items",
    response_model=CollectionItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Save a place to your collection",
)
def create_collection_item(
    data: CreateCollectionItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = CollectionService.create_item(
        db,
        current_user.id,
        name=data.name,
        latitude=data.latitude,
        longitude=data.longitude,
        city=data.city,
        country=data.country,
        category=data.category,
        subcategory=data.subcategory,
        source=data.source,
        saved_from=data.saved_from,
        note=data.note,
        stars=data.stars,
        match_status=data.match_status,
        is_unsorted=data.is_unsorted,
        collection_id=data.collection_id,
        tags=data.tags,
    )
    return _item_out(row)


@router.patch(
    "/items/{item_id}",
    response_model=CollectionItemOut,
    summary="Update a saved collection place",
)
def update_collection_item(
    item_id: uuid.UUID,
    data: UpdateCollectionItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump(exclude_unset=True)
    row = CollectionService.update_item(db, item_id, current_user.id, payload)
    return _item_out(row)


@router.post(
    "/items/{item_id}/share",
    response_model=ShareItemResponse,
    summary="Send a saved place to friends (their Unsorted)",
)
def share_collection_item(
    item_id: uuid.UUID,
    data: ShareItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CollectionService.share_item(db, item_id, current_user, data.friend_ids)


@router.delete(
    "/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a place from your collection",
)
def delete_collection_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    CollectionService.delete_item(db, item_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/collections",
    response_model=list[CollectionOut],
    summary="List named collections",
)
def list_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = CollectionService.list_collections(db, current_user.id)
    return [_collection_out(r) for r in rows]


@router.post(
    "/collections",
    response_model=CollectionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a named collection",
)
def create_collection(
    data: CreateCollectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = CollectionService.create_collection(
        db,
        current_user.id,
        data.name,
        data.group_id,
    )
    return _collection_out(row)


@router.post(
    "/extract-link",
    response_model=ExtractLinkResponse,
    summary="Extract places from a pasted link",
)
def extract_link(
    data: ExtractLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    url = str(data.url)
    user_id = current_user.id
    wait = link_reader_service.check_rate_limit(str(user_id))
    if wait is not None:
        AppException.too_many_requests(
            f"You have read a lot of links. Try again in {max(1, wait // 60)} minutes."
        )
    # Give the database connection back before the slow part (a site can take ~10 s to answer).
    # The pool is small and shared with production; holding it per link read starved other requests.
    db.rollback()
    result = link_reader_service.read_link(
        url, db=db, youtube_key=settings.youtube_api_key
    )
    # One query for the link and every place in it (was one query per place).
    have = CollectionService.saved_from_keys(
        db, user_id, [url] + [c["saved_from"] or "" for c in result["candidates"]]
    )
    candidates = [
        ExtractCandidateOut(**c, already_saved=(c["saved_from"] or "").strip() in have)
        for c in result["candidates"]
    ]
    link_saved = url.strip() in have
    preview = result.get("preview")
    return ExtractLinkResponse(
        source_title=result["source_title"],
        source_label=result["source_label"],
        source_url=result.get("source_url"),
        candidates=candidates,
        link_only=result["link_only"],
        link_saved=link_saved,
        message=result.get("message"),
        preview=PreviewOut(**preview) if preview else None,
    )
