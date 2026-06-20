from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Literal, Optional
from app.models.live_session import LiveMode
from app.models.road_report import ReportType

class LiveSessionCreate(BaseModel):
    trip_id: Optional[UUID] = None
    mode: LiveMode = LiveMode.solo

class LiveSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    trip_id: Optional[UUID]
    started_by: UUID
    mode: LiveMode
    is_active: bool
    started_at: datetime

class RoadReportCreate(BaseModel):
    report_type: ReportType
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    city: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = Field(None, max_length=200)

class RoadReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    reporter_id: UUID
    report_type: ReportType
    lat: float
    lng: float
    city: Optional[str]
    description: Optional[str]
    confirmed_count: int
    dismissed_count: int
    is_active: bool
    expires_at: datetime
    created_at: datetime

class NearbyReportsQuery(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(default=5.0, ge=0.5, le=50.0)

class ReportConfirmBody(BaseModel):
    action: Literal["confirm", "dismiss"]


class GuestWayraBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=200)
    session_key: str = Field(..., min_length=1, max_length=64)


class GuestWayraOut(BaseModel):
    reply: str
    remaining: int


class TrafficDensityQuery(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(default=10.0, ge=0.5, le=50.0)


class TrafficDensityPoint(BaseModel):
    lat: float
    lng: float
    count: int
    level: Literal["low", "medium", "high"]
