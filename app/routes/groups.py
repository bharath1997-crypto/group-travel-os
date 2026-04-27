"""
app/routes/groups.py — Group endpoints

Routes are thin: accept request, call service, return response.
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupDetail,
    GroupMemberOut,
    GroupOut,
    InviteCodeOut,
    JoinGroupRequest,
    group_member_to_out,
    group_to_detail,
    group_to_out,
)
from app.services.group_service import GroupService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.post(
    "",
    response_model=GroupOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new group",
)
def create_group(
    data: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = GroupService.create_group(
        db, data.name, data.description, current_user, data.group_type
    )
    return group_to_out(group)


@router.get(
    "",
    response_model=list[GroupOut],
    status_code=status.HTTP_200_OK,
    summary="List groups you belong to",
)
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    groups = GroupService.list_user_groups(db, current_user)
    return [group_to_out(g) for g in groups]


@router.post(
    "/join",
    response_model=GroupOut,
    status_code=status.HTTP_200_OK,
    summary="Join a group using an invite code",
)
def join_group(
    data: JoinGroupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = GroupService.join_group(db, data.invite_code, current_user)
    return group_to_out(group)


@router.get(
    "/{group_id}/members",
    response_model=list[GroupMemberOut],
    status_code=status.HTTP_200_OK,
    summary="List members of a group (you must be a member)",
)
def list_group_members(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = GroupService.get_group(db, group_id, current_user)
    return [group_member_to_out(m) for m in group.members]


@router.get(
    "/{group_id}",
    response_model=GroupDetail,
    status_code=status.HTTP_200_OK,
    summary="Get a group by id",
)
def get_group(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = GroupService.get_group(db, group_id, current_user)
    return group_to_detail(group)


@router.delete(
    "/{group_id}/leave",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Leave the group",
)
def leave_group(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    GroupService.leave_group(db, group_id, current_user)


@router.get(
    "/{group_id}/close-check",
    status_code=status.HTTP_200_OK,
    summary="Unsettled-balance count before closing a group (admin only)",
)
def close_group_check(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return GroupService.get_pending_balances_count(db, group_id, current_user.id)


@router.delete(
    "/{group_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member from the group",
)
def remove_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    GroupService.remove_member(db, group_id, user_id, current_user)


@router.post(
    "/{group_id}/invite/regenerate",
    response_model=InviteCodeOut,
    status_code=status.HTTP_200_OK,
    summary="Regenerate the group invite code (admins only)",
)
def regenerate_invite_code(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = GroupService.regenerate_invite_code(db, group_id, current_user)
    return InviteCodeOut(invite_code=group.invite_code)
