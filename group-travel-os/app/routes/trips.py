from flask import Blueprint, request, jsonify
from .. import db
from ..models import Trip
from ..schemas import TripSchema
from marshmallow import ValidationError

trips_bp = Blueprint("trips", __name__)
trip_schema = TripSchema()
trips_schema = TripSchema(many=True)


@trips_bp.get("/")
def list_trips():
    trips = Trip.query.order_by(Trip.created_at.desc()).all()
    return jsonify(trips_schema.dump(trips)), 200


@trips_bp.post("/")
def create_trip():
    try:
        data = trip_schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 422

    trip = Trip(**data)
    db.session.add(trip)
    db.session.commit()
    return jsonify(trip_schema.dump(trip)), 201


@trips_bp.get("/<int:trip_id>")
def get_trip(trip_id: int):
    trip = db.get_or_404(Trip, trip_id)
    return jsonify(trip_schema.dump(trip)), 200


@trips_bp.put("/<int:trip_id>")
def update_trip(trip_id: int):
    trip = db.get_or_404(Trip, trip_id)
    try:
        data = trip_schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 422

    for key, value in data.items():
        setattr(trip, key, value)
    db.session.commit()
    return jsonify(trip_schema.dump(trip)), 200


@trips_bp.delete("/<int:trip_id>")
def delete_trip(trip_id: int):
    trip = db.get_or_404(Trip, trip_id)
    db.session.delete(trip)
    db.session.commit()
    return jsonify({"message": "Trip deleted"}), 200
