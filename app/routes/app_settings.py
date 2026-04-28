"""Settings hub API — JSON preferences + derived counts."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.app_settings import (
    AppSettingsOut,
    AppSettingsPatchBody,
    SettingsAccountMetaOut,
    SettingsCountsOut,
)
from app.services.app_settings_service import get_settings_bundle, patch_preferences
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get(
    "/app",
    response_model=AppSettingsOut,
    summary="Merged app preferences and list counts for the settings hub",
)
def get_app_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    data = get_settings_bundle(db, current_user)
    return AppSettingsOut(
        preferences=data["preferences"],
        counts=SettingsCountsOut(**data["counts"]),
        account=SettingsAccountMetaOut(**data["account"]),
    )


@router.patch(
    "/app",
    response_model=AppSettingsOut,
    summary="Deep-merge partial preferences; creates row if missing",
)
def patch_app_settings(
    body: AppSettingsPatchBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    data = patch_preferences(
        db,
        current_user,
        body.preferences,
    )
    return AppSettingsOut(
        preferences=data["preferences"],
        counts=SettingsCountsOut(**data["counts"]),
        account=SettingsAccountMetaOut(**data["account"]),
    )
