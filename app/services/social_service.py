"""
app/services/social_service.py — User search, friend requests, blocks
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from app.models.blocked_user import BlockedUser
from app.models.friend_request import FriendRequest
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.social import (
    FriendRequestOut,
    FriendStatus,
    UserPublicProfileOut,
    UserSearchOut,
)
from app.services.notification_service import NotificationService
from app.utils.exceptions import AppException


def _plan_for_users(db: Session, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not user_ids:
        return {}
    rows = db.execute(
        select(Subscription.user_id, Subscription.plan).where(
            Subscription.user_id.in_(user_ids),
        ),
    ).all()
    out: dict[uuid.UUID, str] = {r.user_id: r.plan for r in rows}
    for uid in user_ids:
        out.setdefault(uid, "free")
    return out


def search_users(
    db: Session,
    current_user: User,
    query: str,
    limit: int,
) -> list[UserSearchOut]:
    q_norm = (query or "").strip()
    if not q_norm:
        AppException.bad_request("q is required")

    lim = max(1, min(limit, 50))

    blocked_me = select(BlockedUser.blocker_id).where(
        BlockedUser.blocked_id == current_user.id,
    )
    i_blocked = select(BlockedUser.blocked_id).where(
        BlockedUser.blocker_id == current_user.id,
    )

    phone_term = q_norm

    stmt = (
        select(User)
        .where(
            User.id != current_user.id,
            User.is_active.is_(True),
            User.id.not_in(blocked_me),
            User.id.not_in(i_blocked),
            or_(
                User.full_name.ilike(f"%{q_norm}%"),
                User.username.ilike(f"%{q_norm}%"),
                User.email.ilike(f"%{q_norm}%"),
                User.phone == phone_term,
            ),
        )
        .order_by(User.full_name.asc())
        .limit(lim)
    )
    rows = db.execute(stmt).scalars().all()
    if not rows:
        return []

    cand_ids = [u.id for u in rows]
    plans = _plan_for_users(db, cand_ids)

    fr_rows = (
        db.execute(
            select(FriendRequest).where(
                or_(
                    and_(
                        FriendRequest.sender_id == current_user.id,
                        FriendRequest.receiver_id.in_(cand_ids),
                    ),
                    and_(
                        FriendRequest.receiver_id == current_user.id,
                        FriendRequest.sender_id.in_(cand_ids),
                    ),
                ),
            ),
        )
        .scalars()
        .all()
    )

    by_me_pending: set[uuid.UUID] = set()
    to_me_pending: set[uuid.UUID] = set()
    accepted_with: set[uuid.UUID] = set()

    for fr in fr_rows:
        if fr.status == "accepted":
            if fr.sender_id == current_user.id:
                accepted_with.add(fr.receiver_id)
            else:
                accepted_with.add(fr.sender_id)
        elif fr.status == "pending":
            if fr.sender_id == current_user.id:
                by_me_pending.add(fr.receiver_id)
            else:
                to_me_pending.add(fr.sender_id)

    out: list[UserSearchOut] = []
    for u in rows:
        if u.id in accepted_with:
            st: FriendStatus = "accepted"
        elif u.id in by_me_pending:
            st = "pending_sent"
        elif u.id in to_me_pending:
            st = "pending_received"
        else:
            st = "none"
        out.append(
            UserSearchOut(
                id=u.id,
                full_name=u.full_name,
                username=u.username,
                avatar_url=u.avatar_url,
                profile_picture=u.profile_picture,
                is_verified=u.is_verified,
                whatsapp_verified=bool(u.whatsapp_verified),
                plan=plans.get(u.id, "free"),
                friend_status=st,
            ),
        )
    return out


def _delete_friend_requests_between(db: Session, a: uuid.UUID, b: uuid.UUID) -> None:
    db.execute(
        delete(FriendRequest).where(
            or_(
                and_(FriendRequest.sender_id == a, FriendRequest.receiver_id == b),
                and_(FriendRequest.sender_id == b, FriendRequest.receiver_id == a),
            ),
        ),
    )


def send_friend_request(
    db: Session,
    current_user: User,
    receiver_id: uuid.UUID,
) -> FriendRequestOut:
    if receiver_id == current_user.id:
        AppException.bad_request("Cannot send a connection request to yourself")

    target = db.execute(
        select(User).where(User.id == receiver_id, User.is_active.is_(True)),
    ).scalar_one_or_none()
    if not target:
        AppException.not_found("User not found")

    blocked = db.execute(
        select(BlockedUser).where(
            or_(
                and_(
                    BlockedUser.blocker_id == current_user.id,
                    BlockedUser.blocked_id == receiver_id,
                ),
                and_(
                    BlockedUser.blocker_id == receiver_id,
                    BlockedUser.blocked_id == current_user.id,
                ),
            ),
        ),
    ).scalar_one_or_none()
    if blocked:
        AppException.conflict("Cannot connect with this user")

    row_ab = db.execute(
        select(FriendRequest).where(
            FriendRequest.sender_id == current_user.id,
            FriendRequest.receiver_id == receiver_id,
        ),
    ).scalar_one_or_none()
    row_ba = db.execute(
        select(FriendRequest).where(
            FriendRequest.sender_id == receiver_id,
            FriendRequest.receiver_id == current_user.id,
        ),
    ).scalar_one_or_none()

    if row_ba and row_ba.status in ("pending", "accepted"):
        AppException.conflict("A connection or pending request already exists")
    if row_ab and row_ab.status == "pending":
        AppException.conflict("A request is already pending")
    if row_ab and row_ab.status == "accepted":
        AppException.conflict("You are already connected with this user")

    now = datetime.now(timezone.utc)
    if row_ab and row_ab.status == "declined":
        row_ab.status = "pending"
        row_ab.updated_at = now
        db.commit()
        db.refresh(row_ab)
        fr = row_ab
    elif row_ab is None:
        fr = FriendRequest(
            sender_id=current_user.id,
            receiver_id=receiver_id,
            status="pending",
        )
        db.add(fr)
        db.commit()
        db.refresh(fr)
    else:
        AppException.conflict("Cannot send friend request")

    NotificationService.create_notification(
        db,
        receiver_id,
        "system",
        "New connection request",
        f"{current_user.full_name} wants to connect with you.",
        {"friend_request_id": str(fr.id), "sender_id": str(current_user.id)},
    )
    return FriendRequestOut.model_validate(fr)


def list_received_friend_requests(db: Session, current_user: User) -> list[FriendRequestOut]:
    rows = (
        db.execute(
            select(FriendRequest)
            .where(
                FriendRequest.receiver_id == current_user.id,
                FriendRequest.status == "pending",
            )
            .order_by(FriendRequest.created_at.desc()),
        )
        .scalars()
        .all()
    )
    return [FriendRequestOut.model_validate(r) for r in rows]


def list_sent_friend_requests(db: Session, current_user: User) -> list[FriendRequestOut]:
    rows = (
        db.execute(
            select(FriendRequest)
            .where(
                FriendRequest.sender_id == current_user.id,
                FriendRequest.status == "pending",
            )
            .order_by(FriendRequest.created_at.desc()),
        )
        .scalars()
        .all()
    )
    return [FriendRequestOut.model_validate(r) for r in rows]


def cancel_sent_friend_request(
    db: Session,
    current_user: User,
    request_id: uuid.UUID,
) -> None:
    row = db.execute(
        select(FriendRequest).where(FriendRequest.id == request_id),
    ).scalar_one_or_none()
    if not row:
        AppException.not_found("Friend request not found")
    if row.sender_id != current_user.id:
        AppException.forbidden("Only the sender can cancel this request")
    if row.status != "pending":
        AppException.conflict("This request is no longer pending")
    db.delete(row)
    db.commit()


def accept_friend_request(
    db: Session,
    current_user: User,
    request_id: uuid.UUID,
) -> FriendRequestOut:
    row = db.execute(
        select(FriendRequest).where(FriendRequest.id == request_id),
    ).scalar_one_or_none()
    if not row:
        AppException.not_found("Friend request not found")
    if row.receiver_id != current_user.id:
        AppException.forbidden("Only the recipient can accept this request")
    if row.status != "pending":
        AppException.conflict("This request is no longer pending")

    row.status = "accepted"
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)

    NotificationService.create_notification(
        db,
        row.sender_id,
        "system",
        "Connection request accepted",
        f"{current_user.full_name} accepted your connection request.",
        {"friend_request_id": str(row.id), "receiver_id": str(current_user.id)},
    )
    return FriendRequestOut.model_validate(row)


def decline_friend_request(
    db: Session,
    current_user: User,
    request_id: uuid.UUID,
) -> FriendRequestOut:
    row = db.execute(
        select(FriendRequest).where(FriendRequest.id == request_id),
    ).scalar_one_or_none()
    if not row:
        AppException.not_found("Friend request not found")
    if row.receiver_id != current_user.id:
        AppException.forbidden("Only the recipient can decline this request")
    if row.status != "pending":
        AppException.conflict("This request is no longer pending")

    row.status = "declined"
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return FriendRequestOut.model_validate(row)


def block_user(db: Session, current_user: User, blocked_id: uuid.UUID) -> None:
    if blocked_id == current_user.id:
        AppException.bad_request("Cannot block yourself")

    other = db.execute(select(User).where(User.id == blocked_id)).scalar_one_or_none()
    if not other:
        AppException.not_found("User not found")

    exists = db.execute(
        select(BlockedUser).where(
            BlockedUser.blocker_id == current_user.id,
            BlockedUser.blocked_id == blocked_id,
        ),
    ).scalar_one_or_none()
    if exists:
        return

    _delete_friend_requests_between(db, current_user.id, blocked_id)
    db.add(
        BlockedUser(
            blocker_id=current_user.id,
            blocked_id=blocked_id,
        ),
    )
    db.commit()


def unblock_user(db: Session, current_user: User, blocked_id: uuid.UUID) -> None:
    res = db.execute(
        delete(BlockedUser).where(
            BlockedUser.blocker_id == current_user.id,
            BlockedUser.blocked_id == blocked_id,
        ),
    )
    db.commit()
    if res.rowcount == 0:
        AppException.not_found("Block not found")


def list_connections(db: Session, current_user: User) -> list[UserSearchOut]:
    fr_rows = (
        db.execute(
            select(FriendRequest).where(
                or_(
                    FriendRequest.sender_id == current_user.id,
                    FriendRequest.receiver_id == current_user.id,
                ),
                FriendRequest.status == "accepted",
            ),
        )
        .scalars()
        .all()
    )
    other_ids: list[uuid.UUID] = []
    for fr in fr_rows:
        oid = fr.receiver_id if fr.sender_id == current_user.id else fr.sender_id
        other_ids.append(oid)

    ordered_unique: list[uuid.UUID] = []
    seen: set[uuid.UUID] = set()
    for oid in other_ids:
        if oid not in seen:
            seen.add(oid)
            ordered_unique.append(oid)

    if not ordered_unique:
        return []

    users = (
        db.execute(
            select(User).where(
                User.id.in_(ordered_unique),
                User.is_active.is_(True),
            ),
        )
        .scalars()
        .all()
    )
    by_id = {u.id: u for u in users}
    plans = _plan_for_users(db, ordered_unique)

    out: list[UserSearchOut] = []
    for oid in ordered_unique:
        u = by_id.get(oid)
        if not u:
            continue
        out.append(
            UserSearchOut(
                id=u.id,
                full_name=u.full_name,
                username=u.username,
                avatar_url=u.avatar_url,
                profile_picture=u.profile_picture,
                is_verified=u.is_verified,
                whatsapp_verified=bool(u.whatsapp_verified),
                plan=plans.get(u.id, "free"),
                friend_status="accepted",
            ),
        )
    out.sort(key=lambda x: x.full_name.lower())
    return out


def get_user_public_profile(
    db: Session,
    current_user: User,
    user_id: uuid.UUID,
) -> UserPublicProfileOut:
    """
    Return display fields for another user (or self). Hidden if blocked.
    """
    if user_id == current_user.id:
        u = current_user
    else:
        u = db.execute(
            select(User).where(
                User.id == user_id,
                User.is_active.is_(True),
            ),
        ).scalar_one_or_none()
    if u is None:
        AppException.not_found("User not found")

    if user_id != current_user.id:
        blocked = db.execute(
            select(BlockedUser).where(
                or_(
                    and_(
                        BlockedUser.blocker_id == current_user.id,
                        BlockedUser.blocked_id == user_id,
                    ),
                    and_(
                        BlockedUser.blocker_id == user_id,
                        BlockedUser.blocked_id == current_user.id,
                    ),
                ),
            ),
        ).scalar_one_or_none()
        if blocked:
            AppException.not_found("User not found")

    return UserPublicProfileOut(
        id=u.id,
        full_name=u.full_name,
        username=u.username,
        avatar_url=u.avatar_url,
        profile_picture=u.profile_picture,
    )
