"""
app/services/stats_service.py — Aggregated travel metrics for the current user

Session is always injected — never created here.
"""
from __future__ import annotations

import uuid

from sqlalchemy import func, select, text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.models.expense import Expense
from app.models.group import GroupMember
from app.models.location import Location
from app.models.poll import Poll
from app.models.trip import Trip


class StatsService:
    @staticmethod
    def get_travel_stats(db: Session, user_id: uuid.UUID) -> dict:
        trips_created = db.execute(
            select(func.count(Trip.id)).where(Trip.created_by == user_id),
        ).scalar_one()

        groups_joined = db.execute(
            select(func.count(GroupMember.id)).where(GroupMember.user_id == user_id),
        ).scalar_one()

        locations_saved = db.execute(
            select(func.count(Location.id)).where(Location.saved_by == user_id),
        ).scalar_one()

        expenses_paid = db.execute(
            select(func.count(Expense.id)).where(Expense.paid_by == user_id),
        ).scalar_one()

        polls_created = db.execute(
            select(func.count(Poll.id)).where(Poll.created_by == user_id),
        ).scalar_one()

        try:
            countries_rows = db.execute(
                text(
                    "SELECT DISTINCT destination_country FROM trips "
                    "WHERE created_by = :uid AND destination_country IS NOT NULL",
                ),
                {"uid": user_id},
            ).fetchall()
            countries_from_trips = sorted({row[0] for row in countries_rows if row[0]})
        except (ProgrammingError, OperationalError):
            countries_from_trips = []

        return {
            "trips_created": int(trips_created),
            "groups_joined": int(groups_joined),
            "locations_saved": int(locations_saved),
            "expenses_paid": int(expenses_paid),
            "polls_created": int(polls_created),
            "countries_from_trips": countries_from_trips,
        }
