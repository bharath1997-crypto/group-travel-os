from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.live_session import LiveMode, LiveSession
from app.models.saved_pin import SavedPin
from app.models.user import User
from app.schemas.live_preview_actions import (
    LiveAddLocationRequest,
    LiveAddLocationResponse,
    LiveStartDirectionRequest,
    LiveStartDirectionResponse,
)
from app.schemas.live_routing import RoutePreviewRequest
from app.services.live_routing_service import LiveRoutingService
from app.services.pin_service import PinService

COORD_MATCH_M = 45.0


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    return 2.0 * r * math.asin(math.sqrt(a))


def _format_live_pin_note(data: LiveAddLocationRequest) -> str | None:
    parts: list[str] = []
    if data.address and data.address.strip():
        parts.append(data.address.strip())
    if data.categoryLabel and data.categoryLabel.strip():
        parts.append(data.categoryLabel.strip())
    if data.placeKey and data.placeKey.strip():
        parts.append(f"placeKey:{data.placeKey.strip()}")
    if not parts:
        return None
    return " · ".join(parts)


class LivePreviewActionService:
    @staticmethod
    def _find_nearby_pin(
        db: Session,
        user_id: uuid.UUID,
        lat: float,
        lng: float,
    ) -> SavedPin | None:
        rows = PinService.get_user_pins(db, user_id)
        for row in rows:
            if _haversine_m(row.latitude, row.longitude, lat, lng) <= COORD_MATCH_M:
                return row
        return None

    @staticmethod
    def add_location(
        db: Session,
        user: User,
        data: LiveAddLocationRequest,
    ) -> LiveAddLocationResponse:
        note = _format_live_pin_note(data)
        existing = LivePreviewActionService._find_nearby_pin(
            db, user.id, data.lat, data.lng
        )
        if existing:
            PinService.update_pin_fields(
                db,
                existing.id,
                user.id,
                {
                    "note": note,
                    "flag_type": existing.flag_type or "interesting",
                },
            )
            refreshed = db.execute(
                select(SavedPin).where(SavedPin.id == existing.id)
            ).scalar_one()
            if refreshed.name != data.name.strip():
                refreshed.name = data.name.strip()
                db.commit()
                db.refresh(refreshed)
            return LiveAddLocationResponse(
                pinId=refreshed.id,
                name=refreshed.name,
                latitude=refreshed.latitude,
                longitude=refreshed.longitude,
                created=False,
            )

        row = PinService.create_pin(
            db,
            user.id,
            data.lat,
            data.lng,
            data.name.strip(),
            "interesting",
            note,
        )
        return LiveAddLocationResponse(
            pinId=row.id,
            name=row.name,
            latitude=row.latitude,
            longitude=row.longitude,
            created=True,
        )

    @staticmethod
    async def start_direction(
        db: Session,
        user: User | None,
        data: LiveStartDirectionRequest,
    ) -> LiveStartDirectionResponse:
        preview = await LiveRoutingService.get_route_preview(
            RoutePreviewRequest(
                origin=data.origin,
                destination=data.destination,
                travelMode=data.travelMode,
            )
        )
        if preview.status != "ready":
            return LiveStartDirectionResponse(
                status="failed",
                route=preview,
                message=preview.message or "Route unavailable for selected travel mode.",
            )

        session_id: uuid.UUID | None = None
        if user is not None:
            active = db.execute(
                select(LiveSession).where(
                    LiveSession.started_by == user.id,
                    LiveSession.is_active.is_(True),
                )
            ).scalar_one_or_none()
            if active:
                active.is_active = False
                active.ended_at = datetime.now(timezone.utc)
            session = LiveSession(
                started_by=user.id,
                mode=LiveMode.solo,
                is_active=True,
                trip_id=None,
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            session_id = session.id

        return LiveStartDirectionResponse(
            status="ready",
            sessionId=session_id,
            route=preview,
            message=None,
        )
