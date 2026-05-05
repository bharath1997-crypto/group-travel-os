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
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.expense import Expense, ExpenseSplit
from app.models.group import Group, GroupMember, MemberRole
from app.models.trip import Trip
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
        group_type: str = "regular",
        default_currency: str = "INR",
    ) -> Group:
        invite_code = _generate_unique_invite_code(db)
        dc = (default_currency or "INR").strip().upper()[:10]
        group = Group(
            name=name,
            description=description,
            group_type=group_type,
            created_by=current_user.id,
            invite_code=invite_code,
            default_currency=dc,
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
        from app.services.notification_service import NotificationService

        NotificationService.on_user_joined_group(db, group, current_user)
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
            .options(selectinload(Group.members).joinedload(GroupMember.user))
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

    @staticmethod
    def leave_group(
        db: Session,
        group_id: uuid.UUID,
        current_user: User,
    ) -> bool:
        """Leave the group. Returns True if the group was deleted (sole admin left)."""
        member = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == current_user.id,
            )
        ).scalar_one_or_none()
        if not member:
            AppException.not_found("Not a member of this group")

        group = db.execute(select(Group).where(Group.id == group_id)).scalar_one_or_none()
        if not group:
            AppException.not_found("Group not found")

        admin_count = db.execute(
            select(func.count())
            .select_from(GroupMember)
            .where(
                GroupMember.group_id == group_id,
                GroupMember.role == MemberRole.admin,
            )
        ).scalar_one()
        member_count = db.execute(
            select(func.count())
            .select_from(GroupMember)
            .where(GroupMember.group_id == group_id)
        ).scalar_one()

        if member.role == MemberRole.admin and admin_count == 1 and member_count > 1:
            AppException.bad_request("Assign another admin before leaving")

        if group.group_type == "travel":
            trip_ids = db.execute(
                select(Trip.id).where(Trip.group_id == group_id)
            ).scalars().all()
            if trip_ids:
                h1 = db.execute(
                    select(ExpenseSplit.id)
                    .join(Expense, ExpenseSplit.expense_id == Expense.id)
                    .where(
                        Expense.trip_id.in_(trip_ids),
                        ExpenseSplit.user_id == current_user.id,
                        ExpenseSplit.is_settled.is_(False),
                    )
                    .limit(1)
                ).first()
                h2 = db.execute(
                    select(ExpenseSplit.id)
                    .join(Expense, ExpenseSplit.expense_id == Expense.id)
                    .where(
                        Expense.trip_id.in_(trip_ids),
                        Expense.paid_by == current_user.id,
                        ExpenseSplit.is_settled.is_(False),
                    )
                    .limit(1)
                ).first()
                if h1 is not None or h2 is not None:
                    AppException.bad_request(
                        "Settle all balances before leaving this travel group"
                    )

        if member_count == 1:
            db.delete(group)
            db.commit()
            logger.info(
                "Sole member %s left group %s; group deleted",
                current_user.id,
                group_id,
            )
            return True

        db.delete(member)
        db.commit()
        logger.info("User %s left group %s", current_user.id, group_id)
        return False

    @staticmethod
    def delete_group(
        db: Session,
        group_id: uuid.UUID,
        current_user: User,
    ) -> None:
        """Admin-only hard delete: dissolves the group, members, trips, and expenses."""
        GroupService.require_admin(db, group_id, current_user.id)
        group = db.execute(
            select(Group).where(Group.id == group_id)
        ).scalar_one_or_none()
        if not group:
            AppException.not_found("Group not found")
        db.delete(group)
        db.commit()
        logger.info("Group %s deleted by admin %s", group_id, current_user.id)

    @staticmethod
    def change_member_role(
        db: Session,
        group_id: uuid.UUID,
        target_user_id: uuid.UUID,
        new_role: MemberRole,
        current_user: User,
    ) -> GroupMember:
        """Promote/demote a member. Admin-only; cannot demote the sole admin."""
        GroupService.require_admin(db, group_id, current_user.id)

        target = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == target_user_id,
            )
        ).scalar_one_or_none()
        if not target:
            AppException.not_found("Member not found in this group")

        if target.role == new_role:
            return target

        if (
            target.role == MemberRole.admin
            and new_role == MemberRole.member
        ):
            admin_count = db.execute(
                select(func.count())
                .select_from(GroupMember)
                .where(
                    GroupMember.group_id == group_id,
                    GroupMember.role == MemberRole.admin,
                )
            ).scalar_one()
            if admin_count <= 1:
                AppException.bad_request(
                    "Cannot demote the sole admin; promote another member first"
                )

        target.role = new_role
        db.commit()
        db.refresh(target)
        logger.info(
            "Group %s: user %s role -> %s (by %s)",
            group_id,
            target_user_id,
            new_role.value,
            current_user.id,
        )
        return target

    @staticmethod
    def get_pending_balances_count(
        db: Session,
        group_id: uuid.UUID,
        requesting_user_id: uuid.UUID,
    ) -> dict:
        GroupService.require_admin(db, group_id, requesting_user_id)

        group = db.execute(select(Group).where(Group.id == group_id)).scalar_one_or_none()
        if not group:
            AppException.not_found("Group not found")

        trip_ids = db.execute(
            select(Trip.id).where(Trip.group_id == group_id)
        ).scalars().all()
        if not trip_ids:
            return {"pending_member_count": 0, "can_close": True}

        uids = db.execute(
            select(ExpenseSplit.user_id)
            .join(Expense, ExpenseSplit.expense_id == Expense.id)
            .where(
                Expense.trip_id.in_(trip_ids),
                ExpenseSplit.is_settled.is_(False),
            )
            .distinct()
        ).scalars().all()
        n = len({u for u in uids})
        return {"pending_member_count": n, "can_close": n == 0}

    @staticmethod
    def get_balance_with_user(
        db: Session,
        current_user_id: uuid.UUID,
        other_user_id: uuid.UUID,
    ) -> dict:
        if other_user_id == current_user_id:
            AppException.bad_request("Cannot check balance with yourself")

        other = db.execute(select(User).where(User.id == other_user_id)).scalar_one_or_none()
        if not other:
            AppException.not_found("User not found")

        shared = db.execute(
            select(GroupMember.group_id)
            .where(
                GroupMember.user_id == other_user_id,
                GroupMember.group_id.in_(
                    select(GroupMember.group_id).where(
                        GroupMember.user_id == current_user_id
                    )
                ),
            )
        ).scalars().all()
        if not shared:
            return {
                "other_user_id": str(other_user_id),
                "other_user_name": other.full_name,
                "total_net": 0.0,
                "by_group": [],
            }

        by_group: list[dict] = []
        total_net = 0.0

        for gid in shared:
            g = db.execute(select(Group).where(Group.id == gid)).scalar_one_or_none()
            if not g:
                continue
            trip_ids = db.execute(
                select(Trip.id).where(Trip.group_id == gid)
            ).scalars().all()
            if not trip_ids:
                by_group.append(
                    {
                        "group_id": str(g.id),
                        "group_name": g.name,
                        "group_type": g.group_type,
                        "net_amount": 0.0,
                        "is_settled": True,
                    }
                )
                continue

            they_owe = db.execute(
                select(
                    func.coalesce(func.sum(ExpenseSplit.amount), 0.0)
                )
                .select_from(ExpenseSplit)
                .join(Expense, ExpenseSplit.expense_id == Expense.id)
                .where(
                    Expense.trip_id.in_(trip_ids),
                    Expense.paid_by == current_user_id,
                    ExpenseSplit.user_id == other_user_id,
                    ExpenseSplit.is_settled.is_(False),
                )
            ).scalar_one()
            you_owe = db.execute(
                select(
                    func.coalesce(func.sum(ExpenseSplit.amount), 0.0)
                )
                .select_from(ExpenseSplit)
                .join(Expense, ExpenseSplit.expense_id == Expense.id)
                .where(
                    Expense.trip_id.in_(trip_ids),
                    Expense.paid_by == other_user_id,
                    ExpenseSplit.user_id == current_user_id,
                    ExpenseSplit.is_settled.is_(False),
                )
            ).scalar_one()

            net = float(they_owe) - float(you_owe)
            total_net += net
            by_group.append(
                {
                    "group_id": str(g.id),
                    "group_name": g.name,
                    "group_type": g.group_type,
                    "net_amount": net,
                    "is_settled": abs(net) < 1e-9,
                }
            )

        return {
            "other_user_id": str(other_user_id),
            "other_user_name": other.full_name,
            "total_net": total_net,
            "by_group": by_group,
        }
