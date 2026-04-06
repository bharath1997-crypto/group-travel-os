"""
app/services/group_service.py — Group membership business logic

Rules:
- Session is always injected — never created here
- All errors raised via AppException
"""
from __future__ import annotations

import logging
import secrets
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.group import Group, GroupMember, MemberRole
from app.models.user import User
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)


def _generate_unique_invite_code(
    db: Session,
    *,
    exclude_group_id: uuid.UUID | None = None,
) -> str:
    """8-character codes from secrets.token_urlsafe(6); retry on collision."""
    for _ in range(50):
        code = secrets.token_urlsafe(6)
        q = select(Group.id).where(Group.invite_code == code)
        if exclude_group_id is not None:
            q = q.where(Group.id != exclude_group_id)
        if db.execute(q).scalar_one_or_none() is None:
            return code
    AppException.internal("Could not generate a unique invite code")


class GroupService:

    @staticmethod
    def create_group(
        db: Session,
        name: str,
        description: str | None,
        current_user: User,
    ) -> Group:
        invite_code = _generate_unique_invite_code(db)
        group = Group(
            name=name,
            description=description,
            created_by=current_user.id,
            invite_code=invite_code,
        )
        db.add(group)
        db.flush()

        admin_row = GroupMember(
            group_id=group.id,
            user_id=current_user.id,
            role=MemberRole.admin,
        )
        db.add(admin_row)
        db.commit()
        db.refresh(group)
        logger.info("Group created: %s by user %s", group.id, current_user.id)
        return group

    @staticmethod
    def join_group(
        db: Session,
        invite_code: str,
        current_user: User,
    ) -> Group:
        code = invite_code.strip()
        group = db.execute(
            select(Group).where(Group.invite_code == code)
        ).scalar_one_or_none()
        if not group:
            AppException.not_found("Group not found")

        existing = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group.id,
                GroupMember.user_id == current_user.id,
            )
        ).scalar_one_or_none()
        if existing:
            AppException.conflict("You are already a member of this group")

        member = GroupMember(
            group_id=group.id,
            user_id=current_user.id,
            role=MemberRole.member,
        )
        db.add(member)
        db.commit()
        db.refresh(group)
        logger.info("User %s joined group %s", current_user.id, group.id)
        return group

    @staticmethod
    def get_group(
        db: Session,
        group_id: uuid.UUID,
        current_user: User,
    ) -> Group:
        group = db.execute(select(Group).where(Group.id == group_id)).scalar_one_or_none()
        if not group:
            AppException.not_found("Group not found")

        membership = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group.id,
                GroupMember.user_id == current_user.id,
            )
        ).scalar_one_or_none()
        if not membership:
            AppException.forbidden("You are not a member of this group")

        return group

    @staticmethod
    def list_user_groups(db: Session, current_user: User) -> list[Group]:
        rows = db.execute(
            select(Group)
            .join(GroupMember, Group.id == GroupMember.group_id)
            .where(GroupMember.user_id == current_user.id)
        ).scalars().all()
        return list(rows)

    @staticmethod
    def remove_member(
        db: Session,
        group_id: uuid.UUID,
        user_id: uuid.UUID,
        current_user: User,
    ) -> None:
        GroupService.require_admin(db, group_id, current_user.id)

        target = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not target:
            AppException.not_found("Member not found in this group")

        admin_count = db.execute(
            select(func.count())
            .select_from(GroupMember)
            .where(
                GroupMember.group_id == group_id,
                GroupMember.role == MemberRole.admin,
            )
        ).scalar_one()

        if (
            user_id == current_user.id
            and target.role == MemberRole.admin
            and admin_count == 1
        ):
            AppException.bad_request("Cannot remove yourself as the only admin of the group")

        db.delete(target)
        db.commit()
        logger.info(
            "Removed user %s from group %s (by %s)",
            user_id,
            group_id,
            current_user.id,
        )

    @staticmethod
    def require_admin(db: Session, group_id: uuid.UUID, user_id: uuid.UUID) -> None:
        row = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id,
                GroupMember.role == MemberRole.admin,
            )
        ).scalar_one_or_none()
        if not row:
            AppException.forbidden("Group admin privileges required")

    @staticmethod
    def regenerate_invite_code(
        db: Session,
        group_id: uuid.UUID,
        current_user: User,
    ) -> Group:
        GroupService.require_admin(db, group_id, current_user.id)

        group = db.execute(select(Group).where(Group.id == group_id)).scalar_one_or_none()
        if not group:
            AppException.not_found("Group not found")

        group.invite_code = _generate_unique_invite_code(db, exclude_group_id=group.id)
        db.commit()
        db.refresh(group)
        logger.info("Invite code regenerated for group %s", group_id)
        return group
