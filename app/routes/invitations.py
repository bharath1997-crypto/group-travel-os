"""
app/routes/invitations.py — Group invitation HTTP API
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.invitation import (
    GroupPendingInviteRowOut,
    GroupInvitationOut,
    InviteUserIn,
    PendingInvitationListItemOut,
)
from app.services.invitation_service import InvitationService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/invitations", tags=["Invitations"])


def _inv_to_out(row: Any) -> GroupInvitationOut:
    return GroupInvitationOut.model_validate(row)


@router.post(
    "/group/{group_id}/invite",
    response_model=GroupInvitationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a user to a group (members only)",
)
def invite_to_group(
    group_id: uuid.UUID,
    body: InviteUserIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    inv = InvitationService.invite_user_to_group(
        db,
        group_id,
        body.user_id,
        current_user,
    )
    return _inv_to_out(inv)


@router.post(
    "/{invitation_id}/accept",
    response_model=GroupInvitationOut,
    status_code=status.HTTP_200_OK,
    summary="Accept a group invitation",
)
def accept_invitation(
    invitation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    inv = InvitationService.respond_to_invitation(
        db, invitation_id, "accept", current_user
    )
    return _inv_to_out(inv)


@router.post(
    "/{invitation_id}/decline",
    response_model=GroupInvitationOut,
    status_code=status.HTTP_200_OK,
    summary="Decline a group invitation",
)
def decline_invitation(
    invitation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    inv = InvitationService.respond_to_invitation(
        db, invitation_id, "decline", current_user
    )
    return _inv_to_out(inv)


@router.get(
    "/pending",
    response_model=list[PendingInvitationListItemOut],
    status_code=status.HTTP_200_OK,
    summary="List pending invitations for the current user",
)
def list_my_pending(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    rows = InvitationService.get_pending_invitations(db, current_user)
    out: list[PendingInvitationListItemOut] = []
    for r in rows:
        gn = r.group.name if r.group else "Group"
        invn = r.inviter.full_name if r.inviter else "Someone"
        out.append(
            PendingInvitationListItemOut(
                id=r.id,
                group_id=r.group_id,
                group_name=gn,
                invited_by_id=r.invited_by,
                invited_by_name=invn,
                created_at=r.created_at,
            ),
        )
    return out


@router.get(
    "/group/{group_id}/pending",
    response_model=list[GroupPendingInviteRowOut],
    status_code=status.HTTP_200_OK,
    summary="List pending invitations for a group (admins only)",
)
def list_group_pending(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    rows = InvitationService.get_group_pending_invitations(
        db, group_id, current_user
    )
    out: list[GroupPendingInviteRowOut] = []
    for r in rows:
        u = r.invited_user
        if not u:
            continue
        out.append(
            GroupPendingInviteRowOut(
                id=r.id,
                invited_user_id=r.invited_user_id,
                invited_user_name=u.full_name,
                invited_user_email=u.email,
                created_at=r.created_at,
            ),
        )
    return out
