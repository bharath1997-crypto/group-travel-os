"""
app/routes/users.py — User-scoped endpoints (balance across shared groups, etc.)
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.group_service import GroupService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(tags=["Users"])


@router.get(
    "/users/{other_user_id}/balance",
    status_code=status.HTTP_200_OK,
    summary="Net expense balance with another user across shared groups",
)
def get_user_balance(
    other_user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return GroupService.get_balance_with_user(db, current_user.id, other_user_id)
