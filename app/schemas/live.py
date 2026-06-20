from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Literal, Optional, Any
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


class RouteQuery(BaseModel):
    start_lat: float = Field(..., ge=-90, le=90)
    start_lng: float = Field(..., ge=-180, le=180)
    end_lat: float = Field(..., ge=-90, le=90)
    end_lng: float = Field(..., ge=-180, le=180)


class RouteStepOut(BaseModel):
    instruction: str
    distance: float
    duration: float
    maneuver_type: str
    name: str | None = None
    lat: float
    lng: float


class RouteOut(BaseModel):
    geometry: dict
    steps: list[RouteStepOut]
    total_distance_m: float
    total_duration_s: float


class ReportChatMessage(BaseModel):
    text: str = Field(..., min_length=1, max_length=200)


class ReportChatMessageOut(BaseModel):
    message_id: str
    sent_at: datetime
    text: str
    sender_label: str


class ReportChatItemOut(BaseModel):
    id: str
    text: str
    sender_label: str
    sent_at: str


class ReportChatCountOut(BaseModel):
    count: int


class ReportChatFlagOut(BaseModel):
    flagged: bool
    removed: bool


class GroupMemberValidateOut(BaseModel):
    user_id: UUID
    display_name: str
    is_admin: bool


class GroupValidateOut(BaseModel):
    trip_id: UUID
    trip_name: str
    member_count: int
    members: list[GroupMemberValidateOut]
    is_admin: bool


class MeetingPointSet(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    label: str = Field(default="Meeting Point", max_length=50)


class MeetingPointOut(BaseModel):
    lat: float
    lng: float
    label: str
    set_by: str
    set_at: str


class QuickStatus(BaseModel):
    status: str = Field(
        ...,
        pattern="^(on_my_way|wait_for_me|at_the_spot|need_help)$",
    )


class QuickStatusOut(BaseModel):
    status: str
    updated_at: str


class ConvoyStart(BaseModel):
    destination_lat: float = Field(..., ge=-90, le=90)
    destination_lng: float = Field(..., ge=-180, le=180)
    destination_name: str = Field(default="Destination", max_length=100)


class ConvoyOut(BaseModel):
    active: bool
    leader_id: str
    destination_lat: float
    destination_lng: float
    destination_name: str
    route_geometry: dict
    started_at: str


class EmergencyContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=1, max_length=20)


class EmergencyContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    phone: str


class SOSRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    trip_id: Optional[str] = None
    message: str = Field(
        default="I need help. This is my last known location.",
        max_length=500,
    )


class SOSEmergencyContactOut(BaseModel):
    name: str
    phone: str


class SOSResponse(BaseModel):
    sos_triggered: bool
    fcm_sent_to: int
    emergency_contacts: list[SOSEmergencyContactOut]
    sms_template: str
    google_maps_url: str


class GeofenceSet(BaseModel):
    center_lat: float = Field(..., ge=-90, le=90)
    center_lng: float = Field(..., ge=-180, le=180)
    radius_m: float = Field(default=500, ge=100, le=5000)
    label: str = Field(default="Safe Zone", max_length=50)


class GeofenceOut(BaseModel):
    center_lat: float
    center_lng: float
    radius_m: float
    label: str
    set_by: str
    set_at: str


class BatteryUpdate(BaseModel):
    level: int = Field(..., ge=0, le=100)


class BatteryUpdateOut(BaseModel):
    battery_level: int
    alert_sent: bool


class WayraLiveRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)
    context: dict[str, Any] = Field(default_factory=dict)


class WayraLiveOut(BaseModel):
    reply: str
    action: Optional[
        Literal["open_poi_search", "open_navigation", "call_sos"]
    ] = None


class WayraAnalyzeRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    speed_mph: float = Field(default=0, ge=0)
    trip_id: Optional[str] = None
    member_positions: Optional[list[dict[str, Any]]] = None
    active_reports: Optional[list[str]] = None
    nearby_reports: Optional[list[dict[str, Any]]] = None
    weather_code: Optional[int] = None
    route_geometry: Optional[dict[str, Any]] = None


class WayraAnalyzeOut(BaseModel):
    alert_type: Optional[str] = None
    message: Optional[str] = None
    severity: Optional[Literal["info", "warning", "danger"]] = None
    action: Optional[str] = None
