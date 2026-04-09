"""
app/routes/join_requests.py — Group join requests and membership toggle

Mount with prefix /api/v1. Register before the groups router so
POST /groups/join is handled here (request flow) instead of immediate join.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.group import GroupOut, group_to_out
from app.services.join_request_service import JoinRequestService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(tags=["Join requests"])


class JoinRequest(BaseModel):
    invite_code: str = Field(..., min_length=6, max_length=12)


class JoinRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    group_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    created_at: datetime


class PendingRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    status: str
    created_at: datetime
    user_full_name: str
    user_email: str


@router.patch(
    "/groups/{group_id}/toggle-membership",
    response_model=GroupOut,
    status_code=status.HTTP_200_OK,
    summary="Toggle whether the group accepts new members (admins only)",
)
def toggle_membership_accepting(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = JoinRequestService.toggle_membership(db, group_id, current_user.id)
    return group_to_out(group)


@router.post(
    "/groups/join",
    response_model=JoinRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Request to join a group by invite code",
)
def submit_join_request(
    body: JoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = JoinRequestService.request_to_join(db, body.invite_code, current_user.id)
    return JoinRequestOut.model_validate(req)


@router.get(
    "/groups/{group_id}/join-requests",
    response_model=list[PendingRequestOut],
    status_code=status.HTTP_200_OK,
    summary="List pending join requests (group admins only)",
)
def list_pending_join_requests(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = JoinRequestService.get_pending_requests(db, group_id, current_user.id)
    return [
        PendingRequestOut(
            id=req.id,
            user_id=req.user_id,
            status=req.status,
            created_at=req.created_at,
            user_full_name=user.full_name,
            user_email=user.email,
        )
        for req, user in rows
    ]


@router.patch(
    "/groups/join-requests/{request_id}/approve",
    response_model=JoinRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Approve a join request (group admin)",
)
def approve_join_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = JoinRequestService.approve_request(db, request_id, current_user.id)
    return JoinRequestOut.model_validate(req)


@router.patch(
    "/groups/join-requests/{request_id}/deny",
    response_model=JoinRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Deny a join request (group admin)",
)
def deny_join_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = JoinRequestService.deny_request(db, request_id, current_user.id)
    return JoinRequestOut.model_validate(req)
