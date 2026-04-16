"""
Request to join a trip’s group (trip ID share flow).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.group import Group, GroupMember, MemberRole
from app.models.trip import Trip
from app.models.trip_join_request import TripJoinRequest
from app.models.user import User
from app.services.group_service import GroupService
from app.utils.exceptions import AppException


class TripJoinRequestService:
    @staticmethod
    def request_join(
        db: Session,
        trip_id: uuid.UUID,
        user_id: uuid.UUID,
        message: str | None,
    ) -> TripJoinRequest:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        group_id = trip.group_id

        group = db.execute(select(Group).where(Group.id == group_id)).scalar_one_or_none()
        if not group:
            AppException.not_found("Group not found")
        if not group.is_accepting_members:
            AppException.bad_request("This group is not accepting new members")

        existing_member = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id,
            )
        ).scalar_one_or_none()
        if existing_member:
            AppException.conflict("You are already a member of this trip’s group")

        existing = db.execute(
            select(TripJoinRequest).where(
                TripJoinRequest.trip_id == trip_id,
                TripJoinRequest.user_id == user_id,
            )
        ).scalar_one_or_none()

        if existing:
            if existing.status == "pending":
                AppException.conflict("Join request already pending")
            if existing.status == "denied":
                existing.status = "pending"
                existing.message = (message or "").strip() or None
                existing.updated_at = datetime.now(timezone.utc)
                db.commit()
                db.refresh(existing)
                return existing
            AppException.conflict("This join request was already handled")

        req = TripJoinRequest(
            trip_id=trip_id,
            user_id=user_id,
            message=(message or "").strip() or None,
            status="pending",
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def list_pending_for_trip(
        db: Session,
        trip_id: uuid.UUID,
        admin_user_id: uuid.UUID,
    ) -> list[tuple[TripJoinRequest, User]]:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        GroupService.require_admin(db, trip.group_id, admin_user_id)

        stmt = (
            select(TripJoinRequest, User)
            .join(User, User.id == TripJoinRequest.user_id)
            .where(
                TripJoinRequest.trip_id == trip_id,
                TripJoinRequest.status == "pending",
            )
            .order_by(TripJoinRequest.created_at.asc())
        )
        return list(db.execute(stmt).all())

    @staticmethod
    def approve_request(
        db: Session,
        request_id: uuid.UUID,
        admin_user_id: uuid.UUID,
    ) -> TripJoinRequest:
        req = db.execute(
            select(TripJoinRequest).where(TripJoinRequest.id == request_id)
        ).scalar_one_or_none()
        if not req:
            AppException.not_found("Request not found")

        trip = db.execute(select(Trip).where(Trip.id == req.trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        GroupService.require_admin(db, trip.group_id, admin_user_id)

        if req.status != "pending":
            AppException.bad_request("Request is not pending")

        existing_member = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == trip.group_id,
                GroupMember.user_id == req.user_id,
            )
        ).scalar_one_or_none()
        if not existing_member:
            member = GroupMember(
                group_id=trip.group_id,
                user_id=req.user_id,
                role=MemberRole.member,
            )
            db.add(member)

        req.status = "approved"
        req.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def deny_request(
        db: Session,
        request_id: uuid.UUID,
        admin_user_id: uuid.UUID,
    ) -> TripJoinRequest:
        req = db.execute(
            select(TripJoinRequest).where(TripJoinRequest.id == request_id)
        ).scalar_one_or_none()
        if not req:
            AppException.not_found("Request not found")

        trip = db.execute(select(Trip).where(Trip.id == req.trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        GroupService.require_admin(db, trip.group_id, admin_user_id)

        if req.status != "pending":
            AppException.bad_request("Request is not pending")

        req.status = "denied"
        req.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(req)
        return req
