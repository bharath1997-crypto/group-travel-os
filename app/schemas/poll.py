"""
app/schemas/poll.py — Poll request and response schemas (Pydantic v2)
"""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.poll import Poll, PollStatus, PollType


class PollOptionCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=300)
    location_id: UUID | None = None


class PollCreate(BaseModel):
    question: str = Field(..., min_length=2, max_length=500)
    poll_type: PollType
    options: list[PollOptionCreate] = Field(..., min_length=2)
    closes_at: datetime | None = None


class CastVoteRequest(BaseModel):
    option_id: UUID


class PollOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    poll_id: UUID
    label: str
    location_id: UUID | None
    vote_count: int = 0


class PollOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    question: str
    poll_type: PollType
    status: PollStatus
    created_by: UUID
    closes_at: datetime | None
    created_at: datetime
    options: list[PollOptionOut] = []


class PollResultOptionOut(BaseModel):
    option_id: UUID
    label: str
    vote_count: int
    location_id: UUID | None


class PollResultsOut(BaseModel):
    poll: PollOut
    results: list[PollResultOptionOut]


def poll_to_out(poll: Poll) -> PollOut:
    """Map Poll ORM to PollOut; uses ephemeral vote_count on options when present."""
    opts = [
        PollOptionOut(
            id=o.id,
            poll_id=o.poll_id,
            label=o.label,
            location_id=o.location_id,
            vote_count=int(getattr(o, "vote_count", 0)),
        )
        for o in poll.options
    ]
    return PollOut(
        id=poll.id,
        trip_id=poll.trip_id,
        question=poll.question,
        poll_type=poll.poll_type,
        status=poll.status,
        created_by=poll.created_by,
        closes_at=poll.closes_at,
        created_at=poll.created_at,
        options=opts,
    )


def poll_results_to_out(data: dict[str, Any]) -> PollResultsOut:
    """Build PollResultsOut from PollService.get_poll_results dict."""
    results = [
        PollResultOptionOut(
            option_id=r["option_id"],
            label=r["label"],
            vote_count=r["vote_count"],
            location_id=r["location_id"],
        )
        for r in data["results"]
    ]
    counts = {r.option_id: r.vote_count for r in results}
    poll_orm: Poll = data["poll"]
    opts = [
        PollOptionOut(
            id=o.id,
            poll_id=o.poll_id,
            label=o.label,
            location_id=o.location_id,
            vote_count=counts.get(o.id, 0),
        )
        for o in poll_orm.options
    ]
    poll_out = PollOut(
        id=poll_orm.id,
        trip_id=poll_orm.trip_id,
        question=poll_orm.question,
        poll_type=poll_orm.poll_type,
        status=poll_orm.status,
        created_by=poll_orm.created_by,
        closes_at=poll_orm.closes_at,
        created_at=poll_orm.created_at,
        options=opts,
    )
    return PollResultsOut(poll=poll_out, results=results)
