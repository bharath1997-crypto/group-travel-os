"""
app/routes/social.py — User search, friend requests, blocks, connections
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.friend_request import FriendRequest
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.social import (
    BlockUserBody,
    FriendRequestCreate,
    FriendRequestOut,
    UserPublicProfileOut,
    UserSearchOut,
)
from app.services.social_service import (
    accept_friend_request as svc_accept_friend_request,
    block_user as svc_block_user,
    decline_friend_request as svc_decline_friend_request,
    get_user_public_profile as svc_get_user_public_profile,
    list_blocked_users as svc_list_blocked_users,
    list_connections as svc_list_connections,
    list_received_friend_requests as svc_list_received_friend_requests,
    search_users as svc_search_users,
    send_friend_request as svc_send_friend_request,
    unblock_user as svc_unblock_user,
)
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

router = APIRouter(tags=["Social"])


class FriendRequestSentOut(FriendRequestOut):
    """Friend request with the receiver profile for outbox listing."""

    receiver: UserSearchOut


@router.get(
    "/users/search",
    response_model=list[UserSearchOut],
    summary="Search users by name, username, or exact phone",
)
def search_users(
    q: str = Query("", max_length=200),
    limit: int = Query(20, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return svc_search_users(db, current_user, q, limit)


@router.get(
    "/users/{user_id}",
    response_model=UserPublicProfileOut,
    summary="User profile (name and avatars) for display",
)
def get_user_by_id(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return svc_get_user_public_profile(db, current_user, user_id)


@router.post(
    "/social/friend-requests",
    response_model=FriendRequestOut,
    summary="Send a connection request",
)
def create_friend_request(
    body: FriendRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return svc_send_friend_request(db, current_user, body.receiver_id)


@router.get(
    "/social/friend-requests",
    response_model=list[FriendRequestOut],
    summary="Pending connection requests you received",
)
def list_friend_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return svc_list_received_friend_requests(db, current_user)


@router.get(
    "/social/friend-requests/sent",
    response_model=list[FriendRequestSentOut],
    summary="Pending connection requests you sent",
)
def list_sent_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
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
    if not rows:
        return []

    receiver_ids = [r.receiver_id for r in rows]
    plan_rows = db.execute(
        select(Subscription.user_id, Subscription.plan).where(
            Subscription.user_id.in_(receiver_ids),
        ),
    ).all()
    plans: dict[uuid.UUID, str] = {pr.user_id: pr.plan for pr in plan_rows}
    for rid in receiver_ids:
        plans.setdefault(rid, "free")

    users = {
        u.id: u
        for u in db.execute(
            select(User).where(User.id.in_(receiver_ids)),
        )
        .scalars()
        .all()
    }

    out: list[FriendRequestSentOut] = []
    for fr in rows:
        u = users.get(fr.receiver_id)
        if u is None:
            continue
        base = FriendRequestOut.model_validate(fr)
        out.append(
            FriendRequestSentOut(
                **base.model_dump(),
                receiver=UserSearchOut(
                    id=u.id,
                    full_name=u.full_name,
                    username=u.username,
                    avatar_url=u.avatar_url,
                    profile_picture=u.profile_picture,
                    is_verified=u.is_verified,
                    whatsapp_verified=bool(u.whatsapp_verified),
                    plan=plans.get(u.id, "free"),
                    friend_status="pending_sent",
                ),
            ),
        )
    return out


@router.delete(
    "/social/friend-requests/{request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Cancel a pending request you sent",
)
def delete_friend_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
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
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/social/friend-requests/{request_id}/accept",
    response_model=FriendRequestOut,
    summary="Accept a connection request",
)
def accept_friend_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return svc_accept_friend_request(db, current_user, request_id)


@router.patch(
    "/social/friend-requests/{request_id}/decline",
    response_model=FriendRequestOut,
    summary="Decline a connection request",
)
def decline_friend_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return svc_decline_friend_request(db, current_user, request_id)


@router.post(
    "/social/block",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Block a user and remove friend requests between you",
)
def block_user(
    body: BlockUserBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    svc_block_user(db, current_user, body.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/social/block/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Unblock a user",
)
def unblock_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    svc_unblock_user(db, current_user, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/social/blocked",
    response_model=list[UserSearchOut],
    summary="Users you have blocked",
)
def list_blocked(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return svc_list_blocked_users(db, current_user)


@router.get(
    "/social/connections",
    response_model=list[UserSearchOut],
    summary="Accepted connections",
)
def list_connections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return svc_list_connections(db, current_user)
