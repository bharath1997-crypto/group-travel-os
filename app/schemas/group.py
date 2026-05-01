"""
app/schemas/group.py — Group request and response schemas (Pydantic v2)
"""
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.group import Group, GroupMember, MemberRole


def _member_online(last_seen: datetime | None) -> bool:
    if last_seen is None:
        return False
    return datetime.now(timezone.utc) - last_seen < timedelta(minutes=2)


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: str | None = Field(None, max_length=500)
    group_type: Literal["travel", "regular"] = "regular"
    default_currency: str = Field(default="INR", min_length=3, max_length=10)


class GroupUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=120)
    description: str | None = Field(None, max_length=500)


class GroupMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    full_name: str
    avatar_url: str | None
    role: MemberRole
    joined_at: datetime
    last_seen_at: datetime | None = None
    is_online: bool = False
    has_mobile_app: bool = False


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    group_type: str = "regular"
    description: str | None
    invite_code: str
    is_accepting_members: bool = True
    created_by: UUID
    created_at: datetime
    default_currency: str = "INR"
    members: list[GroupMemberOut] = Field(default_factory=list)


class GroupDetail(GroupOut):
    """Group detail (same fields as GroupOut, including group_type)."""

    pass


class JoinGroupRequest(BaseModel):
    invite_code: str = Field(..., min_length=6, max_length=12)


class InviteCodeOut(BaseModel):
    invite_code: str


class MemberRoleUpdate(BaseModel):
    role: MemberRole


class LeaveGroupOut(BaseModel):
    """Result of leaving a group; `deleted` is true when the group was dissolved (e.g. sole admin left)."""

    deleted: bool = False


def group_member_to_out(member: GroupMember) -> GroupMemberOut:
    """Build GroupMemberOut from ORM (pulls profile fields from member.user)."""
    u = member.user
    return GroupMemberOut(
        id=member.id,
        user_id=member.user_id,
        full_name=u.full_name,
        avatar_url=u.avatar_url,
        role=member.role,
        joined_at=member.joined_at,
        last_seen_at=member.last_seen_at,
        is_online=_member_online(member.last_seen_at),
        has_mobile_app=bool(u.fcm_token),
    )


def group_to_out(group: Group) -> GroupOut:
    """Build GroupOut from ORM, including nested members with user profiles."""
    return GroupOut(
        id=group.id,
        name=group.name,
        group_type=group.group_type,
        description=group.description,
        invite_code=group.invite_code,
        is_accepting_members=group.is_accepting_members,
        created_by=group.created_by,
        created_at=group.created_at,
        default_currency=group.default_currency,
        members=[group_member_to_out(m) for m in group.members],
    )


def group_to_detail(group: Group) -> GroupDetail:
    """Build GroupDetail from ORM (same fields as GroupOut, including group_type)."""
    return GroupDetail.model_validate(group_to_out(group))
