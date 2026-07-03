"""Lazy place media resolver — lookup only; no registry row on search."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.place_registry import PlaceMedia, PlaceRegistry
from app.models.user import User
from app.schemas.place_media import (
    PlaceKeyInput,
    PlaceMediaItemOut,
    PlaceMediaResolveResponse,
)
from app.services.place_key_service import build_place_key
from app.utils.exceptions import AppException


class PlaceMediaService:
    @staticmethod
    def derive_place_key(data: PlaceKeyInput) -> str:
        return build_place_key(
            name=data.name,
            lat=data.lat,
            lng=data.lng,
            city=data.city,
            country=data.country,
            osm_type=data.osm_type,
            osm_id=data.osm_id,
        )

    @staticmethod
    def resolve_place_media(db: Session, place_key: str) -> PlaceMediaResolveResponse:
        key = place_key.strip()
        if not key or len(key) > 320:
            AppException.bad_request("Invalid placeKey")

        rows = db.execute(
            select(PlaceMedia)
            .where(
                PlaceMedia.place_key == key,
                PlaceMedia.moderation_status == "approved",
            )
            .order_by(PlaceMedia.created_at.desc())
        ).scalars().all()

        media = [PlaceMediaService._to_media_out(row) for row in rows]
        tag_set: set[str] = set()
        for item in media:
            for tag in item.tags:
                cleaned = str(tag).strip()
                if cleaned:
                    tag_set.add(cleaned)

        return PlaceMediaResolveResponse(
            place_key=key,
            media=media,
            tags=sorted(tag_set),
        )

    @staticmethod
    def resolve_from_place_input(db: Session, data: PlaceKeyInput) -> PlaceMediaResolveResponse:
        place_key = PlaceMediaService.derive_place_key(data)
        return PlaceMediaService.resolve_place_media(db, place_key)

    @staticmethod
    def _to_media_out(row: PlaceMedia) -> PlaceMediaItemOut:
        raw_tags = row.tags if isinstance(row.tags, list) else []
        tags = [str(t).strip() for t in raw_tags if str(t).strip()]
        return PlaceMediaItemOut(
            id=row.id,
            place_key=row.place_key,
            thumbnail_url=row.thumbnail_url,
            storage_url=row.storage_url,
            caption=row.caption,
            tags=tags,
            source=row.source,  # type: ignore[arg-type]
            attribution=row.attribution,
            license=row.license,
            moderation_status=row.moderation_status,  # type: ignore[arg-type]
        )

    # ── Future meaningful-action hooks (not wired in this pass) ─────────────────
    # TODO: upload photo → object storage (Supabase / R2 / Firebase / GCS)
    # TODO: moderation queue for pending media
    # TODO: add tag endpoint
    @staticmethod
    def ensure_place_registry_on_action(
        db: Session,
        *,
        user: User,
        place_key: str,
        name: str,
        lat: float,
        lng: float,
        action: str,
        city: str | None = None,
        state: str | None = None,
        country: str | None = None,
        category: str | None = None,
        osm_type: str | None = None,
        osm_id: int | None = None,
        source: str = "osm",
    ) -> PlaceRegistry:
        """Create or refresh registry row when user saves / adds trip / etc."""
        existing = db.execute(
            select(PlaceRegistry).where(PlaceRegistry.place_key == place_key)
        ).scalar_one_or_none()
        if existing:
            existing.name = name
            existing.lat = lat
            existing.lng = lng
            existing.city = city
            existing.state = state
            existing.country = country
            existing.category = category
            existing.osm_type = osm_type
            existing.osm_id = osm_id
            existing.source = source
            db.commit()
            db.refresh(existing)
            return existing

        row = PlaceRegistry(
            place_key=place_key,
            name=name,
            lat=lat,
            lng=lng,
            city=city,
            state=state,
            country=country,
            category=category,
            osm_type=osm_type,
            osm_id=osm_id,
            source=source,
            created_by=user.id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def seed_approved_media_for_tests(db: Session, **overrides: Any) -> PlaceMedia:
        """Test helper — insert approved media metadata."""
        payload = {
            "place_key": "osm:node:12345",
            "thumbnail_url": "https://cdn.example/photo-thumb.jpg",
            "storage_url": "https://cdn.example/photo-full.jpg",
            "caption": "Test photo",
            "tags": ["landmark"],
            "source": "rovvy_user",
            "attribution": "Photo by Rovvy traveler",
            "license": "CC-BY-4.0",
            "moderation_status": "approved",
        }
        payload.update(overrides)
        row = PlaceMedia(
            id=uuid.uuid4(),
            place_key=str(payload["place_key"]),
            thumbnail_url=str(payload["thumbnail_url"]),
            storage_url=str(payload["storage_url"]),
            caption=payload.get("caption"),
            tags=list(payload.get("tags") or []),
            source=str(payload["source"]),
            attribution=payload.get("attribution"),
            license=payload.get("license"),
            moderation_status=str(payload.get("moderation_status", "approved")),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
