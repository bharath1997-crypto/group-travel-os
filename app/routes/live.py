"""
app/routes/live.py — Live session and road report endpoints

Routes are thin: accept request, call service, return response.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.live import (
    GuestWayraBody,
    GuestWayraOut,
    GroupValidateOut,
    ConvoyOut,
    ConvoyStart,
    LiveSessionCreate,
    LiveSessionOut,
    MeetingPointOut,
    MeetingPointSet,
    NearbyReportsQuery,
    QuickStatus,
    QuickStatusOut,
    ReportConfirmBody,
    RoadReportCreate,
    RoadReportOut,
    TrafficDensityPoint,
    TrafficDensityQuery,
    RouteOut,
    RouteQuery,
    ReportChatCountOut,
    ReportChatFlagOut,
    ReportChatItemOut,
    ReportChatMessage,
    ReportChatMessageOut,
    EmergencyContactCreate,
    EmergencyContactOut,
    SOSRequest,
    SOSResponse,
    GeofenceSet,
    GeofenceOut,
    BatteryUpdate,
    BatteryUpdateOut,
    WayraLiveRequest,
    WayraLiveOut,
    WayraAnalyzeRequest,
    WayraAnalyzeOut,
    SpeedLimitQuery,
    SpeedLimitOut,
    RouteAlertsQuery,
    RouteAlertsOut,
    SpeedCamerasQuery,
    SpeedCamerasOut,
    SpeedCameraRouteAlertQuery,
    SpeedCameraRouteAlertOut,
    TrackPointIn,
    TrackPointOut,
    TrackEndIn,
    TripTrackOut,
    TripTrackSummaryOut,
    NearbyTravelersRequest,
    NearbyTravelerOut,
    TravelerChatSend,
    TravelerChatSendOut,
    TravelerChatItemOut,
    TravelerChatFlagOut,
)
from app.services.live_service import LiveService
from app.utils.auth import get_current_user, get_current_user_optional
from app.utils.database import get_db

router = APIRouter(prefix="/live", tags=["Live"])


@router.post(
    "/session/start",
    response_model=LiveSessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Start a live session",
)
def start_live_session(
    data: LiveSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.start_session(
        db,
        current_user.id,
        data.trip_id,
        data.mode,
    )


@router.post(
    "/session/{session_id}/end",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="End a live session",
)
def end_live_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LiveService.end_session(db, current_user.id, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/reports",
    response_model=RoadReportOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a road report",
)
def submit_road_report(
    data: RoadReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.submit_report(db, current_user.id, data)


@router.get(
    "/reports/nearby",
    response_model=list[RoadReportOut],
    status_code=status.HTTP_200_OK,
    summary="Get nearby active road reports",
)
def get_nearby_road_reports(
    query: NearbyReportsQuery = Depends(),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return LiveService.get_nearby_reports(
        db,
        query.lat,
        query.lng,
        query.radius_km,
    )


@router.post(
    "/reports/{report_id}/confirm",
    response_model=RoadReportOut,
    status_code=status.HTTP_200_OK,
    summary="Confirm or dismiss a road report",
)
def confirm_road_report(
    report_id: uuid.UUID,
    body: ReportConfirmBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.confirm_report(
        db,
        current_user.id,
        report_id,
        body.action,
    )


@router.post(
    "/wayra/guest",
    response_model=GuestWayraOut,
    status_code=status.HTTP_200_OK,
    summary="Guest Wayra chat (rate limited, no auth)",
)
def guest_wayra_chat(
    body: GuestWayraBody,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return LiveService.guest_wayra_chat(body.message, body.session_key)


@router.post(
    "/wayra",
    response_model=WayraLiveOut,
    status_code=status.HTTP_200_OK,
    summary="Wayra live chat with travel context (auth required)",
)
def wayra_live_chat(
    body: WayraLiveRequest,
    current_user: User = Depends(get_current_user),
):
    return LiveService.wayra_live_chat(body.message, body.context)


@router.post(
    "/wayra/analyze",
    response_model=WayraAnalyzeOut,
    status_code=status.HTTP_200_OK,
    summary="Proactive Wayra alerts (rule-based, auth required)",
)
def wayra_analyze(
    body: WayraAnalyzeRequest,
    current_user: User = Depends(get_current_user),
):
    return LiveService.wayra_analyze(body.model_dump())


@router.get(
    "/speed-limit",
    response_model=SpeedLimitOut,
    status_code=status.HTTP_200_OK,
    summary="Get posted speed limit and road name from OpenStreetMap",
)
def get_speed_limit(
    query: SpeedLimitQuery = Depends(),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return LiveService.get_speed_limit(query.lat, query.lng)


@router.get(
    "/route-alerts",
    response_model=RouteAlertsOut,
    status_code=status.HTTP_200_OK,
    summary="Get bearing-aware route alerts from active road reports",
)
def get_route_alerts(
    query: RouteAlertsQuery = Depends(),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return LiveService.get_route_alerts(
        db,
        query.lat,
        query.lng,
        query.bearing,
        query.speed_mph,
    )


@router.get(
    "/speed-cameras",
    response_model=SpeedCamerasOut,
    status_code=status.HTTP_200_OK,
    summary="Get speed cameras near a location from OpenStreetMap",
)
def get_speed_cameras(
    query: SpeedCamerasQuery = Depends(),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return LiveService.get_speed_cameras(query.lat, query.lng, query.radius_m)


@router.get(
    "/speed-cameras/route-alert",
    response_model=SpeedCameraRouteAlertOut,
    status_code=status.HTTP_200_OK,
    summary="Get bearing-aware speed camera alert ahead on route",
)
def get_speed_camera_route_alert(
    query: SpeedCameraRouteAlertQuery = Depends(),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return LiveService.get_speed_camera_route_alert(
        query.lat,
        query.lng,
        query.bearing,
        query.speed_mph,
        query.radius_m,
    )


@router.post(
    "/track/point",
    response_model=TrackPointOut,
    status_code=status.HTTP_200_OK,
    summary="Record a GPS track point for the active live session",
)
def record_track_point(
    body: TrackPointIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.record_track_point(
        db,
        current_user.id,
        body.session_id,
        body.lat,
        body.lng,
        body.speed_mph,
        body.bearing,
        body.ts,
    )


@router.post(
    "/track/end",
    response_model=TripTrackOut,
    status_code=status.HTTP_200_OK,
    summary="End trip track recording and calculate summary stats",
)
def end_track(
    body: TrackEndIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.end_track(
        db,
        current_user.id,
        body.session_id,
        body.reports_encountered,
        body.cameras_passed,
    )


@router.get(
    "/track/history",
    response_model=list[TripTrackSummaryOut],
    status_code=status.HTTP_200_OK,
    summary="Get recent trip track summaries for the current user",
)
def get_track_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.get_track_history(db, current_user.id)


@router.get(
    "/track/{session_id}",
    response_model=TripTrackOut,
    status_code=status.HTTP_200_OK,
    summary="Get full trip track for replay",
)
def get_track(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.get_track(db, current_user.id, session_id)


@router.post(
    "/travelers/nearby",
    response_model=list[NearbyTravelerOut],
    status_code=status.HTTP_200_OK,
    summary="Find anonymous same-route travelers nearby",
)
def get_nearby_travelers(
    body: NearbyTravelersRequest,
    current_user: User = Depends(get_current_user),
):
    return LiveService.get_nearby_travelers(
        current_user.id,
        body.lat,
        body.lng,
        body.bearing,
        body.speed_mph,
    )


@router.get(
    "/travelers/{traveler_id}/chat",
    response_model=list[TravelerChatItemOut],
    status_code=status.HTTP_200_OK,
    summary="Get anonymous traveler chat messages",
)
def get_traveler_chat_messages(
    traveler_id: str,
    sender_session_key: str = Query(..., min_length=1, max_length=64),
    current_user: User = Depends(get_current_user),
):
    return LiveService.get_traveler_chat(
        current_user.id,
        traveler_id,
        sender_session_key,
    )


@router.post(
    "/travelers/{traveler_id}/chat",
    response_model=TravelerChatSendOut,
    status_code=status.HTTP_200_OK,
    summary="Send anonymous traveler chat message",
)
def send_traveler_chat_message(
    traveler_id: str,
    body: TravelerChatSend,
    current_user: User = Depends(get_current_user),
):
    return LiveService.send_traveler_chat(
        current_user.id,
        traveler_id,
        body.text,
        body.sender_session_key,
    )


@router.post(
    "/travelers/{traveler_id}/chat/{message_id}/flag",
    response_model=TravelerChatFlagOut,
    status_code=status.HTTP_200_OK,
    summary="Flag an abusive traveler chat message",
)
def flag_traveler_chat_message(
    traveler_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
):
    return LiveService.flag_traveler_chat_message(
        current_user.id,
        traveler_id,
        message_id,
    )


@router.get(
    "/traffic/density",
    response_model=list[TrafficDensityPoint],
    status_code=status.HTTP_200_OK,
    summary="Traffic density grid from active road reports",
)
def get_traffic_density(
    query: TrafficDensityQuery = Depends(),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return LiveService.get_traffic_density(
        db,
        query.lat,
        query.lng,
        query.radius_km,
    )


@router.get(
    "/route",
    response_model=RouteOut,
    status_code=status.HTTP_200_OK,
    summary="Get driving route from OSRM",
)
def get_live_route(
    query: RouteQuery = Depends(),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return LiveService.get_route(
        query.start_lat,
        query.start_lng,
        query.end_lat,
        query.end_lng,
    )


@router.post(
    "/reports/{report_id}/chat",
    response_model=ReportChatMessageOut,
    status_code=status.HTTP_200_OK,
    summary="Send anonymous chat message for a road report",
)
def send_report_chat_message(
    report_id: uuid.UUID,
    body: ReportChatMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.send_report_chat(
        db,
        current_user.id,
        report_id,
        body.text,
    )


@router.get(
    "/reports/{report_id}/chat",
    response_model=list[ReportChatItemOut],
    status_code=status.HTTP_200_OK,
    summary="Get chat messages for a road report",
)
def get_report_chat_messages(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.get_report_chat(db, report_id)


@router.get(
    "/reports/{report_id}/chat/count",
    response_model=ReportChatCountOut,
    status_code=status.HTTP_200_OK,
    summary="Get chat message count for a road report",
)
def get_report_chat_message_count(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return {"count": LiveService.get_report_chat_count(db, report_id)}


@router.post(
    "/reports/{report_id}/chat/{message_id}/flag",
    response_model=ReportChatFlagOut,
    status_code=status.HTTP_200_OK,
    summary="Flag an abusive chat message",
)
def flag_report_chat_message(
    report_id: uuid.UUID,
    message_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.flag_chat_message(db, report_id, message_id)


@router.get(
    "/group/{trip_id}/validate",
    response_model=GroupValidateOut,
    status_code=status.HTTP_200_OK,
    summary="Validate trip membership for group live mode",
)
def validate_group_live(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.validate_group_member(db, current_user.id, trip_id)


@router.post(
    "/group/{trip_id}/meeting-point",
    response_model=MeetingPointOut,
    status_code=status.HTTP_200_OK,
    summary="Set group meeting point (admin only)",
)
def set_group_meeting_point(
    trip_id: uuid.UUID,
    body: MeetingPointSet,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.set_meeting_point(
        db,
        current_user.id,
        trip_id,
        body.lat,
        body.lng,
        body.label,
    )


@router.delete(
    "/group/{trip_id}/meeting-point",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear group meeting point (admin only)",
)
def delete_group_meeting_point(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LiveService.delete_meeting_point(db, current_user.id, trip_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/group/{trip_id}/status",
    response_model=QuickStatusOut,
    status_code=status.HTTP_200_OK,
    summary="Set quick member status for group live",
)
def set_group_member_status(
    trip_id: uuid.UUID,
    body: QuickStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.set_member_status(
        db,
        current_user.id,
        trip_id,
        body.status,
    )


@router.post(
    "/group/{trip_id}/convoy",
    response_model=ConvoyOut,
    status_code=status.HTTP_200_OK,
    summary="Start convoy mode (admin only)",
)
def start_group_convoy(
    trip_id: uuid.UUID,
    body: ConvoyStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.start_convoy(
        db,
        current_user.id,
        trip_id,
        body.destination_lat,
        body.destination_lng,
        body.destination_name,
    )


@router.delete(
    "/group/{trip_id}/convoy",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="End convoy mode (admin only)",
)
def end_group_convoy(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LiveService.end_convoy(db, current_user.id, trip_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/emergency-contacts",
    response_model=list[EmergencyContactOut],
    status_code=status.HTTP_200_OK,
    summary="List current user's emergency contacts",
)
def list_emergency_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.get_emergency_contacts(db, current_user.id)


@router.post(
    "/emergency-contacts",
    response_model=EmergencyContactOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add an emergency contact",
)
def create_emergency_contact(
    body: EmergencyContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.add_emergency_contact(
        db,
        current_user.id,
        body.name,
        body.phone,
    )


@router.delete(
    "/emergency-contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an emergency contact",
)
def remove_emergency_contact(
    contact_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LiveService.delete_emergency_contact(db, current_user.id, contact_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/sos",
    response_model=SOSResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger SOS alert (FCM to group + SMS template for device)",
)
def trigger_sos(
    body: SOSRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip_uuid: uuid.UUID | None = None
    if body.trip_id:
        try:
            trip_uuid = uuid.UUID(body.trip_id)
        except ValueError:
            trip_uuid = None
    return LiveService.trigger_sos(
        db,
        current_user.id,
        body.lat,
        body.lng,
        trip_uuid,
        body.message,
    )


@router.post(
    "/group/{trip_id}/geofence",
    response_model=GeofenceOut,
    status_code=status.HTTP_200_OK,
    summary="Set group geofence safe zone (admin only)",
)
def set_group_geofence(
    trip_id: uuid.UUID,
    body: GeofenceSet,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.set_geofence(
        db,
        current_user.id,
        trip_id,
        body.center_lat,
        body.center_lng,
        body.radius_m,
        body.label,
    )


@router.delete(
    "/group/{trip_id}/geofence",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear group geofence (admin only)",
)
def delete_group_geofence(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LiveService.delete_geofence(db, current_user.id, trip_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/group/{trip_id}/battery",
    response_model=BatteryUpdateOut,
    status_code=status.HTTP_200_OK,
    summary="Update member battery level in group live",
)
def update_group_battery(
    trip_id: uuid.UUID,
    body: BatteryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.update_battery_level(
        db,
        current_user.id,
        trip_id,
        body.level,
    )
