from datetime import datetime, timezone
from . import db


class Trip(db.Model):
    __tablename__ = "trips"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    destination = db.Column(db.String(200), nullable=False)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    members = db.relationship("Member", back_populates="trip", cascade="all, delete-orphan")
    itinerary = db.relationship("ItineraryItem", back_populates="trip", cascade="all, delete-orphan")
    expenses = db.relationship("Expense", back_populates="trip", cascade="all, delete-orphan")
    polls = db.relationship("Poll", back_populates="trip", cascade="all, delete-orphan")


class Member(db.Model):
    __tablename__ = "members"

    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey("trips.id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(200), nullable=True)
    joined_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    trip = db.relationship("Trip", back_populates="members")
    expenses = db.relationship("Expense", back_populates="paid_by_member")
    votes = db.relationship("Vote", back_populates="member", cascade="all, delete-orphan")


class ItineraryItem(db.Model):
    __tablename__ = "itinerary_items"

    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey("trips.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    scheduled_at = db.Column(db.DateTime, nullable=True)
    location = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    trip = db.relationship("Trip", back_populates="itinerary")


class Expense(db.Model):
    __tablename__ = "expenses"

    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey("trips.id"), nullable=False)
    paid_by = db.Column(db.Integer, db.ForeignKey("members.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(10), default="USD")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    trip = db.relationship("Trip", back_populates="expenses")
    paid_by_member = db.relationship("Member", back_populates="expenses")


class Poll(db.Model):
    __tablename__ = "polls"

    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey("trips.id"), nullable=False)
    question = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    trip = db.relationship("Trip", back_populates="polls")
    options = db.relationship("PollOption", back_populates="poll", cascade="all, delete-orphan")


class PollOption(db.Model):
    __tablename__ = "poll_options"

    id = db.Column(db.Integer, primary_key=True)
    poll_id = db.Column(db.Integer, db.ForeignKey("polls.id"), nullable=False)
    label = db.Column(db.String(200), nullable=False)

    poll = db.relationship("Poll", back_populates="options")
    votes = db.relationship("Vote", back_populates="option", cascade="all, delete-orphan")


class Vote(db.Model):
    __tablename__ = "votes"

    id = db.Column(db.Integer, primary_key=True)
    option_id = db.Column(db.Integer, db.ForeignKey("poll_options.id"), nullable=False)
    member_id = db.Column(db.Integer, db.ForeignKey("members.id"), nullable=False)
    voted_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    option = db.relationship("PollOption", back_populates="votes")
    member = db.relationship("Member", back_populates="votes")
