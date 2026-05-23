"""Buddy trips — browse and coordinate shared itineraries."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.buddy_trip import BuddyJoinRequest, BuddyTrip
from app.models.user import User
from app.schemas.buddy import (
    BuddyJoinRead,
    BuddyJoinWrite,
    BuddyRespondWrite,
    BuddyTripCreate,
    BuddyTripRead,
    OrganizerBrief,
    BuddyJoinRequestRead,
    RequesterBrief,
)
from app.utils.exceptions import AppException


class BuddyService:
    """Routes delegate here — persistence only."""

    @staticmethod
    def _to_trip_read(db: Session, trip: BuddyTrip) -> BuddyTripRead:
        org = db.execute(select(User).where(User.id == trip.organizer_id)).scalar_one_or_none()
        brief = None
        if org:
            brief = OrganizerBrief(
                id=org.id,
                full_name=org.full_name,
                avatar_url=org.avatar_url,
            )
        tags = list(trip.vibe_tags) if trip.vibe_tags is not None else []
        return BuddyTripRead(
            id=trip.id,
            organizer_id=trip.organizer_id,
            organizer=brief,
            destination=trip.destination,
            date_from=trip.date_from,
            date_to=trip.date_to,
            max_size=trip.max_size,
            current_size=trip.current_size,
            vibe_tags=tags,
            description=trip.description,
            status=trip.status,
            created_at=trip.created_at,
            updated_at=trip.updated_at,
        )

    @staticmethod
    def create_buddy_trip(db: Session, user: User, data: BuddyTripCreate) -> BuddyTripRead:
        if data.date_to < data.date_from:
            AppException.unprocessable("date_to must be on or after date_from")
        tags = [t.strip() for t in data.vibe_tags if t.strip()][:40]
        trip = BuddyTrip(
            organizer_id=user.id,
            destination=data.destination.strip(),
            date_from=data.date_from,
            date_to=data.date_to,
            max_size=data.max_size,
            current_size=1,
            vibe_tags=tags,
            description=data.description.strip() if data.description else None,
            status="open",
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)
        return BuddyService._to_trip_read(db, trip)

    @staticmethod
    def _ensure_mock_buddy_trips(db: Session, user: User):
        # Only seed if there are absolutely 0 buddy trips in the database
        total = db.execute(select(BuddyTrip)).scalars().all()
        if len(total) > 0:
            return

        # Find some other users to be the organizers
        other_users = db.execute(select(User).where(User.id != user.id)).scalars().all()
        if not other_users:
            return

        import random
        from datetime import timedelta

        mock_destinations = [
            ("Tokyo, Japan", ["Adventure", "Culture"], "Hey guys! Planning a 10-day trip to Tokyo and Kyoto. Looking for buddies to explore local food spots, temples, and maybe hit a few karaoke bars. Let's hang out!"),
            ("Lisbon, Portugal", ["Chill", "Culture"], "Heading to Lisbon for a week. Plan is mostly walking around, drinking good wine, eating Pastel de Nata, and catching sunsets at the miradouros. Very chill vibes."),
            ("Reykjavik, Iceland", ["Nature", "Adventure"], "Road-tripping around Iceland's Ring Road! Looking for 2-3 adventurous buddies to split the cost of a 4x4 camper van. Will be hiking, visiting hot springs, and chasing the Northern Lights!"),
        ]

        for i, (dest, vibes, desc) in enumerate(mock_destinations):
            organizer = other_users[i % len(other_users)]
            trip = BuddyTrip(
                organizer_id=organizer.id,
                destination=dest,
                date_from=date.today() + timedelta(days=30 + i * 15),
                date_to=date.today() + timedelta(days=37 + i * 15),
                max_size=random.choice([4, 6, 8]),
                current_size=1,
                vibe_tags=vibes,
                description=desc,
                status="open",
            )
            db.add(trip)
        db.commit()

    @staticmethod
    def list_buddy_trips(
        db: Session,
        user: User,
        *,
        destination: str | None = None,
        status: str | None = None,
        mine: bool = False,
    ) -> list[BuddyTripRead]:
        BuddyService._ensure_mock_buddy_trips(db, user)
        stmt = select(BuddyTrip)
        if mine:
            approved_ids = select(BuddyJoinRequest.buddy_trip_id).where(
                BuddyJoinRequest.requester_id == user.id,
                BuddyJoinRequest.status == "approved",
            )
            stmt = stmt.where(
                or_(
                    BuddyTrip.organizer_id == user.id,
                    BuddyTrip.id.in_(approved_ids),
                ),
            )
        if destination and destination.strip():
            q = f"%{destination.strip()}%"
            stmt = stmt.where(BuddyTrip.destination.ilike(q))
        if status and status.strip():
            stmt = stmt.where(BuddyTrip.status == status.strip().lower())
        stmt = stmt.order_by(BuddyTrip.date_from.asc(), BuddyTrip.created_at.desc())
        trips = db.execute(stmt).scalars().all()
        return [BuddyService._to_trip_read(db, t) for t in trips]

    @staticmethod
    def get_buddy_trip(db: Session, trip_id: uuid.UUID) -> BuddyTripRead:
        trip = db.execute(select(BuddyTrip).where(BuddyTrip.id == trip_id)).scalar_one_or_none()
        if trip is None:
            AppException.not_found("Buddy trip not found")
        return BuddyService._to_trip_read(db, trip)

    @staticmethod
    def request_to_join(
        db: Session,
        user: User,
        trip_id: uuid.UUID,
        body: BuddyJoinWrite | None,
    ) -> BuddyJoinRead:
        trip = db.execute(select(BuddyTrip).where(BuddyTrip.id == trip_id)).scalar_one_or_none()
        if trip is None:
            AppException.not_found("Buddy trip not found")
        if trip.organizer_id == user.id:
            AppException.bad_request("You cannot join your own trip")
        if trip.status != "open":
            AppException.conflict("This trip is not accepting requests")

        dup = db.execute(
            select(BuddyJoinRequest).where(
                BuddyJoinRequest.buddy_trip_id == trip.id,
                BuddyJoinRequest.requester_id == user.id,
                BuddyJoinRequest.status == "pending",
            ),
        ).scalar_one_or_none()
        if dup is not None:
            AppException.conflict("You already have a pending request")

        msg = None
        if body and body.message and body.message.strip():
            msg = body.message.strip()

        row = BuddyJoinRequest(
            buddy_trip_id=trip.id,
            requester_id=user.id,
            status="pending",
            message=msg,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return BuddyJoinRead.model_validate(row)

    @staticmethod
    def respond_to_request(
        db: Session,
        organizer: User,
        trip_id: uuid.UUID,
        request_id: uuid.UUID,
        body: BuddyRespondWrite,
    ) -> BuddyJoinRead:
        trip = db.execute(select(BuddyTrip).where(BuddyTrip.id == trip_id)).scalar_one_or_none()
        if trip is None:
            AppException.not_found("Buddy trip not found")
        if trip.organizer_id != organizer.id:
            AppException.forbidden()

        req_row = db.execute(
            select(BuddyJoinRequest).where(
                BuddyJoinRequest.id == request_id,
                BuddyJoinRequest.buddy_trip_id == trip.id,
            ),
        ).scalar_one_or_none()
        if req_row is None:
            AppException.not_found("Join request not found")
        if req_row.status != "pending":
            AppException.conflict("Request already handled")

        if body.approve:
            if trip.current_size >= trip.max_size:
                AppException.conflict("Trip is already full")
            req_row.status = "approved"
            trip.current_size += 1
            if trip.current_size >= trip.max_size:
                trip.status = "full"
        else:
            req_row.status = "declined"

        trip.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(req_row)
        db.refresh(trip)
        return BuddyJoinRead.model_validate(req_row)

    @staticmethod
    def get_join_requests(db: Session, current_user: User, trip_id: uuid.UUID) -> list[BuddyJoinRequestRead]:
        trip = db.execute(select(BuddyTrip).where(BuddyTrip.id == trip_id)).scalar_one_or_none()
        if trip is None:
            AppException.not_found("Buddy trip not found")
        if trip.organizer_id != current_user.id:
            AppException.forbidden()

        reqs = db.execute(
            select(BuddyJoinRequest).where(BuddyJoinRequest.buddy_trip_id == trip_id)
        ).scalars().all()

        out = []
        for r in reqs:
            user = db.execute(select(User).where(User.id == r.requester_id)).scalar_one_or_none()
            user_brief = None
            if user:
                user_brief = RequesterBrief(
                    id=user.id,
                    full_name=user.full_name,
                    avatar_url=user.avatar_url,
                )
            out.append(
                BuddyJoinRequestRead(
                    id=r.id,
                    buddy_trip_id=r.buddy_trip_id,
                    requester_id=r.requester_id,
                    user_id=r.requester_id,
                    user=user_brief,
                    status=r.status,
                    message=r.message,
                    created_at=r.created_at,
                )
            )
        return out

