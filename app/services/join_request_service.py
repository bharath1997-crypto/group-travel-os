"""
app/services/join_request_service.py — Group join request business logic

Session is always injected — never created here.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.group import Group, GroupMember, MemberRole
from app.models.group_join_request import GroupJoinRequest
from app.models.user import User
from app.services.group_service import GroupService
from app.utils.exceptions import AppException


class JoinRequestService:
    @staticmethod
    def toggle_membership(
        db: Session,
        group_id: uuid.UUID,
        admin_user_id: uuid.UUID,
    ) -> Group:
        group = db.execute(select(Group).where(Group.id == group_id)).scalar_one_or_none()
        if not group:
            AppException.not_found("Group not found")

        GroupService.require_admin(db, group_id, admin_user_id)

        group.is_accepting_members = not group.is_accepting_members
        db.commit()
        db.refresh(group)
        return group

    @staticmethod
    def request_to_join(
        db: Session,
        invite_code: str,
        user_id: uuid.UUID,
    ) -> GroupJoinRequest:
        code = invite_code.strip()
        group = db.execute(select(Group).where(Group.invite_code == code)).scalar_one_or_none()
        if not group:
            AppException.not_found("Group not found")

        if not group.is_accepting_members:
            AppException.bad_request("This group is not accepting members")

        is_member = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group.id,
                GroupMember.user_id == user_id,
            )
        ).scalar_one_or_none()
        if is_member:
            AppException.conflict("You are already a member")

        existing = db.execute(
            select(GroupJoinRequest).where(
                GroupJoinRequest.group_id == group.id,
                GroupJoinRequest.user_id == user_id,
            )
        ).scalar_one_or_none()

        if existing:
            if existing.status == "pending":
                AppException.conflict("Request already submitted")
            elif existing.status == "denied":
                existing.status = "pending"
                db.commit()
                db.refresh(existing)
                return existing
            AppException.conflict("Request already submitted")

        req = GroupJoinRequest(
            group_id=group.id,
            user_id=user_id,
            status="pending",
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def get_pending_requests(
        db: Session,
        group_id: uuid.UUID,
        admin_user_id: uuid.UUID,
    ) -> list[tuple[GroupJoinRequest, User]]:
        GroupService.require_admin(db, group_id, admin_user_id)

        stmt = (
            select(GroupJoinRequest, User)
            .join(User, User.id == GroupJoinRequest.user_id)
            .where(
                GroupJoinRequest.group_id == group_id,
                GroupJoinRequest.status == "pending",
            )
            .order_by(GroupJoinRequest.created_at.asc())
        )
        rows = db.execute(stmt).all()
        return list(rows)

    @staticmethod
    def approve_request(
        db: Session,
        request_id: uuid.UUID,
        admin_user_id: uuid.UUID,
    ) -> GroupJoinRequest:
        req = db.execute(
            select(GroupJoinRequest).where(GroupJoinRequest.id == request_id)
        ).scalar_one_or_none()
        if not req:
            AppException.not_found("Request not found")

        GroupService.require_admin(db, req.group_id, admin_user_id)

        if req.status != "pending":
            AppException.bad_request("This request is not pending")

        existing_member = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == req.group_id,
                GroupMember.user_id == req.user_id,
            )
        ).scalar_one_or_none()
        if not existing_member:
            db.add(
                GroupMember(
                    group_id=req.group_id,
                    user_id=req.user_id,
                    role=MemberRole.member,
                )
            )

        req.status = "approved"
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def deny_request(
        db: Session,
        request_id: uuid.UUID,
        admin_user_id: uuid.UUID,
    ) -> GroupJoinRequest:
        req = db.execute(
            select(GroupJoinRequest).where(GroupJoinRequest.id == request_id)
        ).scalar_one_or_none()
        if not req:
            AppException.not_found("Request not found")

        GroupService.require_admin(db, req.group_id, admin_user_id)

        if req.status != "pending":
            AppException.bad_request("This request is not pending")

        req.status = "denied"
        db.commit()
        db.refresh(req)
        return req
