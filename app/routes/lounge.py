from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.lounge import (
    ChatOut,
    MemberOut,
    ContactOut,
    DirectChatCreateRequest,
    GroupChatCreateRequest,
    DriveSyncRequest,
    DriveRestoreResponse,
    BackupSettingsRequest,
)
from app.services.lounge_service import LoungeService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/lounge", tags=["lounge"])


@router.get(
    "/chats",
    response_model=list[ChatOut],
    summary="List current user's lounge chats",
)
def get_user_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LoungeService.get_user_chats(db, current_user.id)


@router.post(
    "/chats/direct",
    response_model=ChatOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create or retrieve direct chat",
)
def create_direct_chat(
    data: DirectChatCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LoungeService.create_direct_chat(db, current_user.id, data.user_id)


@router.post(
    "/chats/group",
    response_model=ChatOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create group chat",
)
def create_group_chat(
    data: GroupChatCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LoungeService.create_group_chat(db, current_user.id, data.name, data.member_ids)


@router.get(
    "/chats/{chat_id}/members",
    response_model=list[MemberOut],
    summary="List chat members",
)
def get_chat_members(
    chat_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LoungeService.get_chat_members(db, chat_id, current_user.id)


@router.delete(
    "/chats/{chat_id}/leave",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Leave a chat",
)
def leave_chat(
    chat_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LoungeService.leave_chat(db, chat_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/contacts",
    response_model=list[ContactOut],
    summary="Get chat contacts",
)
def get_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LoungeService.get_contacts(db, current_user.id)


@router.post(
    "/drive/sync",
    status_code=status.HTTP_200_OK,
    summary="Sync chat messages to user's Google Drive",
)
def sync_drive(
    data: DriveSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LoungeService.sync_drive(db, current_user.id, data.chat_id, data.messages, data.drive_file_id)
    return {"status": "success"}


@router.get(
    "/drive/restore/{chat_id}",
    response_model=DriveRestoreResponse,
    summary="Restore chat messages from Google Drive",
)
def restore_drive(
    chat_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msgs = LoungeService.restore_drive(db, current_user.id, chat_id)
    return DriveRestoreResponse(messages=msgs)


@router.patch(
    "/settings/backup",
    status_code=status.HTTP_200_OK,
    summary="Update backup settings",
)
def update_backup_settings(
    data: BackupSettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LoungeService.update_backup_settings(db, current_user.id, data.interval, data.wifi_only)
    return {"status": "success"}
