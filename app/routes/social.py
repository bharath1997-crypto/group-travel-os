"""
app/routes/social.py — User search, friend requests, blocks, connections
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.social import (
    BlockUserBody,
    FriendRequestCreate,
    FriendRequestOut,
    UserSearchOut,
)
from app.services.social_service import (
    accept_friend_request as svc_accept_friend_request,
    block_user as svc_block_user,
    decline_friend_request as svc_decline_friend_request,
    list_connections as svc_list_connections,
    list_received_friend_requests as svc_list_received_friend_requests,
    search_users as svc_search_users,
    send_friend_request as svc_send_friend_request,
    unblock_user as svc_unblock_user,
)
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(tags=["Social"])


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
    "/social/connections",
    response_model=list[UserSearchOut],
    summary="Accepted connections",
)
def list_connections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return svc_list_connections(db, current_user)
