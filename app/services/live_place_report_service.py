from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.live_place_report import (
    PLACE_REPORT_CONFIRM_THRESHOLD,
    PLACE_REPORT_TTL_MINUTES,
    LivePlaceReport,
    LivePlaceReportType,
)
from app.models.user import User
from app.schemas.live_place_reports import (
    LivePlaceReportCreateRequest,
    LivePlaceReportCreateResponse,
    LivePlaceReportNearbyResponse,
    LivePlaceReportSummary,
)


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    return 2.0 * r * math.asin(math.sqrt(a))


def _place_cluster_key(lat: float, lng: float, place_key: str | None) -> str:
    if place_key and place_key.strip():
        return place_key.strip().lower()
    return f"{round(lat, 4)}:{round(lng, 4)}"


def _bbox_for_radius(lat: float, lng: float, radius_m: float) -> tuple[float, float, float, float]:
    lat_delta = radius_m / 111_320.0
    lng_scale = max(math.cos(math.radians(lat)), 0.01)
    lng_delta = radius_m / (111_320.0 * lng_scale)
    return lat - lat_delta, lat + lat_delta, lng - lng_delta, lng + lng_delta


def _summarize_clusters(
    reports: list[LivePlaceReport],
) -> list[LivePlaceReportSummary]:
    grouped: dict[tuple[str, str], list[LivePlaceReport]] = defaultdict(list)
    for report in reports:
        cluster = _place_cluster_key(report.lat, report.lng, report.place_key)
        grouped[(cluster, report.report_type.value)].append(report)

    summaries: list[LivePlaceReportSummary] = []
    for (cluster_key, report_type), cluster_reports in grouped.items():
        match_count = len(cluster_reports)
        latest = max(cluster_reports, key=lambda row: row.created_at)
        summaries.append(
            LivePlaceReportSummary(
                reportType=report_type,  # type: ignore[arg-type]
                lat=latest.lat,
                lng=latest.lng,
                placeName=latest.place_name,
                placeKey=cluster_key if not cluster_key.startswith(f"{round(latest.lat, 4)}:") else latest.place_key,
                matchCount=match_count,
                confirmed=match_count >= PLACE_REPORT_CONFIRM_THRESHOLD,
                latestAt=latest.created_at,
            )
        )

    summaries.sort(key=lambda row: row.latestAt, reverse=True)
    return summaries


class LivePlaceReportService:
    @staticmethod
    def create_report(
        db: Session,
        user: User,
        body: LivePlaceReportCreateRequest,
    ) -> LivePlaceReportCreateResponse:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=PLACE_REPORT_TTL_MINUTES)
        report_type = LivePlaceReportType(body.reportType)
        place_key = body.placeKey.strip() if body.placeKey else None
        place_name = body.placeName.strip() if body.placeName else None

        row = LivePlaceReport(
            reporter_id=user.id,
            report_type=report_type,
            lat=body.lat,
            lng=body.lng,
            place_name=place_name,
            place_key=place_key,
            expires_at=expires_at,
            created_at=now,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        cluster_key = _place_cluster_key(body.lat, body.lng, place_key)
        active = LivePlaceReportService._active_reports_near(
            db,
            body.lat,
            body.lng,
            radius_m=120.0,
            now=now,
        )
        match_count = sum(
            1
            for item in active
            if item.report_type == report_type
            and _place_cluster_key(item.lat, item.lng, item.place_key) == cluster_key
        )

        return LivePlaceReportCreateResponse(
            id=row.id,
            reportType=body.reportType,
            lat=row.lat,
            lng=row.lng,
            placeName=row.place_name,
            expiresAt=row.expires_at,
            matchCount=match_count,
            confirmed=match_count >= PLACE_REPORT_CONFIRM_THRESHOLD,
        )

    @staticmethod
    def list_nearby(
        db: Session,
        lat: float,
        lng: float,
        radius_m: float = 2500.0,
    ) -> LivePlaceReportNearbyResponse:
        now = datetime.now(timezone.utc)
        active = LivePlaceReportService._active_reports_near(db, lat, lng, radius_m, now)
        return LivePlaceReportNearbyResponse(
            reports=_summarize_clusters(active),
            ttlMinutes=PLACE_REPORT_TTL_MINUTES,
            confirmThreshold=PLACE_REPORT_CONFIRM_THRESHOLD,
        )

    @staticmethod
    def _active_reports_near(
        db: Session,
        lat: float,
        lng: float,
        radius_m: float,
        now: datetime,
    ) -> list[LivePlaceReport]:
        min_lat, max_lat, min_lng, max_lng = _bbox_for_radius(lat, lng, radius_m)
        result = db.execute(
            select(LivePlaceReport).where(
                LivePlaceReport.expires_at > now,
                LivePlaceReport.lat >= min_lat,
                LivePlaceReport.lat <= max_lat,
                LivePlaceReport.lng >= min_lng,
                LivePlaceReport.lng <= max_lng,
            )
        )
        rows = list(result.scalars().all())
        return [row for row in rows if _haversine_m(lat, lng, row.lat, row.lng) <= radius_m]
