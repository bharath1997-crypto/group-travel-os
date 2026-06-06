from pydantic import BaseModel, ConfigDict
import uuid
from datetime import datetime

class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    avatar_url: str | None = None
    is_admin: bool

class ChatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    type: str
    name: str | None = None
    trip_id: uuid.UUID | None = None
    created_by: uuid.UUID | None = None
    created_at: datetime
    last_message_preview: str | None = None
    last_message_at: datetime | None = None
    avatar_url: str | None = None
    members: list[MemberOut]

class DirectChatCreateRequest(BaseModel):
    user_id: uuid.UUID

class GroupChatCreateRequest(BaseModel):
    name: str
    member_ids: list[uuid.UUID]

class DriveSyncRequest(BaseModel):
    chat_id: uuid.UUID
    messages: list[dict]
    drive_file_id: str | None = None

class DriveRestoreResponse(BaseModel):
    messages: list[dict]

class BackupSettingsRequest(BaseModel):
    interval: str
    wifi_only: bool

class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    full_name: str
    avatar_url: str | None = None
    username: str | None = None
