"""
app/services/connect_service.py — Bootstrap data for the Connect surface.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.auth import build_user_out
from app.schemas.connect import ConnectBootstrapOut
from app.schemas.group import group_to_out
from app.services.group_service import GroupService
from app.services.social_service import list_connections


class ConnectService:

    @staticmethod
    def get_bootstrap(db: Session, current_user: User) -> ConnectBootstrapOut:
        groups = GroupService.list_user_groups(db, current_user)
        connections = list_connections(db, current_user)
        return ConnectBootstrapOut(
            user=build_user_out(current_user),
            groups=[group_to_out(group) for group in groups],
            connections=connections,
            server_time=datetime.now(timezone.utc),
        )
