"""Trust gating and connection paths for Seats."""
from __future__ import annotations

import uuid

from sqlalchemy import delete, or_, select, text
from sqlalchemy.orm import Session

from app.models.blocked_user import BlockedUser
from app.models.friend_request import FriendRequest
from app.models.group import GroupMember
from app.models.seats import ConnectionPath
from app.models.user import User


def is_blocked(db: Session, a: uuid.UUID, b: uuid.UUID) -> bool:
    row = db.execute(
        select(BlockedUser.id).where(
            or_(
                (BlockedUser.blocker_id == a) & (BlockedUser.blocked_id == b),
                (BlockedUser.blocker_id == b) & (BlockedUser.blocked_id == a),
            )
        )
    ).scalar_one_or_none()
    return row is not None


def rebuild_connection_paths(db: Session, viewer_id: uuid.UUID) -> None:
    """Precompute 0–2 hop paths from viewer to other users."""
    db.execute(delete(ConnectionPath).where(ConnectionPath.viewer_id == viewer_id))

    friends: set[uuid.UUID] = set()
    fr_rows = db.execute(
        select(FriendRequest).where(
            FriendRequest.status == "accepted",
            or_(
                FriendRequest.sender_id == viewer_id,
                FriendRequest.receiver_id == viewer_id,
            ),
        )
    ).scalars().all()
    for fr in fr_rows:
        other = fr.receiver_id if fr.sender_id == viewer_id else fr.sender_id
        friends.add(other)
        db.add(
            ConnectionPath(
                viewer_id=viewer_id,
                target_id=other,
                via_user_id=None,
                hops=1,
            )
        )

    if not friends:
        return

    fof_rows = db.execute(
        select(FriendRequest).where(
            FriendRequest.status == "accepted",
            or_(
                FriendRequest.sender_id.in_(friends),
                FriendRequest.receiver_id.in_(friends),
            ),
        )
    ).scalars().all()

    seen: set[uuid.UUID] = set(friends) | {viewer_id}
    for fr in fof_rows:
        anchor = fr.sender_id if fr.sender_id in friends else fr.receiver_id
        other = fr.receiver_id if fr.sender_id == anchor else fr.sender_id
        if other in seen or other == viewer_id:
            continue
        seen.add(other)
        db.add(
            ConnectionPath(
                viewer_id=viewer_id,
                target_id=other,
                via_user_id=anchor,
                hops=2,
            )
        )


def trust_path_for(db: Session, viewer_id: uuid.UUID, driver_id: uuid.UUID) -> dict | None:
    if viewer_id == driver_id:
        return {"hops": 0, "label": "You"}
    path = db.execute(
        select(ConnectionPath).where(
            ConnectionPath.viewer_id == viewer_id,
            ConnectionPath.target_id == driver_id,
        )
    ).scalar_one_or_none()
    if path is None:
        return None
    if path.hops == 1:
        return {"hops": 1, "via_user_id": str(driver_id), "label": "In your network"}
    if path.via_user_id:
        via = db.get(User, path.via_user_id)
        name = (via.full_name or "Someone").split()[0] if via else "Someone"
        return {
            "hops": 2,
            "via_user_id": str(path.via_user_id),
            "label": f"{name}'s colleague",
        }
    return {"hops": 2, "label": "Friend of a friend"}


def ride_visible_sql_filter(viewer_param: str = ":viewer_id") -> str:
    """SQL fragment — AND seats_visible_to(r.id, viewer)."""
    return f" AND seats_visible_to(r.id, {viewer_param}) "
