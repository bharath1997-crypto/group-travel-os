"""
app/routes/collection.py — My Space / Collection API
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from sqlalchemy.orm import Session

from app.models.collection_item import CollectionItem
from app.models.user import User
from app.models.user_collection import UserCollection
from app.services.collection_service import CollectionService
from app.utils.auth import get_current_user
from app.utils.database import get_db

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
    latitude: float | None = None
    longitude: float | None = None
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


class ExtractLinkResponse(BaseModel):
    source_title: str
    source_label: str
    candidates: list[ExtractCandidateOut]
    message: str | None = None


def _item_out(row: CollectionItem) -> CollectionItemOut:
    return CollectionItemOut(
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_items = CollectionService.list_items(db, current_user.id)
    filtered = CollectionService.list_items(
        db,
        current_user.id,
        country=country,
        city=city,
        category=category,
    )
    return CollectionListResponse(
        items=[_item_out(r) for r in filtered],
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
    current_user: User = Depends(get_current_user),
):
    del current_user
    result = CollectionService.extract_link(str(data.url))
    return ExtractLinkResponse(
        source_title=result["source_title"],
        source_label=result["source_label"],
        candidates=[
            ExtractCandidateOut(**c) for c in result["candidates"]
        ],
        message=result.get("message"),
    )
