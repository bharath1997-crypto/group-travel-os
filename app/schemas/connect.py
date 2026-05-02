"""
app/schemas/connect.py — Connect bootstrap response schemas.
"""
from datetime import datetime

from pydantic import BaseModel

from app.schemas.auth import UserOut
from app.schemas.group import GroupOut
from app.schemas.social import UserSearchOut


class ConnectBootstrapOut(BaseModel):
    user: UserOut
    groups: list[GroupOut]
    connections: list[UserSearchOut]
    server_time: datetime
