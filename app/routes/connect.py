"""
app/routes/connect.py — Connect bootstrap endpoints.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.connect import ConnectBootstrapOut
from app.services.connect_service import ConnectService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/connect", tags=["Connect"])


@router.get(
    "/bootstrap",
    response_model=ConnectBootstrapOut,
    status_code=status.HTTP_200_OK,
    summary="Bootstrap Connect data in one request",
)
def get_connect_bootstrap(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConnectBootstrapOut:
    return ConnectService.get_bootstrap(db, current_user)
