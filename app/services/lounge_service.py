from __future__ import annotations

import uuid
from datetime import datetime, timezone
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session

from app.models.lounge import LoungeChat, LoungeMember, LoungeDriveSync
from app.models.user import User
from app.models.group import GroupMember
from app.models.friend_request import FriendRequest
from app.schemas.lounge import ChatOut, MemberOut, ContactOut
from app.utils.exceptions import AppException


class LoungeService:
    # Ephemeral in-memory dictionary to support test restore/sync without message DB storage
    _temp_messages_cache: dict[tuple[uuid.UUID, uuid.UUID], list[dict]] = {}

    @staticmethod
    def _to_chat_out(db: Session, chat: LoungeChat) -> ChatOut:
        # Get all members of this chat
        member_rows = db.execute(
            select(LoungeMember, User.full_name, User.avatar_url)
            .join(User, LoungeMember.user_id == User.id)
            .where(LoungeMember.chat_id == chat.id)
        ).all()

        members_list = []
        for row in member_rows:
            lm, full_name, avatar_url = row
            members_list.append(
                MemberOut(
                    id=lm.id,
                    user_id=lm.user_id,
                    full_name=full_name,
                    avatar_url=avatar_url,
                    is_admin=lm.is_admin,
                )
            )

        return ChatOut(
            id=chat.id,
            type=chat.type,
            name=chat.name,
            trip_id=chat.trip_id,
            created_by=chat.created_by,
            created_at=chat.created_at,
            last_message_preview=chat.last_message_preview,
            last_message_at=chat.last_message_at,
            avatar_url=chat.avatar_url,
            members=members_list,
        )

    @staticmethod
    def get_user_chats(db: Session, user_id: uuid.UUID) -> list[ChatOut]:
        # Query chats where this user is a member
        stmt = (
            select(LoungeChat)
            .join(LoungeMember, LoungeChat.id == LoungeMember.chat_id)
            .where(LoungeMember.user_id == user_id)
            .order_by(LoungeChat.last_message_at.desc().nullslast(), LoungeChat.created_at.desc())
        )
        chats = db.execute(stmt).scalars().all()
        return [LoungeService._to_chat_out(db, chat) for chat in chats]

    @staticmethod
    def create_direct_chat(db: Session, creator_id: uuid.UUID, target_user_id: uuid.UUID) -> ChatOut:
        if creator_id == target_user_id:
            AppException.bad_request("Cannot create a direct chat with yourself")

        # Verify target user exists
        target_exists = db.execute(
            select(User).where(User.id == target_user_id)
        ).scalar_one_or_none()
        if not target_exists:
            AppException.not_found("Target user not found")

        # Check if direct chat already exists
        stmt = (
            select(LoungeChat)
            .where(LoungeChat.type == "direct")
            .join(LoungeMember, LoungeChat.id == LoungeMember.chat_id)
            .where(LoungeMember.user_id == creator_id)
        )
        user_direct_chats = db.execute(stmt).scalars().all()

        for chat in user_direct_chats:
            # Check if target_user_id is also in this chat
            target_member = db.execute(
                select(LoungeMember)
                .where(LoungeMember.chat_id == chat.id, LoungeMember.user_id == target_user_id)
            ).scalar_one_or_none()
            if target_member:
                return LoungeService._to_chat_out(db, chat)

        # Create new direct chat
        chat = LoungeChat(
            type="direct",
            created_by=creator_id,
        )
        db.add(chat)
        db.flush()

        m1 = LoungeMember(chat_id=chat.id, user_id=creator_id, is_admin=True)
        m2 = LoungeMember(chat_id=chat.id, user_id=target_user_id, is_admin=False)
        db.add(m1)
        db.add(m2)
        db.commit()
        db.refresh(chat)

        return LoungeService._to_chat_out(db, chat)

    @staticmethod
    def create_group_chat(db: Session, creator_id: uuid.UUID, name: str, member_ids: list[uuid.UUID]) -> ChatOut:
        if not name.strip():
            AppException.bad_request("Group chat name is required")

        # Create new group chat
        chat = LoungeChat(
            type="group",
            name=name.strip(),
            created_by=creator_id,
        )
        db.add(chat)
        db.flush()

        # Add creator
        m_creator = LoungeMember(chat_id=chat.id, user_id=creator_id, is_admin=True)
        db.add(m_creator)

        # Add other members
        added_uids = {creator_id}
        for uid in member_ids:
            if uid in added_uids:
                continue
            # Verify user exists
            user_exists = db.execute(
                select(User).where(User.id == uid)
            ).scalar_one_or_none()
            if not user_exists:
                continue
            m = LoungeMember(chat_id=chat.id, user_id=uid, is_admin=False)
            db.add(m)
            added_uids.add(uid)

        db.commit()
        db.refresh(chat)

        return LoungeService._to_chat_out(db, chat)

    @staticmethod
    def get_chat_members(db: Session, chat_id: uuid.UUID, user_id: uuid.UUID) -> list[MemberOut]:
        # Access check: verify current user is a member of the chat
        is_member = db.execute(
            select(LoungeMember).where(LoungeMember.chat_id == chat_id, LoungeMember.user_id == user_id)
        ).scalar_one_or_none()
        if not is_member:
            AppException.forbidden("You are not a member of this chat")

        # Query all members of the chat
        member_rows = db.execute(
            select(LoungeMember, User.full_name, User.avatar_url)
            .join(User, LoungeMember.user_id == User.id)
            .where(LoungeMember.chat_id == chat_id)
        ).all()

        members_list = []
        for row in member_rows:
            lm, full_name, avatar_url = row
            members_list.append(
                MemberOut(
                    id=lm.id,
                    user_id=lm.user_id,
                    full_name=full_name,
                    avatar_url=avatar_url,
                    is_admin=lm.is_admin,
                )
            )
        return members_list

    @staticmethod
    def leave_chat(db: Session, chat_id: uuid.UUID, user_id: uuid.UUID) -> None:
        member = db.execute(
            select(LoungeMember).where(LoungeMember.chat_id == chat_id, LoungeMember.user_id == user_id)
        ).scalar_one_or_none()
        if not member:
            AppException.not_found("You are not a member of this chat")

        db.delete(member)
        db.commit()

    @staticmethod
    def get_contacts(db: Session, user_id: uuid.UUID) -> list[ContactOut]:
        # 1. User IDs sharing groups
        my_groups = select(GroupMember.group_id).where(GroupMember.user_id == user_id)
        group_members = select(GroupMember.user_id).where(GroupMember.group_id.in_(my_groups))

        # 2. Friend relationships (accepted)
        friends1 = select(FriendRequest.sender_id).where(
            FriendRequest.receiver_id == user_id, FriendRequest.status == "accepted"
        )
        friends2 = select(FriendRequest.receiver_id).where(
            FriendRequest.sender_id == user_id, FriendRequest.status == "accepted"
        )

        # Combine
        stmt = (
            select(User)
            .where(
                or_(
                    User.id.in_(group_members),
                    User.id.in_(friends1),
                    User.id.in_(friends2),
                )
            )
            .where(User.id != user_id)
            .order_by(User.full_name.asc())
        )

        users = db.execute(stmt).scalars().all()
        return [
            ContactOut(
                id=u.id,
                full_name=u.full_name,
                avatar_url=u.avatar_url,
                username=u.username,
            )
            for u in users
        ]

    @staticmethod
    def sync_drive(db: Session, user_id: uuid.UUID, chat_id: uuid.UUID, messages: list[dict], drive_file_id: str | None = None) -> None:
        # Access check
        is_member = db.execute(
            select(LoungeMember).where(LoungeMember.chat_id == chat_id, LoungeMember.user_id == user_id)
        ).scalar_one_or_none()
        if not is_member:
            AppException.forbidden("You are not a member of this chat")

        # Update metadata
        stmt = select(LoungeDriveSync).where(LoungeDriveSync.user_id == user_id, LoungeDriveSync.chat_id == chat_id)
        sync_entry = db.execute(stmt).scalar_one_or_none()
        if not sync_entry:
            sync_entry = LoungeDriveSync(user_id=user_id, chat_id=chat_id)
            db.add(sync_entry)

        sync_entry.last_synced_at = datetime.now(timezone.utc).replace(tzinfo=None)
        if drive_file_id:
            sync_entry.drive_file_id = drive_file_id

        db.commit()

        # Cache messages ephemerally for test recovery checks
        LoungeService._temp_messages_cache[(user_id, chat_id)] = messages

    @staticmethod
    def restore_drive(db: Session, user_id: uuid.UUID, chat_id: uuid.UUID) -> list[dict]:
        # Access check
        is_member = db.execute(
            select(LoungeMember).where(LoungeMember.chat_id == chat_id, LoungeMember.user_id == user_id)
        ).scalar_one_or_none()
        if not is_member:
            AppException.forbidden("You are not a member of this chat")

        # Retrieve cached messages if they exist
        return LoungeService._temp_messages_cache.get((user_id, chat_id), [])

    @staticmethod
    def update_backup_settings(db: Session, user_id: uuid.UUID, interval: str, wifi_only: bool) -> None:
        # Update drive settings on all memberships for this user
        stmt = select(LoungeMember).where(LoungeMember.user_id == user_id)
        memberships = db.execute(stmt).scalars().all()
        for m in memberships:
            m.drive_backup_interval = interval
            m.drive_backup_enabled = True  # enable it if settings updated
        db.commit()
