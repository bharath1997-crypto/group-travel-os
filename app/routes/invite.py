"""Public invite link endpoints for guest poll voting."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.schemas.invite import InviteContextOut
from app.schemas.poll import poll_to_out
from app.schemas.trip import TripOut
from app.services.invite_service import InviteService
from app.utils.database import get_db

invite_router = APIRouter(prefix="/invite", tags=["Invite"])


@invite_router.get(
    "/{code}",
    response_model=InviteContextOut,
    status_code=status.HTTP_200_OK,
    summary="Get trip poll context and guest vote token from group invite code",
)
def get_invite_context(
    code: str,
    db: Session = Depends(get_db),
):
    data = InviteService.get_invite_context(db, code)
    return InviteContextOut(
        group_id=data["group"].id,
        group_name=data["group"].name,
        trip=TripOut.model_validate(data["trip"]),
        polls=[poll_to_out(p) for p in data["polls"]],
        guest_token=data["guest_token"],
        guest_identifier=data["guest_identifier"],
    )
