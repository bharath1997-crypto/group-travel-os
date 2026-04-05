from flask import Blueprint, request, jsonify
from .. import db
from ..models import Trip, Member
from ..schemas import MemberSchema
from marshmallow import ValidationError

members_bp = Blueprint("members", __name__)
member_schema = MemberSchema()
members_schema = MemberSchema(many=True)


@members_bp.get("/<int:trip_id>/members")
def list_members(trip_id: int):
    db.get_or_404(Trip, trip_id)
    members = Member.query.filter_by(trip_id=trip_id).all()
    return jsonify(members_schema.dump(members)), 200


@members_bp.post("/<int:trip_id>/members")
def add_member(trip_id: int):
    db.get_or_404(Trip, trip_id)
    try:
        data = member_schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 422

    member = Member(trip_id=trip_id, **data)
    db.session.add(member)
    db.session.commit()
    return jsonify(member_schema.dump(member)), 201


@members_bp.delete("/<int:trip_id>/members/<int:member_id>")
def remove_member(trip_id: int, member_id: int):
    member = Member.query.filter_by(id=member_id, trip_id=trip_id).first_or_404()
    db.session.delete(member)
    db.session.commit()
    return jsonify({"message": "Member removed"}), 200
