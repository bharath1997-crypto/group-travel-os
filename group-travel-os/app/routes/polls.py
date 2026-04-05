from flask import Blueprint, request, jsonify
from .. import db
from ..models import Trip, Poll, PollOption, Vote
from ..schemas import PollSchema, VoteSchema
from marshmallow import ValidationError

polls_bp = Blueprint("polls", __name__)
poll_schema = PollSchema()
polls_schema = PollSchema(many=True)
vote_schema = VoteSchema()


def _option_with_votes(option: PollOption) -> dict:
    return {
        "id": option.id,
        "poll_id": option.poll_id,
        "label": option.label,
        "vote_count": len(option.votes),
    }


def _poll_dump(poll: Poll) -> dict:
    return {
        "id": poll.id,
        "trip_id": poll.trip_id,
        "question": poll.question,
        "created_at": poll.created_at.isoformat() if poll.created_at else None,
        "options": [_option_with_votes(o) for o in poll.options],
    }


@polls_bp.get("/<int:trip_id>/polls")
def list_polls(trip_id: int):
    db.get_or_404(Trip, trip_id)
    polls = Poll.query.filter_by(trip_id=trip_id).order_by(Poll.created_at.desc()).all()
    return jsonify([_poll_dump(p) for p in polls]), 200


@polls_bp.post("/<int:trip_id>/polls")
def create_poll(trip_id: int):
    db.get_or_404(Trip, trip_id)
    body = request.get_json(force=True) or {}
    try:
        data = poll_schema.load(body)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 422

    options_data = data.pop("options", [])
    poll = Poll(trip_id=trip_id, **data)
    db.session.add(poll)
    db.session.flush()

    for opt in options_data:
        db.session.add(PollOption(poll_id=poll.id, label=opt["label"]))

    db.session.commit()
    return jsonify(_poll_dump(poll)), 201


@polls_bp.post("/<int:trip_id>/polls/<int:poll_id>/vote")
def vote(trip_id: int, poll_id: int):
    db.get_or_404(Trip, trip_id)
    poll = Poll.query.filter_by(id=poll_id, trip_id=trip_id).first_or_404()

    try:
        data = vote_schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 422

    option_id = data["option_id"]
    member_id = data["member_id"]

    if not any(o.id == option_id for o in poll.options):
        return jsonify({"errors": {"option_id": ["Option does not belong to this poll"]}}), 422

    if Vote.query.filter_by(option_id=option_id, member_id=member_id).first():
        return jsonify({"errors": {"member_id": ["Member has already voted on this option"]}}), 409

    vote_obj = Vote(option_id=option_id, member_id=member_id)
    db.session.add(vote_obj)
    db.session.commit()
    return jsonify({"message": "Vote recorded", "option_id": option_id, "member_id": member_id}), 201


@polls_bp.delete("/<int:trip_id>/polls/<int:poll_id>")
def delete_poll(trip_id: int, poll_id: int):
    poll = Poll.query.filter_by(id=poll_id, trip_id=trip_id).first_or_404()
    db.session.delete(poll)
    db.session.commit()
    return jsonify({"message": "Poll deleted"}), 200
