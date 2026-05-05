"""
app/services/invitation_service.py — Group invitations and accept/decline
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.group import Group, GroupMember, MemberRole
from app.models.group_invitation import GroupInvitation
from app.models.user import User
from app.services.notification_service import NotificationService
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)


class InvitationService:
    @staticmethod
    def _is_member(
        db: Session,
        group_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        row = db.execute(
            select(GroupMember.id).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id,
            ),
        ).scalar_one_or_none()
        return row is not None

    @staticmethod
    def invite_user_to_group(
        db: Session,
        group_id: uuid.UUID,
        invited_user_id: uuid.UUID,
        current_user: User,
    ) -> GroupInvitation:
        if invited_user_id == current_user.id:
            AppException.bad_request("You cannot invite yourself")

        g = db.execute(
            select(Group).where(Group.id == group_id),
        ).scalar_one_or_none()
        if not g:
            AppException.not_found("Group not found")

        if not InvitationService._is_member(db, group_id, current_user.id):
            AppException.forbidden("You are not a member of this group")

        invitee = db.execute(
            select(User).where(User.id == invited_user_id),
        ).scalar_one_or_none()
        if not invitee:
            AppException.not_found("User not found")

        if InvitationService._is_member(db, group_id, invited_user_id):
            AppException.conflict("User is already a member of this group")

        inv_row = db.execute(
            select(GroupInvitation).where(
                GroupInvitation.group_id == group_id,
                GroupInvitation.invited_user_id == invited_user_id,
            ),
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if inv_row and inv_row.status == "pending":
            AppException.conflict("Invitation already sent to this user")
        if inv_row and inv_row.status == "accepted":
            AppException.conflict("Invitation already sent to this user")

        if inv_row and inv_row.status == "declined":
            inv_row.status = "pending"
            inv_row.invited_by = current_user.id
            inv_row.created_at = now
            inv_row.responded_at = None
            inv = inv_row
        else:
            inv = GroupInvitation(
                group_id=group_id,
                invited_by=current_user.id,
                invited_user_id=invited_user_id,
                status="pending",
            )
            db.add(inv)

        db.flush()
        n = NotificationService.append_in_app(
            db,
            invited_user_id,
            "group_invite",
            f"{current_user.full_name} invited you to {g.name}",
            f"You have been invited to join {g.name}. Tap to accept or decline.",
            {
                "group_id": str(group_id),
                "invitation_id": str(inv.id),
                "group_name": g.name,
                "invited_by_name": current_user.full_name,
            },
        )
        db.commit()
        db.refresh(inv)
        db.refresh(n)

        NotificationService.try_fcm_for_user(
            db,
            invited_user_id,
            n.title,
            n.body,
            notif_type="group_invite",
            notification_id=n.id,
            data={
                "group_id": str(group_id),
                "invitation_id": str(inv.id),
                "group_name": g.name,
            },
        )
        return inv

    @staticmethod
    def respond_to_invitation(
        db: Session,
        invitation_id: uuid.UUID,
        action: str,
        current_user: User,
    ) -> GroupInvitation:
        a = (action or "").lower().strip()
        if a not in ("accept", "decline"):
            AppException.bad_request('action must be "accept" or "decline"')

        inv = db.execute(
            select(GroupInvitation)
            .where(GroupInvitation.id == invitation_id)
            .options(
                selectinload(GroupInvitation.group),
            ),
        ).scalar_one_or_none()
        if not inv:
            AppException.not_found("Invitation not found")
        g = inv.group
        if g is None:
            g = db.get(Group, inv.group_id)
        if g is None:
            AppException.not_found("Group not found")

        if inv.invited_user_id != current_user.id:
            AppException.forbidden("This invitation is not for you")
        if inv.status != "pending":
            AppException.bad_request("Invitation already responded to")

        now = datetime.now(timezone.utc)
        if a == "accept":
            if InvitationService._is_member(db, g.id, current_user.id):
                AppException.conflict("User is already a member of this group")
            m = GroupMember(
                group_id=g.id,
                user_id=current_user.id,
                role=MemberRole.member,
            )
            db.add(m)
            inv.status = "accepted"
            inv.responded_at = now
            inapp = NotificationService.append_in_app(
                db,
                inv.invited_by,
                "invite_accepted",
                f"{current_user.full_name} joined {g.name}",
                f"{current_user.full_name} accepted your invitation to join {g.name}",
                {"group_id": str(g.id), "invitation_id": str(inv.id)},
            )
            db.commit()
            db.refresh(inv)
            db.refresh(inapp)
            NotificationService.try_fcm_for_user(
                db,
                inv.invited_by,
                inapp.title,
                inapp.body,
                notif_type="invite_accepted",
                notification_id=inapp.id,
                data={"group_id": str(g.id)},
            )
        else:
            inv.status = "declined"
            inv.responded_at = now
            inapp = NotificationService.append_in_app(
                db,
                inv.invited_by,
                "invite_declined",
                f"{current_user.full_name} declined {g.name}",
                f"{current_user.full_name} declined your invitation to join {g.name}",
                {"group_id": str(g.id), "invitation_id": str(inv.id)},
            )
            db.commit()
            db.refresh(inv)
            db.refresh(inapp)
            NotificationService.try_fcm_for_user(
                db,
                inv.invited_by,
                inapp.title,
                inapp.body,
                notif_type="invite_declined",
                notification_id=inapp.id,
                data={"group_id": str(g.id)},
            )
        return inv

    @staticmethod
    def get_pending_invitations(
        db: Session,
        current_user: User,
    ) -> list[GroupInvitation]:
        return list(
            db.execute(
                select(GroupInvitation)
                .where(
                    GroupInvitation.invited_user_id == current_user.id,
                    GroupInvitation.status == "pending",
                )
                .options(
                    selectinload(GroupInvitation.group),
                    selectinload(GroupInvitation.inviter),
                )
                .order_by(GroupInvitation.created_at.desc()),
            )
            .scalars()
            .all(),
        )

    @staticmethod
    def get_group_pending_invitations(
        db: Session,
        group_id: uuid.UUID,
        current_user: User,
    ) -> list[GroupInvitation]:
        from app.services.group_service import GroupService

        GroupService.require_admin(db, group_id, current_user.id)
        return list(
            db.execute(
                select(GroupInvitation)
                .where(
                    GroupInvitation.group_id == group_id,
                    GroupInvitation.status == "pending",
                )
                .options(
                    selectinload(GroupInvitation.invited_user),
                )
                .order_by(GroupInvitation.created_at.desc()),
            )
            .scalars()
            .all(),
        )
