"""
app/schemas/group.py — Group request and response schemas (Pydantic v2)
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.group import Group, GroupMember, MemberRole


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: str | None = Field(None, max_length=500)


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


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    invite_code: str
    created_by: UUID
    created_at: datetime
    members: list[GroupMemberOut] = Field(default_factory=list)


class JoinGroupRequest(BaseModel):
    invite_code: str = Field(..., min_length=6, max_length=12)


class InviteCodeOut(BaseModel):
    invite_code: str


def group_member_to_out(member: GroupMember) -> GroupMemberOut:
    """Build GroupMemberOut from ORM (pulls profile fields from member.user)."""
    return GroupMemberOut(
        id=member.id,
        user_id=member.user_id,
        full_name=member.user.full_name,
        avatar_url=member.user.avatar_url,
        role=member.role,
        joined_at=member.joined_at,
    )


def group_to_out(group: Group) -> GroupOut:
    """Build GroupOut from ORM, including nested members with user profiles."""
    return GroupOut(
        id=group.id,
        name=group.name,
        description=group.description,
        invite_code=group.invite_code,
        created_by=group.created_by,
        created_at=group.created_at,
        members=[group_member_to_out(m) for m in group.members],
    )
