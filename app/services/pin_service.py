"""
app/services/pin_service.py — Saved map pins
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.saved_pin import SavedPin
from app.utils.exceptions import AppException

ALLOWED_FLAG_TYPES = frozenset(
    {"dream", "interesting", "gang_trip", "visited", "custom"},
)


class PinService:
    @staticmethod
    def _validate_flag(flag: str) -> None:
        if flag not in ALLOWED_FLAG_TYPES:
            AppException.bad_request("Invalid flag type")

    @staticmethod
    def create_pin(
        db: Session,
        user_id: uuid.UUID,
        lat: float,
        lng: float,
        name: str,
        flag_type: str,
        note: str | None,
    ) -> SavedPin:
        PinService._validate_flag(flag_type)
        row = SavedPin(
            user_id=user_id,
            latitude=lat,
            longitude=lng,
            name=name.strip(),
            note=note.strip() if note else None,
            flag_type=flag_type,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def get_user_pins(db: Session, user_id: uuid.UUID) -> list[SavedPin]:
        rows = (
            db.execute(
                select(SavedPin)
                .where(SavedPin.user_id == user_id)
                .order_by(SavedPin.created_at.desc())
            )
            .scalars()
            .all()
        )
        return list(rows)

    @staticmethod
    def delete_pin(db: Session, pin_id: uuid.UUID, user_id: uuid.UUID) -> None:
        row = db.execute(
            select(SavedPin).where(SavedPin.id == pin_id)
        ).scalar_one_or_none()
        if not row:
            AppException.not_found("Pin not found")
        if row.user_id != user_id:
            AppException.forbidden()
        db.delete(row)
        db.commit()

    @staticmethod
    def update_pin_fields(
        db: Session,
        pin_id: uuid.UUID,
        user_id: uuid.UUID,
        fields: dict,
    ) -> SavedPin:
        row = db.execute(
            select(SavedPin).where(SavedPin.id == pin_id)
        ).scalar_one_or_none()
        if not row:
            AppException.not_found("Pin not found")
        if row.user_id != user_id:
            AppException.forbidden()

        if "flag_type" in fields:
            ft = fields["flag_type"]
            if ft is not None:
                PinService._validate_flag(ft)
                row.flag_type = ft
        if "note" in fields:
            n = fields["note"]
            if n is None or (isinstance(n, str) and not n.strip()):
                row.note = None
            else:
                row.note = str(n).strip()

        db.commit()
        db.refresh(row)
        return row
