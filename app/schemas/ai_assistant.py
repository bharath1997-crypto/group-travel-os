"""
Pydantic v2 request/response models for the Travello AI sidecar assistant.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AIAssistantRequest(BaseModel):
    model_config = ConfigDict()

    page: str = Field(..., min_length=1, max_length=100)
    user_message: str = Field(..., min_length=1, max_length=4000)
    trip_id: UUID | None = None
    group_id: UUID | None = None
    active_tab: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class AISuggestedAction(BaseModel):
    model_config = ConfigDict()

    type: str
    label: str
    target: str | None = None
    payload: dict[str, Any] | None = None


class AIAssistantResponse(BaseModel):
    model_config = ConfigDict()

    message: str
    suggested_actions: list[AISuggestedAction] = Field(default_factory=list)
    summary: dict[str, Any] | None = None
