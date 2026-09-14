from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LiveFirebaseTokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    token: str


class LiveStartGroupConvergeRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tripId: uuid.UUID
    destinationLat: float = Field(..., ge=-90, le=90)
    destinationLng: float = Field(..., ge=-180, le=180)
    travelMode: Literal["Drive", "Bike", "Walk", "Trek"] = "Drive"


class LiveStartGroupConvergeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: Literal["ready", "failed"]
    sessionId: uuid.UUID | None = None
    message: str | None = None


class LiveVotePanelOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    meta: str
    voteCount: int


class LiveVotePanelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pollId: uuid.UUID | None = None
    question: str
    closesAtLabel: str | None = None
    memberCount: int
    options: list[LiveVotePanelOptionOut]
    myOptionId: uuid.UUID | None = None
    status: Literal["open", "closed", "resolved", "empty"] = "empty"


class LiveVotePanelOptionCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    label: str = Field(..., min_length=1, max_length=300)
    meta: str | None = Field(None, max_length=500)
    locationId: uuid.UUID | None = None


class LiveCreateVotePollRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    question: str = Field(default="Where are we eating?", min_length=2, max_length=500)
    options: list[LiveVotePanelOptionCreate] = Field(..., min_length=2)
    closesAt: datetime | None = None


class LiveCastVoteRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    optionId: uuid.UUID
