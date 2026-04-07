"""
app/schemas/timer.py — Trip timer request/response schemas (Pydantic v2)
"""

from pydantic import BaseModel, Field


class StartTimerRequest(BaseModel):
    duration_seconds: int = Field(..., ge=30, le=86400)


class TimerStateOut(BaseModel):
    started_by: str
    started_at: int
    duration_seconds: int
    is_active: bool
