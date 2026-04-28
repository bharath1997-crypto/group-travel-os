"""API schemas for /settings/app (Group Travel settings hub)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SettingsCountsOut(BaseModel):
    blocked: int
    close_friends: int
    muted: int
    restricted: int
    favorites: int


class SettingsAccountMetaOut(BaseModel):
    subscription_plan: str
    has_google: bool
    has_facebook: bool
    profile_public: bool


class AppSettingsOut(BaseModel):
    preferences: dict[str, Any]
    counts: SettingsCountsOut
    account: SettingsAccountMetaOut


class AppSettingsPatchBody(BaseModel):
    preferences: dict[str, Any] = Field(default_factory=dict)
